/**
 * Rule-based extractor for Czech and Slovak used-car ads.
 *
 * The ads are free text written by private sellers, so every attribute is found by scoring candidate
 * values against the words around them (e.g. "r.v. 2015" vs "STK do 2027", "najeto 180 tkm" vs
 * "rozvody měněny v 120 000 km") and by clause-local negation handling ("nehavarované", "nikdy nebourané",
 * "bez koroze" are positives, "nepojízdné", "nestartuje" are negatives). Every decision records the
 * snippet it was based on so admins can audit the parse, and an overall confidence decides whether the
 * listing is sent to the LLM fallback.
 */
import { CATALOG, type MakeDef, type ModelDef } from "./catalog";
import { clauses, escapeRegex, fold, parseNumber } from "./normalize";

export type Kind = "car" | "parts" | "wanted" | "rental" | "other";
export type Condition = "ok" | "damaged" | "non_running" | "parts" | "unknown";
export type Fuel = "petrol" | "diesel" | "lpg" | "cng" | "hybrid" | "plugin_hybrid" | "electric" | "unknown";
export type Transmission = "manual" | "automatic" | "unknown";
export type Seller = "private" | "dealer" | "unknown";

export type ParseInput = {
  title: string;
  description?: string;
  price?: number | null;
  currency?: "CZK" | "EUR";
  /** Structured values a source already provides (e.g. a "Rok výroby" field); they win over text. */
  hints?: Partial<ParsedAttributes>;
  now?: Date;
};

export type ParsedAttributes = {
  kind: Kind;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  mileageKm: number | null;
  fuel: Fuel;
  transmission: Transmission;
  bodyType: string | null;
  powerKw: number | null;
  engineCcm: number | null;
  condition: Condition;
  conditionNotes: string[];
  seller: Seller;
  vatDeductible: boolean;
  serviceBook: boolean | null;
  firstOwner: boolean | null;
  stkValidUntil: string | null;
};

export type ParseResult = ParsedAttributes & {
  confidence: number;
  /** Why each attribute got its value: attribute -> matched snippet */
  evidence: Record<string, string>;
  /** Conflicting or weak signals that make an LLM second opinion worthwhile */
  doubts: string[];
  priceSuspicious: boolean;
};

// ---------------------------------------------------------------------------------------------
// Make & model

type AliasHit = { index: number; length: number; inTitle: boolean; alias: string };

const SHORT_OR_AMBIGUOUS_MAKE_ALIASES = new Set(["mb", "mini", "smart", "seat", "alfa", "mg", "ram", "vaz", "merc"]);

function wordRegex(alias: string): RegExp {
  // Word boundaries that also work around digits and dashes ("vw golf", "t-roc", "320d").
  // Czech and Slovak decline nouns ("Octavii", "Superbu", "Fabií"), so longer purely alphabetic
  // aliases also match their stem plus a short case ending.
  if (/^[a-z]{5,}$/.test(alias)) {
    const stem = alias.replace(/[aeiouy]$/, "");
    return new RegExp(`(?<![a-z0-9])${escapeRegex(stem)}(?:[aeiouy]|ou|em|em|ach|ami|ovi|i|u)?(?![a-z0-9])`, "g");
  }
  return new RegExp(`(?<![a-z0-9])${escapeRegex(alias)}(?![a-z0-9])`, "g");
}

const aliasRegexCache = new Map<string, RegExp>();
function aliasRegex(alias: string): RegExp {
  let re = aliasRegexCache.get(alias);
  if (!re) {
    re = wordRegex(alias);
    aliasRegexCache.set(alias, re);
  }
  re.lastIndex = 0;
  return re;
}

function findAlias(text: string, alias: string, inTitle: boolean): AliasHit[] {
  const hits: AliasHit[] = [];
  const re = aliasRegex(alias);
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(text))) hits.push({ index: mm.index, length: mm[0].length, inTitle, alias });
  return hits;
}

/** Models whose alias is long and unique across the catalogue identify the make on their own ("Octavia"). */
const UNIQUE_MODEL_ALIASES: Map<string, { make: MakeDef; model: ModelDef }> = (() => {
  const seen = new Map<string, { make: MakeDef; model: ModelDef }[]>();
  for (const make of CATALOG)
    for (const model of make.models)
      for (const a of model.aliases ?? []) {
        if (a.length < 4 || /^\d+$/.test(a)) continue;
        const list = seen.get(a) ?? [];
        list.push({ make, model });
        seen.set(a, list);
      }
  const out = new Map<string, { make: MakeDef; model: ModelDef }>();
  for (const [a, list] of seen) if (list.length === 1) out.set(a, list[0]);
  return out;
})();

