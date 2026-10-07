/**
 * Legal texts in Czech and Slovak. They are a solid starting template, written for a price
 * comparison service that only links to third-party listings, but must be reviewed by a lawyer and
 * completed with the operator's details (env OPERATOR_NAME / OPERATOR_ID / OPERATOR_ADDRESS).
 */
import type { Locale } from "@/i18n/dictionaries";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site";

const OP = process.env.OPERATOR_NAME ?? "[Provozovatel / Prevádzkovateľ]";
const OP_ID = process.env.OPERATOR_ID ?? "[IČO]";
const OP_ADDR = process.env.OPERATOR_ADDRESS ?? "[Sídlo / Sídlo]";
const UPDATED = "7. 10. 2026";

type Doc = { title: string; body: React.ReactNode };

export function terms(locale: Locale): Doc {
  if (locale === "sk")
    return {
      title: "Podmienky používania",
      body: (
        <>
          <p>Platné od {UPDATED}. Tieto podmienky upravujú používanie webu {SITE_NAME} ({SITE_URL}), ktorý prevádzkuje {OP}, IČO {OP_ID}, so sídlom {OP_ADDR} (ďalej „prevádzkovateľ“).</p>
          <h2>1. Čo je {SITE_NAME}</h2>
          <p>{SITE_NAME} je porovnávač cien jazdených vozidiel. Zobrazujeme prehľad inzerátov zverejnených na iných weboch (napr. bazároch a autobazároch), z ich textu automaticky rozpoznávame parametre vozidla a porovnávame ceny. Nie sme predajcom ani sprostredkovateľom predaja vozidiel a nie sme stranou zmluvy medzi kupujúcim a predajcom.</p>
          <h2>2. Presnosť údajov</h2>
          <p>Údaje o vozidlách (rok výroby, nájazd, stav, výkon a pod.) sú získavané automaticky z textu inzerátov a môžu obsahovať chyby. Trhová cena a hodnotenie ceny sú len orientačný štatistický odhad. Pred kúpou si vždy overte všetky údaje priamo u predajcu, ideálne aj prehliadkou vozidla a overením jeho histórie.</p>
          <h2>3. Odkazy na weby tretích strán</h2>
          <p>Kliknutím na „Zobraziť inzerát“ prejdete na web tretej strany. Za obsah inzerátov, ich pravdivosť a za správanie predajcov zodpovedajú ich autori a prevádzkovatelia zdrojových webov.</p>
          <h2>4. Používateľský účet</h2>
          <ul>
            <li>Registrácia je bezplatná. Pri registrácii uveďte pravdivý e-mail a heslo si chráňte.</li>
            <li>Účet môžete kedykoľvek zrušiť v nastaveniach účtu.</li>
            <li>Prevádzkovateľ môže účet zablokovať, ak je zneužívaný (napr. automatizované sťahovanie dát, spam, falošné nahlásenia).</li>
          </ul>
          <h2>5. Zakázané použitie</h2>
          <p>Nie je dovolené web automatizovane sťahovať, zaťažovať, obchádzať technické obmedzenia ani používať obsah na budovanie konkurenčných databáz bez súhlasu prevádzkovateľa.</p>
          <h2>6. Pre predajcov a zdrojové weby</h2>
          <p>Ak ste autorom inzerátu alebo prevádzkovateľom zdrojového webu a nesúhlasíte so zobrazením, napíšte na {CONTACT_EMAIL}. Inzerát alebo zdroj bez zbytočného odkladu odstránime. Autobazáry môžu svoju ponuku posielať cez XML feed (viac v sekcii O nás).</p>
          <h2>7. Zodpovednosť</h2>
          <p>Prevádzkovateľ nezodpovedá za škodu vzniknutú v súvislosti s nákupom vozidla alebo spoliehaním sa na automaticky rozpoznané údaje, v rozsahu, v akom to umožňujú právne predpisy.</p>
          <h2>8. Záverečné ustanovenia</h2>
          <p>Prevádzkovateľ môže podmienky meniť; o podstatných zmenách informuje registrovaných používateľov. Vzťahy sa riadia právom Slovenskej republiky, ak kogentné predpisy nestanovia inak. Kontakt: {CONTACT_EMAIL}.</p>
        </>
      ),
    };
  return {
    title: "Podmínky použití",
    body: (
      <>
        <p>Platné od {UPDATED}. Tyto podmínky upravují používání webu {SITE_NAME} ({SITE_URL}), který provozuje {OP}, IČO {OP_ID}, se sídlem {OP_ADDR} (dále „provozovatel“).</p>
        <h2>1. Co je {SITE_NAME}</h2>
        <p>{SITE_NAME} je srovnávač cen ojetých vozidel. Zobrazujeme přehled inzerátů zveřejněných na jiných webech (např. bazarech a autobazarech), z jejich textu automaticky rozpoznáváme parametry vozu a porovnáváme ceny. Nejsme prodejcem ani zprostředkovatelem prodeje vozidel a nejsme stranou smlouvy mezi kupujícím a prodejcem.</p>
        <h2>2. Přesnost údajů</h2>
        <p>Údaje o vozech (rok výroby, nájezd, stav, výkon apod.) získáváme automaticky z textu inzerátů a mohou obsahovat chyby. Tržní cena a hodnocení ceny jsou jen orientační statistický odhad. Před koupí si vždy ověřte všechny údaje přímo u prodejce, ideálně i prohlídkou vozu a prověrkou jeho historie.</p>
        <h2>3. Odkazy na weby třetích stran</h2>
        <p>Kliknutím na „Zobrazit inzerát“ přejdete na web třetí strany. Za obsah inzerátů, jejich pravdivost a za jednání prodejců odpovídají jejich autoři a provozovatelé zdrojových webů.</p>
        <h2>4. Uživatelský účet</h2>
        <ul>
          <li>Registrace je zdarma. Při registraci uveďte pravdivý e-mail a heslo chraňte.</li>
          <li>Účet můžete kdykoli zrušit v nastavení účtu.</li>
          <li>Provozovatel může účet zablokovat, pokud je zneužíván (např. automatizované stahování dat, spam, falešná nahlášení).</li>
        </ul>
        <h2>5. Zakázané užití</h2>
        <p>Není dovoleno web automatizovaně stahovat, přetěžovat, obcházet technická omezení ani používat obsah k budování konkurenčních databází bez souhlasu provozovatele.</p>
        <h2>6. Pro prodejce a zdrojové weby</h2>
        <p>Pokud jste autorem inzerátu nebo provozovatelem zdrojového webu a nesouhlasíte se zobrazením, napište na {CONTACT_EMAIL}. Inzerát nebo zdroj bez zbytečného odkladu odstraníme. Autobazary mohou svou nabídku posílat přes XML feed (více v sekci O nás).</p>
        <h2>7. Odpovědnost</h2>
        <p>Provozovatel neodpovídá za škodu vzniklou v souvislosti s nákupem vozidla nebo spoléháním na automaticky rozpoznané údaje, v rozsahu, v jakém to umožňují právní předpisy.</p>
        <h2>8. Závěrečná ustanovení</h2>
        <p>Provozovatel může podmínky měnit; o podstatných změnách informuje registrované uživatele. Vztahy se řídí právem České republiky, pokud kogentní předpisy nestanoví jinak. Kontakt: {CONTACT_EMAIL}.</p>
      </>
    ),
  };
}

