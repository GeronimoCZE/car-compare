/**
 * Synthetic listings for local development and previews. Text is written the way real sellers
 * write (abbreviations, inflection, negations) so it exercises the parser end to end.
 * Never enable this source in production.
 */
import type { RawListing, SourceAdapter } from "../types";

type Spec = { make: string; model: string; newPrice: number; from: number; to: number; engines: string[] };

const SPECS: Spec[] = [
  { make: "Škoda", model: "Octavia", newPrice: 720000, from: 2005, to: 2024, engines: ["1.6 TDI 77kW", "2.0 TDI 110kW", "1.4 TSI 110kW", "1.5 TSI 110kW", "1.9 TDI 77kW", "2.0 TDI 135kW RS"] },
  { make: "Škoda", model: "Fabia", newPrice: 420000, from: 2004, to: 2024, engines: ["1.2 HTP 47kW", "1.0 TSI 70kW", "1.4 TDI 59kW", "1.2 TSI 63kW"] },
  { make: "Škoda", model: "Superb", newPrice: 980000, from: 2008, to: 2024, engines: ["2.0 TDI 140kW", "2.0 TDI 110kW", "1.4 TSI 92kW", "2.0 TSI 162kW"] },
  { make: "Škoda", model: "Kodiaq", newPrice: 1050000, from: 2017, to: 2024, engines: ["2.0 TDI 110kW 4x4", "1.5 TSI 110kW", "2.0 TDI 147kW"] },
  { make: "Volkswagen", model: "Golf", newPrice: 680000, from: 2004, to: 2024, engines: ["1.6 TDI 77kW", "2.0 TDI 110kW", "1.4 TSI 90kW", "1.5 eTSI 96kW"] },
  { make: "VW", model: "Passat", newPrice: 900000, from: 2006, to: 2023, engines: ["2.0 TDI 110kW", "2.0 TDI 140kW", "1.4 TSI 92kW"] },
  { make: "Ford", model: "Focus", newPrice: 600000, from: 2005, to: 2023, engines: ["1.6 TDCi 85kW", "1.0 EcoBoost 92kW", "1.5 TDCi 88kW"] },
  { make: "Hyundai", model: "i30", newPrice: 560000, from: 2008, to: 2024, engines: ["1.4 CVVT 73kW", "1.6 CRDi 85kW", "1.0 T-GDi 88kW"] },
  { make: "BMW", model: "320d", newPrice: 1200000, from: 2006, to: 2023, engines: ["xDrive 140kW", "135kW", "120kW"] },
  { make: "Toyota", model: "Corolla", newPrice: 650000, from: 2008, to: 2024, engines: ["1.8 Hybrid 90kW", "1.6 VVT-i 97kW", "2.0 Hybrid 135kW"] },
  { make: "Dacia", model: "Duster", newPrice: 450000, from: 2011, to: 2024, engines: ["1.5 dCi 80kW 4x4", "1.6 SCe 84kW LPG", "1.3 TCe 110kW"] },
  { make: "Kia", model: "Sportage", newPrice: 850000, from: 2011, to: 2024, engines: ["1.6 GDI 99kW", "2.0 CRDi 100kW", "1.6 T-GDi 130kW"] },
  { make: "Renault", model: "Megane", newPrice: 550000, from: 2006, to: 2022, engines: ["1.5 dCi 81kW", "1.2 TCe 97kW", "1.6 16V 81kW"] },
  { make: "Tesla", model: "Model 3", newPrice: 1200000, from: 2019, to: 2024, engines: ["Long Range AWD", "Standard Range Plus"] },
  { make: "Audi", model: "A4 Avant", newPrice: 1100000, from: 2008, to: 2023, engines: ["2.0 TDI 110kW", "2.0 TDI 140kW quattro", "2.0 TFSI 140kW"] },
];

const LOCATIONS_CZ: [string, string][] = [["Praha", "11000"], ["Brno", "60200"], ["Ostrava", "70200"], ["Plzeň", "30100"], ["Olomouc", "77900"], ["Liberec", "46001"], ["Hradec Králové", "50002"], ["České Budějovice", "37001"], ["Zlín", "76001"], ["Pardubice", "53002"]];
const LOCATIONS_SK: [string, string][] = [["Bratislava", "81101"], ["Košice", "04001"], ["Žilina", "01001"], ["Nitra", "94901"], ["Banská Bystrica", "97401"], ["Trnava", "91701"], ["Prešov", "08001"]];