function detectMakeModel(title: string, body: string) {
  let best: { make: MakeDef; score: number; hit: AliasHit } | null = null;
  for (const make of CATALOG) {
    for (const alias of make.aliases) {
      const ambiguous = SHORT_OR_AMBIGUOUS_MAKE_ALIASES.has(alias);
      const hits = [...findAlias(title, alias, true), ...(ambiguous ? [] : findAlias(body, alias, false))];
      for (const hit of hits) {
        // Earlier in the title = more likely the subject of the ad. Longer aliases are more specific.
        let score = hit.inTitle ? 10 - Math.min(hit.index / 10, 5) : 3;
        score += Math.min(alias.length, 10) / 10;
        if (ambiguous) score -= 2;
        if (!best || score > best.score) best = { make, score, hit };
      }
    }
  }

  let make = best?.make ?? null;
  let model: ModelDef | null = null;
  let modelHit: AliasHit | null = null;
  let inferredFromModel = false;

  const pickModel = (mk: MakeDef) => {
    let top: { model: ModelDef; score: number; hit: AliasHit } | null = null;
    for (const md of mk.models) {
      const aliases = md.aliases?.length ? md.aliases : [md.slug];
      for (const alias of aliases) {
        for (const hit of [...findAlias(title, alias, true), ...findAlias(body, alias, false)]) {
          const score = (hit.inTitle ? 10 : 4) + alias.length / 5;
          // Numeric aliases ("80", "120", "206") only count right after the make name
          if (/^\d+$/.test(alias)) {
            const src = hit.inTitle ? title : body;
            const before = src.slice(Math.max(0, hit.index - mk.name.length - 3), hit.index);
            if (!mk.aliases.some((a) => fold(before).includes(a))) continue;
          }
          if (!top || score > top.score) top = { model: md, score, hit };
        }
      }
      for (const re of md.patterns ?? []) {
        for (const [src, inTitle] of [
          [title, true],
          [body, false],
        ] as const) {
          const mm = new RegExp(re.source, "g").exec(src);
          if (mm) {
            const score = (inTitle ? 9 : 3) + 0.5;
            if (!top || score > top.score) top = { model: md, score, hit: { index: mm.index, length: mm[0].length, inTitle, alias: mm[0] } };
          }
        }
      }
    }
    return top;
  };

  if (make) {
    const top = pickModel(make);
    if (top) {
      model = top.model;
      modelHit = top.hit;
    }
  } else {
    // No make written: infer from a distinctive model name ("Octavia combi 2.0 TDI")
    for (const [alias, ref] of UNIQUE_MODEL_ALIASES) {
      const hits = findAlias(title, alias, true);
      if (hits.length) {
        make = ref.make;
        model = ref.model;
        modelHit = hits[0];
        inferredFromModel = true;
        break;
      }
    }
  }

  // Variant = the rest of the title after the model name, minus noise words
  let variant: string | null = null;
  if (modelHit?.inTitle) {
    const rest = title
      .slice(modelHit.index + modelHit.length)
      .replace(/\b(prodam|prodej|predam|na prodej|top stav|super stav|tazne|stk|nove|nová|cena)\b.*$/i, "")
      .replace(/[,;|!]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (rest.length >= 2) variant = rest.slice(0, 60);
  }

  return {
    make,
    model,
    variant,
    inferredFromModel,
    makeEvidence: best?.hit.alias ?? (inferredFromModel ? modelHit?.alias : undefined),
    modelEvidence: modelHit?.alias,
  };
}

// ---------------------------------------------------------------------------------------------
// Year

const YEAR_POSITIVE = [
  /r\.? ?v\.?:?\s*$/,
  /\brv:?\s*$/,
  /rok(u)? vyroby:?\s*$/,
  /vyroben[aoy]?:?\s*(v roce|v r\.)?\s*$/,
  /vyroba:?\s*$/,
  /rocnik:?\s*$/,
  /\bmodel(ovy rok|\.? rok)?:?\s*$/,
  /\bmy\s*$/,
  /(1\.|prvni|prva) (registrace|registracia|reg\.)\s*(v cr|v sr|v cr:)?:?\s*$/,
  /uveden[oa]? do provozu:?\s*$/,
  /(datum|rok) registrace:?\s*$/,
  /\br\.\s*$/,
  /\brok:?\s*$/,
  /\bz roku\s*$/,
  /\bz r\.\s*$/,
];

const YEAR_NEGATIVE = [
  /\b(stk|tk|emise|ek|me)\b[^.,;]{0,20}$/,
  /\b(do|platn[aáeé]|plati|plat[ií] do|vyprsi|konci)\s*:?\s*(\d{1,2}[./]\s*)?$/,
  /\b(servis|vymen|menen|rozvod|olej|pneu|baterie|spojk|brzd|koupen|kupovan|vlastn[ií]m od|od roku|v majetku od|dovezen|dovoz|garanc|zaruk|leasing)[^.,;]{0,25}$/,
  /\b(tel|mob|psc|ico|dic)[^.]{0,10}$/,
];

const YEAR_AFTER_NEGATIVE = /^\s*(ccm|cm3|cm³|km|kc|kč|eur|€|,-|\s*-?\s*kc|nm|kg|mm|cm|l\b)/;

function extractYear(title: string, body: string, now: Date) {
  const maxYear = now.getFullYear() + 1;
  type Cand = { year: number; score: number; snippet: string };
  const cands: Cand[] = [];
  const scan = (text: string, inTitle: boolean) => {
    const re = /(?<![\d.,])(?:(\d{1,2})\s*[./]\s*)?((?:19[5-9]|20[0-4])\d)(?:\s*[./]\s*(\d{1,2}))?(?![\d.,]\d)/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(text))) {
      const year = Number(mm[2]);
      if (year > maxYear) continue;
      const before = text.slice(Math.max(0, mm.index - 40), mm.index);
      const after = text.slice(mm.index + mm[0].length, mm.index + mm[0].length + 8);
      if (YEAR_AFTER_NEGATIVE.test(after)) continue;
      // "1.9 TDI 1998" is a year, "1998 ccm" was filtered above; "2.0 2005" fine.
      let score = inTitle ? 2 : 1;
      if (YEAR_POSITIVE.some((p) => p.test(before))) score += 5;
      if (YEAR_NEGATIVE.some((p) => p.test(before))) score -= 6;
      // Month/year notation right after a registration word is common for first registration
      if (mm[1] || mm[3]) score += 0.5;
      cands.push({ year, score, snippet: (before.slice(-20) + mm[0]).trim() });
    }
  };
  scan(title, true);
  scan(body, false);
  const usable = cands.filter((c) => c.score > 0);
  if (!usable.length) return { year: null, conf: 0, snippet: undefined, conflict: false };
  usable.sort((a, b) => b.score - a.score);
  const top = usable[0];
  const conflict = usable.some((c) => c.year !== top.year && c.score >= top.score - 1 && c.score > 1);
  const conf = top.score >= 5 ? 1 : top.score >= 2 ? 0.75 : 0.45;
  return { year: top.year, conf: conflict ? conf * 0.6 : conf, snippet: top.snippet, conflict };
}