export function privacy(locale: Locale): Doc {
  if (locale === "sk")
    return {
      title: "Ochrana osobných údajov",
      body: (
        <>
          <p>Platné od {UPDATED}. Prevádzkovateľ {OP}, IČO {OP_ID}, {OP_ADDR}, je prevádzkovateľom osobných údajov podľa nariadenia (EÚ) 2016/679 (GDPR). Kontakt: {CONTACT_EMAIL}.</p>
          <h2>Aké údaje spracúvame a prečo</h2>
          <ul>
            <li><b>Účet:</b> e-mail, meno (nepovinné), heslo v zašifrovanej podobe (hash), jazyk, dátum registrácie a posledného prihlásenia. Účel: vedenie účtu. Právny základ: plnenie zmluvy (čl. 6 ods. 1 písm. b).</li>
            <li><b>Obľúbené autá a uložené hľadania:</b> na poskytovanie funkcií účtu a upozornení. Právny základ: plnenie zmluvy.</li>
            <li><b>Nahlásenia inzerátov:</b> dôvod, text a prípadne ID účtu. Právny základ: oprávnený záujem na kvalite obsahu.</li>
            <li><b>Technické údaje:</b> IP adresa a záznamy servera na zabezpečenie a ochranu pred zneužitím, uchovávané najviac 30 dní. Právny základ: oprávnený záujem.</li>
          </ul>
          <h2>Údaje z inzerátov</h2>
          <p>Zobrazujeme verejne dostupné inzeráty vozidiel. Neukladáme telefónne čísla ani e-maily predajcov; na kontakt slúži zdrojový web. Ak inzerát obsahuje vaše osobné údaje a chcete ho odstrániť, napíšte nám.</p>
          <h2>Ako dlho údaje uchovávame</h2>
          <p>Údaje účtu do jeho zrušenia. Po zrušení účtu ich vymažeme bez zbytočného odkladu, okrem údajov, ktoré musíme uchovať zo zákona.</p>
          <h2>Príjemcovia</h2>
          <p>Poskytovateľ hostingu a e-mailových služieb ako sprostredkovatelia. Ak je zapnutá funkcia automatického rozpoznávania pomocou AI, text verejných inzerátov (nie údaje o používateľoch) môže byť spracovaný poskytovateľom AI služby.</p>
          <h2>Vaše práva</h2>
          <p>Máte právo na prístup, opravu, vymazanie, obmedzenie spracúvania, prenosnosť a námietku. Export dát a zrušenie účtu nájdete priamo v nastaveniach účtu. Sťažnosť môžete podať Úradu na ochranu osobných údajov SR.</p>
        </>
      ),
    };
  return {
    title: "Ochrana osobních údajů",
    body: (
      <>
        <p>Platné od {UPDATED}. Provozovatel {OP}, IČO {OP_ID}, {OP_ADDR}, je správcem osobních údajů podle nařízení (EU) 2016/679 (GDPR). Kontakt: {CONTACT_EMAIL}.</p>
        <h2>Jaké údaje zpracováváme a proč</h2>
        <ul>
          <li><b>Účet:</b> e-mail, jméno (nepovinné), heslo v zašifrované podobě (hash), jazyk, datum registrace a posledního přihlášení. Účel: vedení účtu. Právní základ: plnění smlouvy (čl. 6 odst. 1 písm. b).</li>
          <li><b>Oblíbená auta a uložená hledání:</b> pro poskytování funkcí účtu a upozornění. Právní základ: plnění smlouvy.</li>
          <li><b>Nahlášení inzerátů:</b> důvod, text a případně ID účtu. Právní základ: oprávněný zájem na kvalitě obsahu.</li>
          <li><b>Technické údaje:</b> IP adresa a záznamy serveru pro zabezpečení a ochranu proti zneužití, uchovávané nejvýše 30 dní. Právní základ: oprávněný zájem.</li>
        </ul>
        <h2>Údaje z inzerátů</h2>
        <p>Zobrazujeme veřejně dostupné inzeráty vozidel. Neukládáme telefonní čísla ani e-maily prodejců; ke kontaktu slouží zdrojový web. Pokud inzerát obsahuje vaše osobní údaje a chcete ho odstranit, napište nám.</p>
        <h2>Jak dlouho údaje uchováváme</h2>
        <p>Údaje účtu do jeho zrušení. Po zrušení účtu je bez zbytečného odkladu smažeme, kromě údajů, které musíme uchovat ze zákona.</p>
        <h2>Příjemci</h2>
        <p>Poskytovatel hostingu a e-mailových služeb jako zpracovatelé. Pokud je zapnuté automatické rozpoznávání pomocí AI, text veřejných inzerátů (ne údaje o uživatelích) může zpracovat poskytovatel AI služby.</p>
        <h2>Vaše práva</h2>
        <p>Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost a vznést námitku. Export dat a zrušení účtu najdete přímo v nastavení účtu. Stížnost můžete podat Úřadu pro ochranu osobních údajů.</p>
      </>
    ),
  };
}

