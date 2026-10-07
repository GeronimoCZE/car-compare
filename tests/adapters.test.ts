import { describe, expect, it } from "vitest";
import { parseBazosCategoryPage, parseBazosDetail } from "@/ingest/sources/bazos";
import { parseAutofeed, parseRss } from "@/ingest/sources/feed";
import { parseJsonLdPage } from "@/ingest/sources/jsonld";
import { computeMarket } from "@/ingest/market";

const BAZOS_LIST = `
<div class="inzeraty inzeratyflex">
  <div class="inzeratynadpis"><a href="/inzerat/190123456/skoda-octavia-combi.php"><img src="https://www.bazos.cz/img/1t/456/190123456.jpg" class="obrazek"></a>
  <h2 class="nadpis"><a href="/inzerat/190123456/skoda-octavia-combi.php">Škoda Octavia Combi 2.0 TDI</a></h2>
  <span class="velikost10"> - [5.10. 2026]</span><br>
  <div class="popis">Rok výroby 2016, najeto 180 000 km, nehavarované...</div></div>
  <div class="inzeratycena"><b><span translate="no">215 000 Kč</span></b></div>
  <div class="inzeratylok">Brno<br>602 00</div>
</div>
<div class="inzeraty inzeratyflex">
  <h2 class="nadpis"><a href="/inzerat/190123457/golf.php">VW Golf 1.4</a></h2>
  <div class="inzeratycena"><b>Dohodou</b></div>
</div>`;

describe("bazos adapter", () => {
  it("parses category pages", () => {
    const items = parseBazosCategoryPage(BAZOS_LIST, "https://auto.bazos.cz", "CZK");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: "190123456",
      url: "https://auto.bazos.cz/inzerat/190123456/skoda-octavia-combi.php",
      title: "Škoda Octavia Combi 2.0 TDI",
      price: 215000,
      location: "Brno",
      postalCode: "60200",
      partial: true,
    });
    expect(items[0].postedAt?.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(items[1].price).toBeNull();
  });
  it("parses detail pages", () => {
    const html = `<h1 class="nadpis">Škoda Octavia</h1><div class="popisdetail">Celý popis</div>
      <table><tr><td>Cena:</td><td><b>215 000 Kč</b></td></tr><tr><td>Lokalita:</td><td>602 00 Brno</td></tr></table>`;
    const d = parseBazosDetail(html, "https://auto.bazos.cz/inzerat/190123456/x.php", "CZK");
    expect(d).toMatchObject({ externalId: "190123456", title: "Škoda Octavia", description: "Celý popis", price: 215000 });
  });
});

describe("feeds", () => {
  it("parses our XML feed", () => {
    const xml = `<CARS><CAR><ID>1</ID><URL>https://x.cz/1</URL><TITLE>Combi 2.0 TDI DSG</TITLE><PRICE>289000</PRICE><CURRENCY>CZK</CURRENCY>
      <MAKE>Škoda</MAKE><MODEL>Octavia</MODEL><YEAR>2018</YEAR><MILEAGE>154000</MILEAGE><FUEL>diesel</FUEL><CONDITION>ok</CONDITION><VAT_DEDUCTIBLE>1</VAT_DEDUCTIBLE></CAR></CARS>`;
    const [c] = parseAutofeed(xml, "CZK");
    expect(c.title).toBe("Škoda Octavia Combi 2.0 TDI DSG");
    expect(c.hints).toMatchObject({ year: 2018, mileageKm: 154000, fuel: "diesel", condition: "ok", vatDeductible: true, seller: "dealer" });
  });
  it("parses RSS", () => {
    const xml = `<rss><channel><item><title>Fabia 1.2 - 89 000 Kč</title><link>https://x.cz/a</link><guid>a</guid><description>&lt;b&gt;r.v. 2012&lt;/b&gt;</description></item></channel></rss>`;
    const [i] = parseRss(xml, "CZK");
    expect(i).toMatchObject({ externalId: "a", price: 89000, description: "r.v. 2012" });
  });
});

describe("json-ld adapter", () => {
  it("reads schema.org Car", () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Car","name":"Octavia 2.0 TDI","brand":{"@type":"Brand","name":"Škoda"},
      "vehicleModelDate":"2017","mileageFromOdometer":{"value":120000,"unitCode":"KMT"},"fuelType":"Diesel","vehicleTransmission":"Automatic",
      "offers":{"@type":"Offer","price":"250000","priceCurrency":"CZK","availability":"https://schema.org/InStock"}}</script>`;
    const r = parseJsonLdPage(html, "https://x.cz/detail/1", "CZK")!;
    expect(r.title).toBe("Škoda Octavia 2.0 TDI");
    expect(r.price).toBe(250000);
    expect(r.hints).toMatchObject({ year: 2017, mileageKm: 120000, fuel: "diesel", transmission: "automatic" });
    expect(r.soldOut).toBe(false);
  });
});

describe("market comparison", () => {
  it("compares against drivable peers of similar year and mileage", () => {
    const base = { make: "skoda", model: "octavia", fuel: "diesel", condition: "ok", clusterKey: null };
    const rows = [
      ...[200, 210, 190, 205, 195].map((p, i) => ({ ...base, id: i + 1, year: 2016, mileageKm: 180000, priceCzk: p * 1000 })),
      { ...base, id: 99, year: 2016, mileageKm: 175000, priceCzk: 160000 },
      { ...base, id: 100, year: 2016, mileageKm: 180000, priceCzk: 50000, condition: "non_running" },
    ];
    const res = computeMarket(rows);
    const cheap = res.find((r) => r.id === 99)!;
    expect(cheap.median).toBe(200000);
    expect(cheap.score).toBeCloseTo(0.8, 2);
    // A wreck never lowers the median for drivable cars
    expect(res.find((r) => r.id === 1)!.median).toBeGreaterThanOrEqual(195000);
  });
});