// ---------------------------------------------------------------------------------------------
// Mileage

const KM_POSITIVE = /(najet[oay]?|najezd|najazd(ene|ených|enych)?|nabehan[eo]|stav (km|tachometru)|tachometr|tacho|km\s*:|ujet[oa]|celkovy najezd)\s*:?\s*(cca|jen|pouze|len|iba|realnych|skutecnych|originalnich|overenych)?\s*$/;
const KM_NEGATIVE = /(dojezd|dojazd|dosah|vzdalen|od nas|od \w+$|servis|vymen|menen|rozvod|olej|spojk|motor (ma|mel)|repas|generalk|nove|pred|po|pri|v|na|do|kazdych|interval|zaruka|garancia)\s*(cca|asi)?\s*$/;

function extractMileage(title: string, body: string) {
  type Cand = { km: number; score: number; snippet: string };
  const cands: Cand[] = [];
  const scan = (text: string, inTitle: boolean) => {
    // Number followed by a km unit ("150 000 km", "150tkm", "150 tis. km", "150k km")
    const withUnit = /(\d{1,3}(?:[ .,]\d{3})+|\d+(?:[.,]\d+)?)\s*(tis\.?\s*|tisic\s*|t\.?\s*|k\s*)?(km|tkm|tis\.?\b)/g;
    let mm: RegExpExecArray | null;
    while ((mm = withUnit.exec(text))) {
      const before = text.slice(Math.max(0, mm.index - 35), mm.index);
      let km = parseNumber(mm[1]) ?? 0;
      if (mm[2] || mm[3] === "tkm" || mm[3].startsWith("tis")) km *= 1000;
      if (km > 1_500_000) continue;
      let score = inTitle ? 2 : 1;
      if (KM_POSITIVE.test(before)) score += 5;
      else if (KM_NEGATIVE.test(before)) score -= 5;
      // "500 km" without context is usually a distance, not mileage
      if (km < 1000 && score < 5) score -= 2;
      cands.push({ km, score, snippet: (before.slice(-20) + mm[0]).trim() });
    }
    // Keyword followed by a bare number ("najeto 185 000", "najeto: 185tis")
    const keywordFirst = /(najet[oay]?|najezd|najazdene|nabehane|stav tachometru|tachometr)\s*:?\s*(cca|jen|pouze|len|iba)?\s*(\d{1,3}(?:[ .,]\d{3})+|\d+(?:[.,]\d+)?)\s*(tis\.?|tisic|t\b|k\b)?/g;
    while ((mm = keywordFirst.exec(text))) {
      let km = parseNumber(mm[3]) ?? 0;
      if (mm[4]) km *= 1000;
      else if (km > 0 && km < 1000) km *= 1000; // "najeto 185" means thousands in practice
      if (km > 1_500_000) continue;
      cands.push({ km, score: (inTitle ? 2 : 1) + 5, snippet: mm[0] });
    }
  };
  scan(title, true);
  scan(body, false);
  const usable = cands.filter((c) => c.score > 0);
  if (!usable.length) return { km: null, conf: 0, snippet: undefined };
  usable.sort((a, b) => b.score - a.score);
  const top = usable[0];
  return { km: top.km, conf: top.score >= 5 ? 1 : top.score >= 2 ? 0.7 : 0.4, snippet: top.snippet };
}

// ---------------------------------------------------------------------------------------------
// Engine, power, fuel, transmission, body