export function cookiesDoc(locale: Locale): Doc {
  const rows = [
    ["sid", locale === "sk" ? "Prihlásenie (nevyhnutné)" : "Přihlášení (nezbytné)", locale === "sk" ? "30 dní" : "30 dní"],
    ["locale", locale === "sk" ? "Zvolený jazyk (nevyhnutné)" : "Zvolený jazyk (nezbytné)", "1 rok"],
    ["consent", locale === "sk" ? "Vaša voľba cookies (nevyhnutné)" : "Vaše volba cookies (nezbytné)", "180 dní"],
  ];
  const table = (
    <table className="my-4 w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase text-muted">
          <th className="py-2">Cookie</th>
          <th>{locale === "sk" ? "Účel" : "Účel"}</th>
          <th>{locale === "sk" ? "Platnosť" : "Platnost"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]} className="border-t border-line">
            <td className="py-2 font-mono">{r[0]}</td>
            <td>{r[1]}</td>
            <td>{r[2]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (locale === "sk")
    return {
      title: "Zásady používania cookies",
      body: (
        <>
          <p>Cookies sú malé súbory, ktoré web ukladá vo vašom prehliadači. {SITE_NAME} používa iba nevyhnutné cookies, bez ktorých by nefungovalo prihlásenie a zapamätanie volieb. Na tie nepotrebujeme súhlas.</p>
          {table}
          <p>V lokálnom úložisku prehliadača (localStorage) si pamätáme zoznam áut na porovnanie. Neopúšťa váš prehliadač.</p>
          <h2>Analytické a marketingové cookies</h2>
          <p>Momentálne žiadne nepoužívame. Ak ich v budúcnosti zavedieme, budú aktívne len s vaším súhlasom, ktorý môžete kedykoľvek odvolať zmazaním cookies v prehliadači.</p>
        </>
      ),
    };
  return {
    title: "Zásady používání cookies",
    body: (
      <>
        <p>Cookies jsou malé soubory, které web ukládá ve vašem prohlížeči. {SITE_NAME} používá jen nezbytné cookies, bez kterých by nefungovalo přihlášení a zapamatování voleb. K těm nepotřebujeme souhlas.</p>
        {table}
        <p>V lokálním úložišti prohlížeče (localStorage) si pamatujeme seznam aut k porovnání. Neopouští váš prohlížeč.</p>
        <h2>Analytické a marketingové cookies</h2>
        <p>Momentálně žádné nepoužíváme. Pokud je v budoucnu zavedeme, budou aktivní jen s vaším souhlasem, který můžete kdykoli odvolat smazáním cookies v prohlížeči.</p>
      </>
    ),
  };
}

export const CREATOR = { name: "Nikolas Malík", url: "https://malikweb.eu" };

export function about(locale: Locale): Doc {
  const feed = `<CARS>
  <CAR>
    <ID>12345</ID>
    <URL>https://vas-bazar.cz/vuz/12345</URL>
    <TITLE>Škoda Octavia Combi 2.0 TDI DSG</TITLE>
    <DESCRIPTION>…</DESCRIPTION>
    <PRICE>289000</PRICE>
    <CURRENCY>CZK</CURRENCY>
    <MAKE>Škoda</MAKE>
    <MODEL>Octavia</MODEL>
    <YEAR>2018</YEAR>
    <MILEAGE>154000</MILEAGE>
    <FUEL>diesel</FUEL>            <!-- petrol|diesel|lpg|cng|hybrid|plugin_hybrid|electric -->
    <TRANSMISSION>automatic</TRANSMISSION>
    <POWER_KW>110</POWER_KW>
    <CONDITION>ok</CONDITION>     <!-- ok|damaged|non_running|parts -->
    <VAT_DEDUCTIBLE>1</VAT_DEDUCTIBLE>
    <IMAGE>https://vas-bazar.cz/foto/12345-1.jpg</IMAGE>
    <LOCATION>Brno</LOCATION>
    <POSTAL_CODE>60200</POSTAL_CODE>
  </CAR>
</CARS>`;
  const sk = locale === "sk";
  return {
    title: sk ? "O nás a pre partnerov" : "O nás a pro partnery",
    body: (
      <>
        <p>
          {sk
            ? `${SITE_NAME} pomáha nájsť jazdené auto za férovú cenu. Inzeráty z viacerých webov zobrazujeme na jednom mieste, z textu rozpoznávame dôležité parametre a každé auto porovnávame s podobnými vozidlami.`
            : `${SITE_NAME} pomáhá najít ojeté auto za férovou cenu. Inzeráty z více webů zobrazujeme na jednom místě, z textu rozpoznáváme důležité parametry a každé auto srovnáváme s podobnými vozy.`}
        </p>
        <h2>{sk ? "Autor" : "Autor"}</h2>
        <p>
          {sk ? "Web vytvoril " : "Web vytvořil "}
          <strong>{CREATOR.name}</strong>
          {sk ? ". Viac o jeho práci nájdete na " : ". Více o jeho práci najdete na "}
          <a href={CREATOR.url} rel="author noopener" target="_blank">
            {CREATOR.url.replace(/^https:\/\//, "")}
          </a>
          .
        </p>
        <h2>{sk ? "Ako počítame trhovú cenu" : "Jak počítáme tržní cenu"}</h2>
        <p>
          {sk
            ? "Pre každé auto hľadáme porovnateľné pojazdné vozidlá: rovnaká značka, model a palivo, rok výroby ±1 a podobný nájazd. Trhová cena je medián ich cien. Búrané, nepojazdné autá a autá na diely do mediánu nezapočítavame."
            : "Pro každé auto hledáme srovnatelné pojízdné vozy: stejná značka, model a palivo, rok výroby ±1 a podobný nájezd. Tržní cena je medián jejich cen. Bourané, nepojízdné vozy a auta na díly do mediánu nezapočítáváme."}
        </p>
        <h2>{sk ? "Pre autobazáry: XML feed" : "Pro autobazary: XML feed"}</h2>
        <p>
          {sk
            ? `Pošlite nám URL svojho XML feedu na ${CONTACT_EMAIL}. Feed načítavame pravidelne a autá, ktoré z neho zmiznú, hneď skryjeme. Formát:`
            : `Pošlete nám URL svého XML feedu na ${CONTACT_EMAIL}. Feed načítáme pravidelně a auta, která z něj zmizí, hned skryjeme. Formát:`}
        </p>
        <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{feed}</pre>
        <h2>{sk ? "Odstránenie inzerátu" : "Odstranění inzerátu"}</h2>
        <p>{sk ? `Napíšte na ${CONTACT_EMAIL} alebo použite „Nahlásiť chybný inzerát“ priamo pri inzeráte.` : `Napište na ${CONTACT_EMAIL} nebo použijte „Nahlásit chybný inzerát“ přímo u inzerátu.`}</p>
      </>
    ),
  };
}
