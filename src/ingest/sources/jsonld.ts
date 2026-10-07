/**
 * Generic adapter for marketplaces that publish a sitemap and schema.org structured data
 * (JSON-LD `Car` / `Vehicle` / `Product` with an `Offer`) on their detail pages. Most dealer
 * portals do this for Google, so one adapter covers many sites with only configuration:
 *
 *   { "sitemapUrls": ["https://example.cz/sitemap.xml"], "urlPattern": "/detail/\\d+", "currency": "CZK" }
 *
 * robots.txt is honoured by the HTTP client, so a site that disallows crawling simply yields nothing.
 */
import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import type { Fuel, ParsedAttributes, Transmission } from "@/parser/extract";
import { politeFetch, RobotsDisallowedError } from "../http";
import type { CheckResult, CrawlContext, RawListing, SourceAdapter } from "../types";

type JsonLdConfig = {
  sitemapUrls: string[];
  urlPattern: string;
  currency?: "CZK" | "EUR";
  maxDetailPerRun?: number;
  minDelayMs?: number;
};

const xml = new XMLParser({ ignoreAttributes: true });

type SitemapEntry = { loc: string; lastmod?: string };

async function readSitemap(url: string, ctx: CrawlContext, depth = 0): Promise<SitemapEntry[]> {
  const res = await politeFetch(url, { accept: "application/xml,text/xml,*/*" });
  if (!res.ok) {
    ctx.log(`sitemap ${url} -> HTTP ${res.status}`);
    return [];
  }
  const doc = xml.parse(res.body);
  if (doc.sitemapindex && depth < 2) {
    const maps = [doc.sitemapindex.sitemap].flat().filter(Boolean) as SitemapEntry[];
    const out: SitemapEntry[] = [];
    for (const m of maps) out.push(...(await readSitemap(m.loc, ctx, depth + 1)));
    return out;
  }
  return ([doc.urlset?.url].flat().filter(Boolean) as SitemapEntry[]).map((u) => ({ loc: String(u.loc), lastmod: u.lastmod }));
}

type Json = Record<string, unknown>;
const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);

function findVehicle(nodes: Json[]): Json | null {
  const flat: Json[] = [];
  for (const n of nodes) {
    flat.push(n);
    for (const g of asArray(n["@graph"] as Json[])) flat.push(g);
  }
  const isType = (n: Json, t: string[]) => asArray(n["@type"] as string | string[]).some((x) => t.includes(String(x)));
  return flat.find((n) => isType(n, ["Car", "Vehicle", "MotorizedBicycle"])) ?? flat.find((n) => isType(n, ["Product"]) && n.offers) ?? null;
}

function mapFuel(v: string | undefined): Fuel | undefined {
  if (!v) return undefined;
  const s = v.toLowerCase();
  if (/plug/.test(s)) return "plugin_hybrid";
  if (/hybrid/.test(s)) return "hybrid";
  if (/elektr|electric/.test(s)) return "electric";
  if (/diesel|nafta/.test(s)) return "diesel";
  if (/lpg/.test(s)) return "lpg";
  if (/cng/.test(s)) return "cng";
  if (/benz|petrol|gasoline/.test(s)) return "petrol";
  return undefined;
}

function mapTransmission(v: string | undefined): Transmission | undefined {
  if (!v) return undefined;
  if (/auto/i.test(v)) return "automatic";
  if (/manu/i.test(v)) return "manual";
  return undefined;
}