function extractPower(text: string) {
  const kw = /(\d{2,3})(?:[.,]\d)?\s*kw(?!h)/.exec(text);
  if (kw) {
    const v = Number(kw[1]);
    if (v >= 15 && v <= 800) return { kw: v, snippet: kw[0] };
  }
  const hp = /(\d{2,3})\s*(ps|hp|koni|konskych|konskych sil|k\b|cv)/.exec(text);
  if (hp) {
    const v = Math.round(Number(hp[1]) * 0.7355);
    if (v >= 15 && v <= 800) return { kw: v, snippet: hp[0] };
  }
  return { kw: null, snippet: undefined };
}

function extractEngine(text: string) {
  const ccm = /(\d{3,4})\s*(ccm|cm3|cm³|cm\^3)/.exec(text);
  if (ccm) {
    const v = Number(ccm[1]);
    if (v >= 500 && v <= 8000) return { ccm: v, snippet: ccm[0] };
  }
  // "1.9 TDI", "2,0 tdi", "1.4 16v", "1.6i", "3.0d" - the displacement must sit next to an engine token
  const lit = /(?<![\d.,])([0-6][.,]\d)\s*(l\b|i\b|d\b|t\b|v\d|16v|8v|tdi|tsi|tfsi|fsi|mpi|htp|tdci|hdi|bluehdi|dci|cdi|crdi|jtd|jtdm|multijet|d4d|crd|tce|ecoboost|vtec|vti|gdi|t-gdi|turbo|benzin|nafta|diesel|lpg|cng|hybrid|ti\b|sdi|td\b|e-hdi|skyactiv|tgi|g-tec|mjet)/.exec(text);
  if (lit) {
    const v = Math.round(Number(lit[1].replace(",", ".")) * 1000);
    if (v >= 600 && v <= 7000) return { ccm: v, snippet: lit[0] };
  }
  return { ccm: null, snippet: undefined };
}

const FUEL_RULES: { fuel: Fuel; re: RegExp; weight: number }[] = [
  { fuel: "plugin_hybrid", re: /\b(plug-?in|phev|e-hybrid|gte\b|iperformance|recharge|t8)\b/, weight: 6 },
  { fuel: "electric", re: /\b(elektromobil|elektroauto|elektro\b|ciste elektr|100 ?% elektr|bev\b|\d{2,3}(?:[.,]\d)? ?kwh)\b/, weight: 6 },
  { fuel: "hybrid", re: /\b(hybrid|hybridni|hybrid?ny|hev|full hybrid|mild hybrid|mhev)\b/, weight: 5 },
  { fuel: "lpg", re: /\b(lpg|na plyn|plynov[aey] (zarizeni|nadrz)|prestavba na plyn)\b/, weight: 5 },
  { fuel: "cng", re: /\b(cng|g-tec|tgi|zemni plyn)\b/, weight: 5 },
  { fuel: "diesel", re: /\b(tdi|sdi|tdci|cdi|crdi|hdi|bluehdi|dci|jtd|jtdm|multijet|mjet|d-?4d|crd|td\b|diesel|nafta|naftak|naftovy|naftovej|bluetec|bluemotion tdi|ddis|i-dtec|cdti|dtec|xdrive\d{0,2}d|\d{3} ?d\b|\d[.,]\dd\b|\d{2,3} ?cdi)/, weight: 4 },
  { fuel: "petrol", re: /\b(tsi|tfsi|fsi|mpi|htp|benzin|benzinovy|benzinovej|benzinak|vtec|vti|tce|ecoboost|gdi|t-gdi|puretech|thp|skyactiv-g|mpi|16v|8v|\d{3} ?i\b|\d[.,]\di\b|turbo benzin|e-tsi)\b/, weight: 3 },
];

const ELECTRIC_ONLY = new Set(["skoda/enyaq", "skoda/elroq", "volkswagen/id3", "volkswagen/id4", "audi/e-tron", "bmw/i3", "nissan/leaf", "renault/zoe", "kia/ev6", "mg/mg4", "porsche/taycan", "dacia/spring", "cupra/born", "byd/atto-3", "byd/seal", "byd/dolphin"]);

function extractFuel(title: string, body: string): { fuel: Fuel; snippet?: string } {
  const scores = new Map<Fuel, { score: number; snippet: string }>();
  for (const [text, mult] of [
    [title, 2],
    [body, 1],
  ] as const) {
    for (const rule of FUEL_RULES) {
      const mm = rule.re.exec(text);
      if (!mm) continue;
      // "není LPG", "bez LPG" must not count
      const before = text.slice(Math.max(0, mm.index - 12), mm.index);
      if (/\b(bez|neni|nema|nie je|nema ziadne)\s*$/.test(before)) continue;
      const prev = scores.get(rule.fuel);
      scores.set(rule.fuel, { score: (prev?.score ?? 0) + rule.weight * mult, snippet: mm[0] });
    }
  }
  if (!scores.size) return { fuel: "unknown" };
  // Bi-fuel and hybrids also mention petrol; the specific system wins
  for (const f of ["plugin_hybrid", "electric", "hybrid", "lpg", "cng"] as Fuel[]) {
    if (scores.has(f) && (f !== "electric" || !scores.has("diesel"))) return { fuel: f, snippet: scores.get(f)!.snippet };
  }
  const sorted = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  return { fuel: sorted[0][0], snippet: sorted[0][1].snippet };
}

