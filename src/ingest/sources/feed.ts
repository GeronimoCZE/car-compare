/**
 * Feed adapter: the legitimate, Heureka-style way to get listings. A dealer or marketplace gives us
 * a feed URL and we read it on a schedule. Two formats:
 *
 *  - "autofeed": our own XML format (documented in docs/feed-spec.md), a full snapshot of the
 *    partner's current stock. Listings missing from the snapshot are marked removed right away.
 *  - "rss": RSS 2.0 (e.g. saved-search feeds). Not a snapshot; removal is detected by the
 *    liveness checker instead.
 */
import { XMLParser } from "fast-xml-parser";
import type { Condition, Fuel, ParsedAttributes, Transmission } from "@/parser/extract";
import { politeFetch } from "../http";
import type { CrawlContext, RawListing, SourceAdapter } from "../types";

type FeedConfig = {
  feedUrl: string;
  format: "autofeed" | "rss";
  currency?: "CZK" | "EUR";
  /** Partner feeds are fetched with explicit permission, so robots.txt may be skipped */
  partner?: boolean;
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });
const text = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"]);
  return String(v);
};
const num = (v: unknown): number | undefined => {
  const s = text(v)?.replace(/\s/g, "").replace(",", ".");
  const n = s ? Number(s) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const FUELS: Fuel[] = ["petrol", "diesel", "lpg", "cng", "hybrid", "plugin_hybrid", "electric"];
const CONDITIONS: Condition[] = ["ok", "damaged", "non_running", "parts"];

export function parseAutofeed(xmlText: string, defaultCurrency: "CZK" | "EUR"): RawListing[] {
  const doc = parser.parse(xmlText);
  const cars = [doc?.CARS?.CAR].flat().filter(Boolean) as Record<string, unknown>[];
  return cars.map((c) => {
    const hints: Partial<ParsedAttributes> = {};
    const year = num(c.YEAR);
    if (year) hints.year = year;
    const km = num(c.MILEAGE);
    if (km != null) hints.mileageKm = km;
    const fuel = text(c.FUEL)?.toLowerCase() as Fuel | undefined;
    if (fuel && FUELS.includes(fuel)) hints.fuel = fuel;
    const tr = text(c.TRANSMISSION)?.toLowerCase() as Transmission | undefined;
    if (tr === "manual" || tr === "automatic") hints.transmission = tr;
    const kw = num(c.POWER_KW);
    if (kw) hints.powerKw = kw;
    const cond = text(c.CONDITION)?.toLowerCase() as Condition | undefined;
    if (cond && CONDITIONS.includes(cond)) hints.condition = cond;
    if (text(c.VAT_DEDUCTIBLE) === "1") hints.vatDeductible = true;
    hints.seller = "dealer";
    const makeModel = [text(c.MAKE), text(c.MODEL)].filter(Boolean).join(" ");
    const title = text(c.TITLE) ?? makeModel;
    const currency = text(c.CURRENCY)?.toUpperCase() === "EUR" ? "EUR" : text(c.CURRENCY) ? "CZK" : defaultCurrency;
    return {
      externalId: text(c.ID) ?? text(c.URL) ?? title,
      url: text(c.URL) ?? "",
      title: makeModel && !title.toLowerCase().includes(String(text(c.MODEL) ?? "").toLowerCase()) ? `${makeModel} ${title}` : title,
      description: text(c.DESCRIPTION) ?? "",
      price: num(c.PRICE) ?? null,
      currency,
      location: text(c.LOCATION) ?? null,
      postalCode: text(c.POSTAL_CODE)?.replace(/\s/g, "") ?? null,
      imageUrl: text([c.IMAGE].flat()[0]) ?? null,
      hints,
    } satisfies RawListing;
  }).filter((l) => l.url);
}

export function parseRss(xmlText: string, currency: "CZK" | "EUR"): RawListing[] {
  const doc = parser.parse(xmlText);
  const items = [doc?.rss?.channel?.item].flat().filter(Boolean) as Record<string, unknown>[];
  return items.map((it) => {
    const link = text(it.link) ?? "";
    const desc = (text(it.description) ?? "").replace(/<[^>]+>/g, " ");
    const priceMatch = /(\d[\d\s.]*)\s*(kč|kc|€|eur)/i.exec(`${text(it.title)} ${desc}`);
    const enclosure = it.enclosure as Record<string, unknown> | undefined;
    return {
      externalId: text(it.guid) ?? link,
      url: link,
      title: text(it.title) ?? "",
      description: desc.trim(),
      price: priceMatch ? Number(priceMatch[1].replace(/[\s.]/g, "")) : null,
      currency: priceMatch && /€|eur/i.test(priceMatch[2]) ? "EUR" : currency,
      imageUrl: text(enclosure?.["@_url"]) ?? null,
      postedAt: it.pubDate ? new Date(String(it.pubDate)) : null,
    } satisfies RawListing;
  }).filter((l) => l.url && l.title);
}

export function feedAdapter(): SourceAdapter & { snapshot: (cfg: unknown) => boolean } {
  return {
    snapshot: (cfg) => (cfg as FeedConfig).format === "autofeed",
    async *crawl(ctx: CrawlContext) {
      const cfg = ctx.source.config as unknown as FeedConfig;
      const res = await politeFetch(cfg.feedUrl, { ignoreRobots: cfg.partner, accept: "application/xml,text/xml,application/rss+xml,*/*", minDelayMs: 0 });
      if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
      const items = cfg.format === "rss" ? parseRss(res.body, cfg.currency ?? "CZK") : parseAutofeed(res.body, cfg.currency ?? "CZK");
      ctx.log(`${items.length} items in feed`);
      yield* items;
    },
  };
}