export function parseJsonLdPage(html: string, url: string, currency: "CZK" | "EUR"): (RawListing & { soldOut?: boolean }) | null {
  const $ = cheerio.load(html);
  const nodes: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      nodes.push(...asArray(JSON.parse($(el).text()) as Json | Json[]));
    } catch {
      /* malformed JSON-LD is common; ignore */
    }
  });
  const v = findVehicle(nodes);
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (!v && !ogTitle) return null;

  const offer = asArray((v?.offers ?? null) as Json | Json[])[0] ?? {};
  const price = Number(str(offer.price) ?? str((offer.priceSpecification as Json | undefined)?.price) ?? $('meta[property="product:price:amount"]').attr("content"));
  const priceCurrency = (str(offer.priceCurrency) ?? $('meta[property="product:price:currency"]').attr("content") ?? currency).toUpperCase();
  const availability = str(offer.availability) ?? "";
  const brand = v?.brand as Json | string | undefined;
  const brandName = typeof brand === "string" ? brand : str(brand?.name);
  const model = str(v?.model);
  const yearRaw = str(v?.vehicleModelDate) ?? str(v?.productionDate) ?? str(v?.dateVehicleFirstRegistered);
  const odometer = v?.mileageFromOdometer as Json | undefined;
  const engine = asArray(v?.vehicleEngine as Json | Json[])[0];
  const enginePower = asArray(engine?.enginePower as Json | Json[])[0];
  let powerKw: number | undefined;
  if (enginePower?.value) {
    const val = Number(enginePower.value);
    powerKw = /hp|ps|bhp/i.test(String(enginePower.unitCode ?? enginePower.unitText ?? "")) ? Math.round(val * 0.7355) : val;
  }
  const images = asArray(v?.image as string | string[] | Json);
  const firstImage = typeof images[0] === "string" ? images[0] : str((images[0] as Json | undefined)?.url);
  const address = ((offer.availableAtOrFrom as Json | undefined)?.address ?? (offer.seller as Json | undefined)?.address) as Json | undefined;

  const hints: Partial<ParsedAttributes> = {};
  const y = yearRaw ? Number(/\d{4}/.exec(yearRaw)?.[0]) : NaN;
  if (y > 1950) hints.year = y;
  if (odometer?.value) hints.mileageKm = Math.round(Number(odometer.value));
  const fuel = mapFuel(str(v?.fuelType) ?? str(engine?.fuelType));
  if (fuel) hints.fuel = fuel;
  const tr = mapTransmission(str(v?.vehicleTransmission));
  if (tr) hints.transmission = tr;
  if (powerKw && powerKw > 10) hints.powerKw = powerKw;

  const name = str(v?.name) ?? ogTitle ?? "";
  // Prefix structured make/model so the parser resolves them even if the title omits them
  const title = [brandName && !name.toLowerCase().includes(brandName.toLowerCase()) ? brandName : null, model && !name.toLowerCase().includes(model.toLowerCase()) ? model : null, name]
    .filter(Boolean)
    .join(" ");

  return {
    externalId: str(v?.sku) ?? str(v?.productID) ?? str(v?.vehicleIdentificationNumber) ?? new URL(url).pathname,
    url,
    title,
    description: str(v?.description) ?? $('meta[property="og:description"]').attr("content") ?? "",
    price: Number.isFinite(price) && price > 0 ? price : null,
    currency: priceCurrency === "EUR" ? "EUR" : "CZK",
    location: str(address?.addressLocality) ?? null,
    postalCode: str(address?.postalCode)?.replace(/\s/g, "") ?? null,
    imageUrl: firstImage ?? $('meta[property="og:image"]').attr("content") ?? null,
    hints,
    soldOut: /SoldOut|OutOfStock|Discontinued/i.test(availability),
  };
}

export function jsonLdAdapter(): SourceAdapter {
  return {
    async *crawl(ctx) {
      const cfg = ctx.source.config as unknown as JsonLdConfig;
      const pattern = new RegExp(cfg.urlPattern);
      const entries: SitemapEntry[] = [];
      for (const sm of cfg.sitemapUrls ?? []) {
        try {
          entries.push(...(await readSitemap(sm, ctx)));
        } catch (err) {
          ctx.log(`sitemap ${sm} failed: ${(err as Error).message}`);
          if (err instanceof RobotsDisallowedError) return;
        }
      }
      const candidates = entries
        .filter((e) => pattern.test(e.loc))
        .sort((a, b) => String(b.lastmod ?? "").localeCompare(String(a.lastmod ?? "")));
      ctx.log(`${candidates.length} listing URLs in sitemaps`);
      let fetched = 0;
      for (const entry of candidates) {
        if (fetched >= (cfg.maxDetailPerRun ?? 300)) break;
        const id = new URL(entry.loc).pathname;
        if (await ctx.isKnown(id)) continue;
        try {
          const res = await politeFetch(entry.loc, { minDelayMs: cfg.minDelayMs ?? 2000 });
          fetched++;
          if (!res.ok) continue;
          const item = parseJsonLdPage(res.body, entry.loc, cfg.currency ?? "CZK");
          if (item && !item.soldOut) yield { ...item, externalId: id };
        } catch (err) {
          if (err instanceof RobotsDisallowedError) continue;
          ctx.log(`detail ${entry.loc} failed: ${(err as Error).message}`);
        }
      }
    },
    async check(ctx, listing): Promise<CheckResult> {
      const cfg = ctx.source.config as unknown as JsonLdConfig;
      const res = await politeFetch(listing.url, { minDelayMs: cfg.minDelayMs ?? 2000 });
      if (res.status === 404 || res.status === 410) return { status: "removed" };
      if (!res.ok) return { status: "unknown" };
      const item = parseJsonLdPage(res.body, listing.url, cfg.currency ?? "CZK");
      if (!item) return { status: "removed" };
      if (item.soldOut) return { status: "removed" };
      return { status: "active", listing: { ...item, externalId: listing.externalId } };
    },
  };
}