function extractTransmission(text: string, fuel: Fuel): { tr: Transmission; snippet?: string } {
  const auto = /\b(automat\w*|automaticka|automaticku|dsg|tiptronic|steptronic|cvt|s-?tronic|multitronic|powershift|edc|dct|pdk|[579]g-?tronic|aut\.? prevodovka|a\/t|at\d|samoradic\w*|e-cvt)\b/.exec(text);
  const manual = /\b(manual\w*|manualni|manualna|manuál|rucni rad|[56] ?(st\.?|stup\w*|rychl\w*|q)\b|m\/t|mt\d)\b/.exec(text);
  if (auto && !/\b(neni|bez)\s*$/.test(text.slice(Math.max(0, auto.index - 8), auto.index)))
    return { tr: "automatic", snippet: auto[0] };
  if (manual) return { tr: "manual", snippet: manual[0] };
  if (fuel === "electric") return { tr: "automatic", snippet: "electric" };
  return { tr: "unknown" };
}

const BODY_RULES: [string, RegExp][] = [
  ["combi", /\b(kombi|combi|universal|variant|avant|touring|estate|sportwagon|sports tourer|break|sw\b|tourer|caravan|kombik|kombi)\b/],
  ["suv", /\b(suv|4x4|offroad|off-road|teren\w*|crossover)\b/],
  ["mpv", /\b(mpv|minivan|vpv|van 7 mist|7 mist|7-mist|7 miestne)\b/],
  ["van", /\b(dodavk\w*|dodavka|skrin|skrinova|furgon|l2h2|l1h1|l3h2|nakladn\w*)\b/],
  ["cabrio", /\b(cabrio|cabriolet|kabrio\w*|roadster|spider)\b/],
  ["coupe", /\b(coupe|kupe)\b/],
  ["pickup", /\b(pick-?up|pickup|double cab|dvojkabin\w*)\b/],
  ["sedan", /\b(sedan|limuzin\w*|liftback|notchback)\b/],
  ["hatchback", /\b(hatchback|hatch|hb\b|[35] ?dv(erov[aey])?)\b/],
];

function extractBody(text: string, model: ModelDef | null): { body: string | null; snippet?: string } {
  for (const [body, re] of BODY_RULES) {
    const mm = re.exec(text);
    if (mm) return { body, snippet: mm[0] };
  }
  return { body: model?.body ?? null, snippet: model?.body ? "model default" : undefined };
}

// ---------------------------------------------------------------------------------------------
// Listing kind & condition

const WANTED = /^(koupim|kupim|vykoupim|vykup|hledam|hladam|shanim|zhanam|poptavam)\b/;
const RENTAL = /\b(pronajem|pronajmu|prenajom|prenajmem|pujcovna|pozicovna|zapujceni|pujcim)\b/;
const PART_NOUNS =
  "(nahradni dily|nahradne diely|dily|diely|kola|kolo|disky|disk|alu kola|elektrony|plechove disky|pneu|pneumatiky|gumy|zimni kola|letni kola|motor|prevodovka|prevodovku|turbo|turbodmychadlo|vstrikovac|vstrikovace|dvere|dvirka|blatnik|kapota|naraznik|narazniky|svetlo|svetla|svetlomet|svetlomety|zrcatko|sedacky|sedadla|volant|navigace|radio|autoradio|tazne zarizeni|strecni nosic|stresny nosic|stresni box|box|chladic|alternator|startér|starter|spojka|tlumice|pruzinky|brzdy|kotouce|vyfuk|katalyzator|dpf|klimatizace|kompresor|baterie|akumulator|tachometr|pristrojova deska|airbag|rizeni|naprava|poloosa|kabel|potahy|koberce|autokoberce|lista|stertec|zamek|klic|ridici jednotka|jednotka|cidlo|sada|hlava motoru|blok motoru|nosic kol|kryty kol|poklice|led|xenon|ostrikovac)";
const PART_TITLE = new RegExp(`^(\\d+x\\s*)?(prodam|predam|nabizim|ponukam)?\\s*(\\d+x\\s*)?${PART_NOUNS}\\b`);
const PART_ANYWHERE_TITLE = /\b(na (nahradni )?dily|na diely|rozprodam|rozpredam|rozprodej|rozebiram|rozoberam|dily z|diely z|dily na|diely na|dily pro|diely pre)\b/;
const WHOLE_CAR_FOR_PARTS = /\b(na (nahradni )?dily|na diely|rozprodam|rozpredam|rozprodej|rozebiram|rozoberam|cele na dily|vcelku na dily|auto na dily)\b/;

type Signal = { condition: Condition | "positive"; note?: string; snippet: string; strength: number };