// Small deterministic PRNG so seeding is reproducible
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function generateDemoListings(country: "CZ" | "SK", count: number, seed = 42): RawListing[] {
  const r = rng(seed + (country === "SK" ? 1000 : 0));
  const pick = <T>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const out: RawListing[] = [];
  const nowYear = 2026;
  for (let i = 0; i < count; i++) {
    const s = pick(SPECS);
    const year = s.from + Math.floor(r() * (s.to - s.from + 1));
    const age = nowYear - year;
    const km = Math.round((age * (12000 + r() * 16000) + r() * 8000) / 1000) * 1000;
    const engine = pick(s.engines);
    const roll = r();
    const condition = roll < 0.06 ? "parts" : roll < 0.12 ? "non_running" : roll < 0.22 ? "damaged" : "ok";
    const dealer = r() < 0.35;
    let price = s.newPrice * Math.pow(0.86, age) * (1 - Math.min(km / 1_500_000, 0.3)) * (0.88 + r() * 0.24);
    if (condition === "damaged") price *= 0.65;
    if (condition === "non_running") price *= 0.4;
    if (condition === "parts") price *= 0.18;
    const [city, psc] = pick(country === "CZ" ? LOCATIONS_CZ : LOCATIONS_SK);
    const cz = country === "CZ";
    const kmText = r() < 0.5 ? `${Math.round(km / 1000)} tkm` : `${km.toLocaleString("cs-CZ").replace(/ /g, " ")} km`;

    const lines: string[] = [];
    if (condition === "parts") {
      lines.push(cz ? `Prodám ${s.make} ${s.model} na díly, r.v. ${year}.` : `Predám ${s.make} ${s.model} na diely, r.v. ${year}.`);
      lines.push(cz ? "Motor ok, karoserie po nehodě. Rozprodám i po kusech." : "Motor ok, karoséria po nehode. Rozpredám aj po kusoch.");
    } else {
      lines.push(cz ? `Rok výroby ${year}, najeto ${kmText}.` : `Rok výroby ${year}, najazdené ${kmText}.`);
      if (condition === "ok") {
        lines.push(pick(cz ? ["Auto je nehavarované, bez koroze.", "Nikdy nebourané, garážované.", "Vůz je v top stavu, pravidelný servis."] : ["Auto je nehavarované, bez korózie.", "Nikdy nebúrané, garážované.", "Vozidlo je v top stave, pravidelný servis."]));
      } else if (condition === "damaged") {
        lines.push(pick(cz ? ["Lehce bouraný zadní nárazník, jinak pojízdné.", "Poškozené kroupami, technicky v pořádku.", "Po menší nehodě, nutná oprava blatníku."] : ["Ľahko búraný zadný nárazník, inak pojazdné.", "Poškodené krupobitím, technicky v poriadku."]));
      } else {
        lines.push(pick(cz ? ["Auto je nepojízdné, nestartuje.", "Zadřený motor, karoserie bez koroze.", "Vadná převodovka, prodej na odtah."] : ["Auto je nepojazdné, neštartuje.", "Zadretý motor, karoséria bez korózie."]));
      }
      if (r() < 0.4) lines.push(cz ? `STK do ${String(1 + Math.floor(r() * 12)).padStart(2, "0")}/${2027 + Math.floor(r() * 2)}.` : `STK do ${String(1 + Math.floor(r() * 12)).padStart(2, "0")}/${2027 + Math.floor(r() * 2)}.`);
      if (r() < 0.4) lines.push(cz ? "Servisní knížka, 1. majitel." : "Servisná knižka, 1. majiteľ.");
      if (r() < 0.5) lines.push(pick(["Automatická převodovka DSG.", "Manuální 6st. převodovka.", "Klimatizace, tempomat, vyhřívaná sedadla."]));
      if (dealer) lines.push(cz ? "Možnost odpočtu DPH, financování na splátky. Autobazar " + city + "." : "Možnosť odpočtu DPH, financovanie na splátky. Autobazár " + city + ".");
      else lines.push(cz ? "Prodávám z důvodu koupě nového vozu." : "Predávam z dôvodu kúpy nového auta.");
    }

    const currency = cz ? "CZK" : "EUR";
    const finalPrice = cz ? Math.round(price / 1000) * 1000 : Math.round(price / 24.3 / 50) * 50;
    out.push({
      externalId: `${country}-${seed}-${i}`,
      url: `https://example.com/demo/${country.toLowerCase()}/${i}`,
      title: `${s.make} ${s.model} ${engine}${condition === "non_running" ? (cz ? " nepojízdné" : " nepojazdné") : ""}`,
      description: lines.join(" "),
      price: Math.max(finalPrice, cz ? 5000 : 200),
      currency,
      location: city,
      postalCode: psc,
      imageUrl: null,
      postedAt: new Date(Date.now() - Math.floor(r() * 20) * 86400_000),
    });
  }
  return out;
}

export function demoAdapter(): SourceAdapter {
  return {
    async *crawl(ctx) {
      const cfg = ctx.source.config as { count?: number; seed?: number };
      yield* generateDemoListings(ctx.source.country, cfg.count ?? 300, cfg.seed ?? 42);
    },
    async check() {
      return { status: "active" };
    },
  };
}
