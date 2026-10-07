/**
 * Bazoš (auto.bazos.cz / auto.bazos.sk) adapter.
 *
 * Bazoš has no public listing API for third parties. This adapter reads the public category pages
 * (allowed by robots.txt for generic crawlers) and, for new listings, the detail page. It must stay
 * disabled until the operator has Bazoš's consent: their terms forbid unauthorised automated use.
 *
 * HTML structure (category page):
 *   div.inzeraty
 *     div.inzeratynadpis > a[href=/inzerat/<id>/<slug>.php] > img.obrazek
 *     h2.nadpis > a                       title
 *     span.velikost10                     " - [7.10. 2026]"  (TOP listings also show "TOP")
 *     div.popis                           teaser text
 *     div.inzeratycena                    "125 000 Kč" / "Dohodou" / "V textu"
 *     div.inzeratylok                     "Praha<br>140 00"
 * Detail page: h1.nadpis, div.popisdetail, table with "Cena:" row, img.carousel-cell-image / div.flinavigace img
 */
import * as cheerio from "cheerio";
import { politeFetch } from "../http";
import type { CheckResult, CrawlContext, RawListing, SourceAdapter } from "../types";

type BazosConfig = {
  host: string; // e.g. https://auto.bazos.cz
  currency: "CZK" | "EUR";
  maxPages?: number;
  pageSize?: number;
  minDelayMs?: number;
  /** Stop paging after this many consecutive already-known listings */
  stopAfterKnown?: number;
};

export function parseBazosPrice(raw: string): number | null {
  const digits = raw.replace(/\s|&nbsp;/g, "").match(/(\d+)(?:[.,]-)?\s*(kč|kc|€|eur)?/i);
  if (!digits) return null;
  const n = Number(digits[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseBazosDate(raw: string): Date | null {
  const mm = /\[(\d{1,2})\.(\d{1,2})\.\s*(\d{4})\]/.exec(raw);
  if (!mm) return null;
  return new Date(Date.UTC(Number(mm[3]), Number(mm[2]) - 1, Number(mm[1]), 8));
}

export function parseBazosCategoryPage(html: string, host: string, currency: "CZK" | "EUR"): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  $("div.inzeraty").each((_, el) => {
    const row = $(el);
    const a = row.find("h2.nadpis a").first();
    const href = a.attr("href");
    if (!href) return;
    const idMatch = /\/inzerat\/(\d+)\//.exec(href);
    if (!idMatch) return;
    const url = new URL(href, host).toString();
    const loc = row.find("div.inzeratylok");
    const locParts = (loc.html() ?? "")
      .split(/<br\s*\/?>/i)
      .map((s) => cheerio.load(s).text().trim())
      .filter(Boolean);
    const img = row.find("img.obrazek").attr("src") ?? null;
    out.push({
      externalId: idMatch[1],
      url,
      title: a.text().trim(),
      description: row.find("div.popis").text().trim(),
      price: parseBazosPrice(row.find("div.inzeratycena").text()),
      currency,
      location: locParts[0] ?? null,
      postalCode: locParts[1]?.replace(/\s/g, "") ?? null,
      imageUrl: img ? new URL(img, host).toString() : null,
      postedAt: parseBazosDate(row.find("span.velikost10").text()),
      partial: true,
    });
  });
  return out;
}

export function parseBazosDetail(html: string, url: string, currency: "CZK" | "EUR"): RawListing | null {
  const $ = cheerio.load(html);
  const title = $("h1.nadpis").first().text().trim();
  if (!title) return null;
  const idMatch = /\/inzerat\/(\d+)\//.exec(url);
  let priceText = "";
  let location: string | null = null;
  $("table tr").each((_, tr) => {
    const label = $(tr).find("td").first().text().trim().toLowerCase();
    const value = $(tr).find("td").eq(1).text().trim();
    if (label.startsWith("cena")) priceText = value;
    if (label.startsWith("lokalita")) location = value.replace(/\s+/g, " ");
  });
  const img = $("img.carousel-cell-image").first().attr("data-flickity-lazyload") ?? $("img.carousel-cell-image").first().attr("src") ?? $("div.flinavigace img").first().attr("src");
  return {
    externalId: idMatch?.[1] ?? url,
    url,
    title,
    description: $("div.popisdetail").text().trim(),
    price: parseBazosPrice(priceText),
    currency,
    location,
    imageUrl: img ? new URL(img, url).toString() : null,
    postedAt: parseBazosDate($("span.velikost10").first().text()),
  };
}

const REMOVED_MARKERS = /(inzer[aá]t (byl )?(vymaz|smaz|odstr)|inzer[aá]t neexistuje|inzer[aá]t bol (vymaz|zmaz)|neexistuj[eí]c[ií] inzer[aá]t)/i;

export function bazosAdapter(): SourceAdapter {
  return {
    async *crawl(ctx: CrawlContext) {
      const cfg = ctx.source.config as unknown as BazosConfig;
      const host = cfg.host ?? ctx.source.baseUrl;
      const pageSize = cfg.pageSize ?? 20;
      const maxPages = cfg.maxPages ?? 25;
      const stopAfterKnown = cfg.stopAfterKnown ?? 60;
      let consecutiveKnown = 0;
      for (let page = 0; page < maxPages; page++) {
        const url = page === 0 ? `${host}/` : `${host}/${page * pageSize}/`;
        const res = await politeFetch(url, { minDelayMs: cfg.minDelayMs ?? 3000 });
        if (!res.ok) {
          ctx.log(`page ${url} -> HTTP ${res.status}, stopping`);
          break;
        }
        const items = parseBazosCategoryPage(res.body, host, cfg.currency ?? "CZK");
        ctx.log(`page ${page + 1}: ${items.length} listings`);
        if (!items.length) break;
        for (const item of items) {
          if (await ctx.isKnown(item.externalId)) consecutiveKnown++;
          else consecutiveKnown = 0;
          yield item;
        }
        // Listing pages are sorted newest-first (TOP ads aside); once we only see known ads we've caught up
        if (consecutiveKnown >= stopAfterKnown) {
          ctx.log(`caught up after ${page + 1} pages`);
          break;
        }
      }
    },
    async check(ctx, listing): Promise<CheckResult> {
      const cfg = ctx.source.config as unknown as BazosConfig;
      const res = await politeFetch(listing.url, { minDelayMs: cfg.minDelayMs ?? 3000 });
      if (res.status === 404 || res.status === 410) return { status: "removed" };
      if (!res.ok) return { status: "unknown" };
      if (REMOVED_MARKERS.test(res.body)) return { status: "removed" };
      // Bazoš redirects removed ads to the category page
      if (!/\/inzerat\/\d+\//.test(res.url)) return { status: "removed" };
      const detail = parseBazosDetail(res.body, listing.url, cfg.currency ?? "CZK");
      return detail ? { status: "active", listing: detail } : { status: "unknown" };
    },
  };
}