// Concepts with base polarity; a negation flips them. Stems are matched on folded text.
const CONDITION_CONCEPTS: { re: RegExp; polarity: 1 | -1; negative: Condition; note?: string; strength: number }[] = [
  { re: /(?<![a-z])(ne)?(pojizdn|pojazdn)\w*/, polarity: 1, negative: "non_running", strength: 3 },
  { re: /(?<![a-z])(ne)?(startuje|nastartuje|naskoci|jede|chodi)\b/, polarity: 1, negative: "non_running", strength: 2 },
  { re: /(?<![a-z])(ne)?(funkcn|funkcen)\w*\s*(motor|prevodov\w*|spojk\w*)?/, polarity: 1, negative: "damaged", note: "defect", strength: 1 },
  { re: /(?<![a-z])(ne)?(havarovan|havarovn|bouran|buran|nabouran|naburan|poskozen|poskoden|pomackan|promackl|tuknut|tuknuty|tukl)\w*/, polarity: -1, negative: "damaged", note: "accident", strength: 3 },
  { re: /(?<![a-z])(ne)?(po (havarii|nehode|bourani|nehode|ukolizi|kolizi)|kolize)\b/, polarity: -1, negative: "damaged", note: "accident", strength: 3 },
  { re: /(?<![a-z])(ne)?(koroz\w*|zrezl\w*|hrdz\w*|prorezl\w*|rez\b)/, polarity: -1, negative: "ok", note: "rust", strength: 1 },
  { re: /(?<![a-z])(ne)?(kroup\w*|krupobit\w*|krupobiti)/, polarity: -1, negative: "damaged", note: "hail", strength: 2 },
  { re: /(?<![a-z])(ne)?(vyhorel\w*|pozar\w*|po pozaru|zatopen\w*|povoden\w*|zaplaven\w*)/, polarity: -1, negative: "damaged", note: "fire_flood", strength: 3 },
];

const HARD_NON_RUNNING =
  /\b(zadren\w* motor|motor zadren\w*|zadrety motor|motor nejde|bez motoru|bez prevodovky|vadn\w* motor|vadn\w* prevodov\w*|prasl\w* (hlava|blok)|prasknut\w* (hlava|blok)|nefunkcni motor|nefunkcna prevodovka|nefunkcni prevodovka|na odtah|odtahem|nutna oprava motoru|motor na opravu|poskozeny motor|rozbity motor|rozbita prevodovka|kaput motor|motor klepe|klepe motor|bez klicu)\b/;
const NEEDS_REPAIR = /\b(nutn[aeé] oprav\w*|potrebuje oprav\w*|vyzaduje oprav\w*|na opravu|pro kutila|pre kutila|pro sikovne|opravit|nutno opravit|drobne vady|vada|zavada|kontrolka|svieti kontrolka|sviti kontrolka)\b/;
const NO_STK = /\b(bez (stk|tk)|stk (propadl\w*|neplatn\w*|prosla)|(stk|tk) do \d{1,2}[./]?(20)?(1\d|2[0-4])\b)/;
const STRONG_POSITIVE = /\b(bez (nehody|nehod|havarie|havarii|poskozeni|koroze|korozie|zavad|zavady|investic)|plne (funkcni|funkcne|pojizdn\w*|pojazdn\w*)|vyborn\w* (stav\w*|technick\w*)|top stav\w*|perfektn\w* stav\w*|100 ?% stav\w*|bezvadn\w* stav\w*|vyborn\w* kondic\w*|nehavarovan\w*|nebouran\w*|neburan\w*|garazovan\w*|ihned k jizde|ihned pojizdn\w*|technicky v (poradku|poriadku)|jezdi bez problemu|jazdi bez problemov|pravideln\w* servis\w*)\b/;

const NEGATORS = /\b(ne|bez|neni|nebylo|nebyl[ao]?|nikdy|zadne|zadny|ziadne|ziadny|nie|nie je|ani|nema|nemelo)\s+(\w+\s+){0,2}$/;

function analyseCondition(title: string, body: string) {
  const signals: Signal[] = [];
  const notes = new Set<string>();
  for (const [text, inTitle] of [
    [title, true],
    [body, false],
  ] as const) {
    if (HARD_NON_RUNNING.test(text)) {
      const mm = HARD_NON_RUNNING.exec(text)!;
      const before = text.slice(Math.max(0, mm.index - 20), mm.index);
      if (!NEGATORS.test(before)) signals.push({ condition: "non_running", snippet: mm[0], strength: inTitle ? 5 : 4 });
    }
    if (WHOLE_CAR_FOR_PARTS.test(text)) {
      const mm = WHOLE_CAR_FOR_PARTS.exec(text)!;
      // "nabízím i díly" in a body that otherwise describes a running car is weaker
      signals.push({ condition: "parts", snippet: mm[0], strength: inTitle ? 6 : 3 });
    }
    if (NEEDS_REPAIR.test(text)) {
      const mm = NEEDS_REPAIR.exec(text)!;
      const before = text.slice(Math.max(0, mm.index - 25), mm.index);
      if (!NEGATORS.test(before)) {
        signals.push({ condition: "damaged", note: "needs_repair", snippet: mm[0], strength: 1 });
        notes.add("needs_repair");
      }
    }
    if (NO_STK.test(text)) notes.add("no_stk");
    const pos = STRONG_POSITIVE.exec(text);
    if (pos) signals.push({ condition: "positive", snippet: pos[0], strength: 2 });

    for (const clause of clauses(text)) {
      for (const concept of CONDITION_CONCEPTS) {
        const re = new RegExp(concept.re.source, "g");
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(clause))) {
          const prefixNegated = Boolean(mm[1]);
          const before = clause.slice(Math.max(0, mm.index - 30), mm.index);
          const wordNegated = NEGATORS.test(before);
          // Czech/Slovak use negative concord: "nikdy nebourané" is still one negation, not two
          const negated = prefixNegated || wordNegated;
          const polarity = negated ? -concept.polarity : concept.polarity;
          if (polarity > 0) {
            signals.push({ condition: "positive", snippet: mm[0], strength: 1 });
          } else {
            if (concept.note) notes.add(concept.note);
            if (concept.negative !== "ok")
              signals.push({ condition: concept.negative, note: concept.note, snippet: mm[0], strength: concept.strength + (inTitle ? 1 : 0) });
          }
        }
      }
    }
  }

  const score = (c: Condition | "positive") => signals.filter((s) => s.condition === c).reduce((a, s) => a + s.strength, 0);
  const pos = score("positive");
  const parts = score("parts");
  const nonRunning = score("non_running");
  const damaged = score("damaged");

  let condition = "unknown" as Condition;
  let snippet: string | undefined;
  const pick = (c: Condition) => {
    condition = c;
    snippet = signals.find((s) => s.condition === c)?.snippet;
  };
  if (parts >= 6 || (parts >= 3 && parts > pos)) pick("parts");
  else if (nonRunning >= 3 && nonRunning >= pos) pick("non_running");
  else if (damaged >= 3 && damaged > pos) pick("damaged");
  else if (damaged > 0 && pos === 0) pick("damaged");
  else if (pos > 0) {
    condition = "ok";
    snippet = signals.find((s) => s.condition === "positive")?.snippet;
  }

  const conflicted = pos > 0 && (nonRunning + damaged + parts) > 0 && Math.abs(pos - (nonRunning + damaged + parts)) <= 2;
  return { condition, notes: [...notes], snippet, conflicted };
}

function detectKind(title: string, body: string): { kind: Kind; snippet?: string } {
  const t = title.replace(/^[^a-z0-9]+/, "");
  if (WANTED.test(t)) return { kind: "wanted", snippet: WANTED.exec(t)![0] };
  if (RENTAL.test(t)) return { kind: "rental", snippet: RENTAL.exec(t)![0] };
  const part = PART_TITLE.exec(t);
  if (part) {
    // "Motor 1.9 TDI" is a part; "Prodám Octavia, motor 1.9" starts with a make or model instead
    return { kind: "parts", snippet: part[0] };
  }
  if (PART_ANYWHERE_TITLE.test(t) && /\b(dily|diely)\s+(z|na|pro|pre)\b/.test(t)) return { kind: "parts", snippet: "díly z/na" };
  if (/^(pneu|pneumatiky|kola|disky)\b/.test(fold(body).slice(0, 20))) return { kind: "parts" };
  return { kind: "car" };
}

// ---------------------------------------------------------------------------------------------
// Seller and extras

const DEALER = /\b(autobazar|auto bazar|autosalon|s\.r\.o|spol\. s r\.o|a\.s\.|odpocet dph|odpoctem dph|moznost odpoctu|financovani|na splatky|na leasing|operativni leasing|uver|zaruka|garancia|garance|cebia|protiucet|vykup vozidel|nase vozidla|v nasi nabidce|nabizime|ponukame|ico:|ico \d|provozovna|prevadzka|showroom|dph\b)/;
const PRIVATE = /\b(soukrom\w* (prodej|osoba|inzerce)|sukromn\w* (predaj|osoba)|nejsem (autobazar|prekupnik)|nie som (autobazar|prekupnik)|prodavam (svoje|sve|nase)|predavam (svoje|nase)|jako (prvni|druhy) majitel|kupovano jako nove|kupovane ako nove|z duvodu koupe|z dovodu kupy|prodej z duvodu|predaj z dovodu|rodinne auto|nasledujici auto|moje auto)\b/;

function extractSeller(text: string): { seller: Seller; snippet?: string } {
  const d = DEALER.exec(text);
  const p = PRIVATE.exec(text);
  if (p && !d) return { seller: "private", snippet: p[0] };
  if (d && !p) return { seller: "dealer", snippet: d[0] };
  if (d && p) return { seller: "unknown" };
  return { seller: "unknown" };
}

function extractStk(text: string, now: Date): string | null {
  const mm = /\b(?:stk|tk)\s*(?:a\s*(?:ek|emise)\s*)?(?:platna\s*|plati\s*)?(?:do|:)?\s*:?\s*(?:(\d{1,2})\s*[./]\s*)?((?:20)?\d{2})\b/.exec(text);
  if (!mm) return null;
  let year = Number(mm[2]);
  if (year < 100) year += 2000;
  if (year < 2000 || year > now.getFullYear() + 4) return null;
  const month = mm[1] ? Math.min(Math.max(Number(mm[1]), 1), 12) : 12;
  return `${year}-${String(month).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------------------------

export function parseListing(input: ParseInput): ParseResult {
  const now = input.now ?? new Date();
  const title = fold(input.title);
  const body = fold(input.description ?? "");
  const all = `${title} \n ${body}`;
  const evidence: Record<string, string> = {};
  const doubts: string[] = [];

  const kindRes = detectKind(title, body);
  if (kindRes.snippet) evidence.kind = kindRes.snippet;

  const mm = detectMakeModel(title, body);
  if (mm.makeEvidence) evidence.make = mm.makeEvidence;
  if (mm.modelEvidence) evidence.model = mm.modelEvidence;

  const yr = extractYear(title, body, now);
  if (yr.snippet) evidence.year = yr.snippet;
  if (yr.conflict) doubts.push("year_conflict");

  const km = extractMileage(title, body);
  if (km.snippet) evidence.mileageKm = km.snippet;

  const power = extractPower(all);
  if (power.snippet) evidence.powerKw = power.snippet;
  const engine = extractEngine(all);
  if (engine.snippet) evidence.engineCcm = engine.snippet;
  const fuel = extractFuel(title, body);
  if (fuel.fuel === "unknown" && mm.make && (mm.make.slug === "tesla" || ELECTRIC_ONLY.has(`${mm.make.slug}/${mm.model?.slug}`))) {
    fuel.fuel = "electric";
    fuel.snippet = "electric-only model";
  }
  if (fuel.snippet) evidence.fuel = fuel.snippet;
  const tr = extractTransmission(all, fuel.fuel);
  if (tr.snippet) evidence.transmission = tr.snippet;
  const body2 = extractBody(all, mm.model);
  if (body2.snippet) evidence.bodyType = body2.snippet;
  const cond = analyseCondition(title, body);
  if (cond.snippet) evidence.condition = cond.snippet;
  if (cond.conflicted) doubts.push("condition_conflict");
  const seller = extractSeller(all);
  if (seller.snippet) evidence.seller = seller.snippet;

  let kind = kindRes.kind;
  // A part title that still names a full car with year and mileage is really a car ad
  if (kind === "parts" && mm.model && yr.year && km.km && km.km > 1000 && cond.condition !== "parts") kind = "car";

  // Plausibility: a modern car "for 1 Kč" or "for 100 Kč" is a placeholder price
  const priceCzk = input.price == null ? null : input.currency === "EUR" ? input.price * 25 : input.price;
  const priceSuspicious =
    kind === "car" && priceCzk != null && (priceCzk < 2000 || (yr.year != null && yr.year >= 2012 && priceCzk < 15000 && cond.condition !== "parts"));
  if (priceSuspicious) doubts.push("price_placeholder");

  // Electric cars have no displacement; drop false positives
  const engineCcm = fuel.fuel === "electric" ? null : engine.ccm;

  const h = input.hints ?? {};
  const result: ParseResult = {
    kind: h.kind ?? kind,
    make: h.make ?? mm.make?.slug ?? null,
    model: h.model ?? mm.model?.slug ?? null,
    variant: h.variant ?? mm.variant,
    year: h.year ?? yr.year,
    mileageKm: h.mileageKm ?? km.km,
    fuel: h.fuel && h.fuel !== "unknown" ? h.fuel : fuel.fuel,
    transmission: h.transmission && h.transmission !== "unknown" ? h.transmission : tr.tr,
    bodyType: h.bodyType ?? body2.body,
    powerKw: h.powerKw ?? power.kw,
    engineCcm: h.engineCcm ?? engineCcm,
    condition: h.condition && h.condition !== "unknown" ? h.condition : kind === "parts" ? "unknown" : cond.condition,
    conditionNotes: cond.notes,
    seller: h.seller && h.seller !== "unknown" ? h.seller : seller.seller,
    vatDeductible: h.vatDeductible ?? /\b(odpocet dph|odpoctem dph|moznost odpoctu|odpocitatelne dph|cena bez dph|mozny odpocet)\b/.test(all),
    serviceBook: h.serviceBook ?? (/\b(servisni (knizka|knizku|historie)|servisna (knizka|knizku|historia)|kompletni servis\w*|servisovano (v|u))\b/.test(all) ? true : null),
    firstOwner: h.firstOwner ?? (/\b(1\.? ?majitel\w*|prvni majitel\w*|prvy majitel\w*|1\. ?maj\.)/.test(all) ? true : null),
    stkValidUntil: h.stkValidUntil ?? extractStk(all, now),
    confidence: 0,
    evidence,
    doubts,
    priceSuspicious,
  };

  // Confidence: weighted share of the attributes that matter for price comparison
  if (result.kind === "car") {
    const makeConf = result.make ? (mm.inferredFromModel ? 0.8 : 1) : 0;
    const modelConf = result.model ? 1 : 0;
    const yearConf = h.year ? 1 : yr.conf;
    const kmConf = h.mileageKm ? 1 : km.conf;
    const fuelConf = result.fuel !== "unknown" ? 1 : 0;
    const condConf = cond.conflicted ? 0.3 : result.condition !== "unknown" ? 1 : 0.6;
    result.confidence =
      0.22 * makeConf + 0.22 * modelConf + 0.2 * yearConf + 0.16 * kmConf + 0.1 * fuelConf + 0.1 * condConf;
    if (doubts.length) result.confidence *= 0.85;
  } else {
    result.confidence = kindRes.snippet ? 0.9 : 0.6;
  }
  result.confidence = Math.round(result.confidence * 100) / 100;
  return result;
}
