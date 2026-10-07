import { createHash } from "node:crypto";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, ingestRuns, listings, llmCache, priceHistory, settings, sources, type Listing, type Source } from "@/db";
import { parseListing, type ParseResult } from "@/parser/extract";
import { llmEnabled, llmExtract, mergeLlm, type LlmExtraction } from "@/parser/llm";
import { bazosAdapter } from "./sources/bazos";
import { demoAdapter } from "./sources/demo";
import { feedAdapter } from "./sources/feed";
import { jsonLdAdapter } from "./sources/jsonld";
import type { CrawlContext, RawListing, SourceAdapter } from "./types";

export function adapterFor(source: Source): (SourceAdapter & { snapshot?: (cfg: unknown) => boolean }) | null {
  switch ((source.config as { adapter?: string }).adapter) {
    case "bazos":
      return bazosAdapter();
    case "jsonld":
      return jsonLdAdapter();
    case "feed":
      return feedAdapter();
    case "demo":
      return demoAdapter();
    default:
      return null;
  }
}

export async function getEurRate(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "eur_czk") });
  const v = Number((row?.value as { rate?: number } | undefined)?.rate);
  return Number.isFinite(v) && v > 0 ? v : Number(process.env.EUR_CZK_RATE ?? 24.3);
}

const hashOf = (l: RawListing) => createHash("sha256").update(`${l.title}\n${l.description ?? ""}\n${l.price ?? ""}`).digest("hex");

export function clusterKeyFor(p: Pick<ParseResult, "make" | "model" | "year" | "mileageKm" | "fuel" | "kind">): string | null {
  // Same make/model/year/fuel and mileage rounded to 5 000 km: very likely the same car cross-posted
  if (p.kind !== "car" || !p.make || !p.model || !p.year || !p.mileageKm || p.mileageKm < 5000) return null;
  return `${p.make}|${p.model}|${p.year}|${p.fuel}|${Math.round(p.mileageKm / 5000)}`;
}

type RunStats = { fetched: number; created: number; updated: number; removed: number; errors: number; llmCalls: number };

async function cachedLlm(hash: string, title: string, description: string, stats: RunStats): Promise<LlmExtraction | null> {
  const cached = await db.query.llmCache.findFirst({ where: eq(llmCache.contentHash, hash) });
  if (cached) return cached.result as LlmExtraction;
  const max = Number(process.env.LLM_MAX_CALLS_PER_RUN ?? 200);
  if (!llmEnabled() || stats.llmCalls >= max) return null;
  stats.llmCalls++;
  const res = await llmExtract(title, description);
  if (res) {
    await db
      .insert(llmCache)
      .values({ contentHash: hash, result: res, model: process.env.LLM_MODEL ?? "claude-opus-5-5" })
      .onConflictDoNothing();
  }
  return res;
}

export async function analyse(raw: RawListing, hash: string, stats: RunStats): Promise<{ parsed: ParseResult; by: "rules" | "llm" }> {
  let parsed = parseListing({ title: raw.title, description: raw.description, price: raw.price, currency: raw.currency, hints: raw.hints });
  let by: "rules" | "llm" = "rules";
  const worthAsking = parsed.kind === "car" && (parsed.confidence < 0.6 || parsed.doubts.some((d) => d !== "price_placeholder"));
  if (worthAsking) {
    const llm = await cachedLlm(hash, raw.title, raw.description ?? "", stats);
    if (llm) {
      parsed = mergeLlm(parsed, llm);
      by = "llm";
    }
  }
  return { parsed, by };
}

function toRow(source: Source, raw: RawListing, parsed: ParseResult, by: string, hash: string, eurRate: number) {
  const price = parsed.priceSuspicious ? null : (raw.price ?? null);
  return {
    sourceId: source.id,
    externalId: raw.externalId,
    url: raw.url,
    title: raw.title.slice(0, 300),
    description: (raw.description ?? "").slice(0, 8000),
    imageUrl: raw.imageUrl ?? null,
    price,
    currency: raw.currency,
    priceCzk: price == null ? null : raw.currency === "EUR" ? Math.round(price * eurRate) : price,
    location: raw.location ?? null,
    postalCode: raw.postalCode ?? null,
    country: source.country,
    postedAt: raw.postedAt ?? null,
    kind: parsed.kind,
    make: parsed.make,
    model: parsed.model,
    variant: parsed.variant,
    year: parsed.year,
    mileageKm: parsed.mileageKm,
    fuel: parsed.fuel,
    transmission: parsed.transmission,
    bodyType: parsed.bodyType,
    powerKw: parsed.powerKw,
    engineCcm: parsed.engineCcm,
    condition: parsed.condition,
    conditionNotes: parsed.conditionNotes,
    seller: parsed.seller,
    vatDeductible: parsed.vatDeductible,
    serviceBook: parsed.serviceBook,
    firstOwner: parsed.firstOwner,
    stkValidUntil: parsed.stkValidUntil,
    parseConfidence: parsed.confidence,
    parsedBy: by,
    contentHash: hash,
    clusterKey: clusterKeyFor(parsed),
  };
}

/** Insert or refresh one listing. Returns what happened. */
export async function upsertListing(source: Source, raw: RawListing, stats: RunStats, eurRate: number, existing?: Listing | null) {
  const hash = hashOf(raw);
  const now = new Date();
  existing ??= await db.query.listings.findFirst({ where: and(eq(listings.sourceId, source.id), eq(listings.externalId, raw.externalId)) });

  if (existing && existing.contentHash === hash) {
    await db.update(listings).set({ lastSeenAt: now, status: existing.status === "removed" ? "active" : existing.status }).where(eq(listings.id, existing.id));
    return "seen" as const;
  }
  // Teaser text from a category page must not overwrite a full description we already have
  if (existing && raw.partial && existing.description.length > (raw.description?.length ?? 0) && existing.title === raw.title) {
    if (raw.price != null && raw.price !== existing.price) {
      const eur = raw.currency === "EUR";
      await db.update(listings).set({ price: raw.price, priceCzk: eur ? Math.round(raw.price * eurRate) : raw.price, lastSeenAt: now }).where(eq(listings.id, existing.id));
      await db.insert(priceHistory).values({ listingId: existing.id, price: raw.price, currency: raw.currency });
      stats.updated++;
      return "updated" as const;
    }
    await db.update(listings).set({ lastSeenAt: now }).where(eq(listings.id, existing.id));
    return "seen" as const;
  }

  const { parsed, by } = await analyse(raw, hash, stats);
  const row = toRow(source, raw, parsed, by, hash, eurRate);
  if (!existing) {
    const [ins] = await db.insert(listings).values(row).returning({ id: listings.id });
    await db.insert(priceHistory).values({ listingId: ins.id, price: row.price, currency: row.currency });
    stats.created++;
    return "created" as const;
  }
  if (existing.status === "hidden") {
    // Admin hid it: keep it hidden but keep the data fresh
    await db.update(listings).set({ ...row, status: "hidden", lastSeenAt: now, lastCheckedAt: now }).where(eq(listings.id, existing.id));
  } else {
    await db.update(listings).set({ ...row, status: "active", lastSeenAt: now, lastCheckedAt: now }).where(eq(listings.id, existing.id));
  }
  if (row.price !== existing.price) await db.insert(priceHistory).values({ listingId: existing.id, price: row.price, currency: row.currency });
  stats.updated++;
  return "updated" as const;
}

async function startRun(sourceId: number | null, job: string) {
  const [run] = await db.insert(ingestRuns).values({ sourceId, job }).returning();
  const lines: string[] = [];
  const log = (msg: string) => {
    const line = `${new Date().toISOString()} ${msg}`;
    lines.push(line);
    console.log(`[${job}${sourceId ? `#${sourceId}` : ""}] ${msg}`);
  };
  const finish = async (status: "ok" | "failed", stats: Partial<RunStats>) => {
    await db
      .update(ingestRuns)
      .set({ status, finishedAt: new Date(), ...stats, log: lines.join("\n").slice(-20000) })
      .where(eq(ingestRuns.id, run.id));
  };
  return { run, log, finish };
}

/** Crawl one source: fetch new/changed listings, then mark vanished ones for checking. */
export async function crawlSource(source: Source) {
  const adapter = adapterFor(source);
  if (!adapter) throw new Error(`No adapter for source ${source.key}`);
  const { log, finish } = await startRun(source.id, "crawl");
  const stats: RunStats = { fetched: 0, created: 0, updated: 0, removed: 0, errors: 0, llmCalls: 0 };
  const eurRate = await getEurRate();
  const seenIds: string[] = [];
  const ctx: CrawlContext = {
    source,
    log,
    isKnown: async (externalId) =>
      Boolean(await db.query.listings.findFirst({ columns: { id: true }, where: and(eq(listings.sourceId, source.id), eq(listings.externalId, externalId)) })),
  };
  try {
    for await (const raw of adapter.crawl(ctx)) {
      stats.fetched++;
      seenIds.push(raw.externalId);
      try {
        let res = await upsertListing(source, raw, stats, eurRate);
        // New listing with only a teaser: fetch the detail page for a full description
        if (res === "created" && raw.partial && adapter.check) {
          const detail = await adapter.check(ctx, raw).catch(() => null);
          if (detail?.listing) {
            res = await upsertListing(source, { ...detail.listing, externalId: raw.externalId, imageUrl: detail.listing.imageUrl ?? raw.imageUrl }, stats, eurRate);
            if (res === "updated") stats.updated--; // still counts as one created listing
          }
        }
      } catch (err) {
        stats.errors++;
        log(`listing ${raw.externalId} failed: ${(err as Error).message}`);
      }
    }
    // Snapshot feeds list the full stock: anything not in it is gone
    if (adapter.snapshot?.(source.config) && seenIds.length > 0) {
      const gone = await db
        .update(listings)
        .set({ status: "removed", lastCheckedAt: new Date() })
        .where(and(eq(listings.sourceId, source.id), eq(listings.status, "active"), sql`${listings.externalId} <> ALL(${seenIds})`))
        .returning({ id: listings.id });
      stats.removed = gone.length;
    }
    await db.update(sources).set({ lastRunAt: new Date() }).where(eq(sources.id, source.id));
    log(`done: ${JSON.stringify(stats)}`);
    await finish("ok", stats);
  } catch (err) {
    log(`failed: ${(err as Error).stack ?? err}`);
    await finish("failed", stats);
  }
  return stats;
}

/**
 * Re-check listings that have not been seen recently, so stale/removed ads disappear quickly.
 * Picks the least recently checked first; each source's own rate limits apply.
 */
export async function checkLiveness(limit = 200, staleAfterHours = 6) {
  const { log, finish } = await startRun(null, "liveness");
  const stats: RunStats = { fetched: 0, created: 0, updated: 0, removed: 0, errors: 0, llmCalls: 0 };
  const eurRate = await getEurRate();
  const cutoff = new Date(Date.now() - staleAfterHours * 3600_000);
  const due = await db
    .select()
    .from(listings)
    .where(and(eq(listings.status, "active"), lt(listings.lastCheckedAt, cutoff)))
    .orderBy(listings.lastCheckedAt)
    .limit(limit);
  const srcRows = due.length ? await db.select().from(sources).where(inArray(sources.id, [...new Set(due.map((d) => d.sourceId))])) : [];
  const byId = new Map(srcRows.map((s) => [s.id, s]));
  for (const l of due) {
    const source = byId.get(l.sourceId);
    if (!source) continue;
    const adapter = adapterFor(source);
    if (!source.enabled || !adapter?.check) {
      // Can't verify (source disabled): hide listings we haven't seen for 3 days rather than show stale data
      if (Date.now() - l.lastSeenAt.getTime() > 72 * 3600_000) {
        await db.update(listings).set({ status: "removed", lastCheckedAt: new Date() }).where(eq(listings.id, l.id));
        stats.removed++;
      } else await db.update(listings).set({ lastCheckedAt: new Date() }).where(eq(listings.id, l.id));
      continue;
    }
    stats.fetched++;
    try {
      const res = await adapter.check({ source, log, isKnown: async () => true }, l);
      if (res.status === "removed") {
        await db.update(listings).set({ status: "removed", lastCheckedAt: new Date() }).where(eq(listings.id, l.id));
        stats.removed++;
      } else if (res.status === "active" && res.listing) {
        await upsertListing(source, { ...res.listing, externalId: l.externalId }, stats, eurRate, l);
        await db.update(listings).set({ lastCheckedAt: new Date(), lastSeenAt: new Date() }).where(eq(listings.id, l.id));
      } else {
        await db.update(listings).set({ lastCheckedAt: new Date() }).where(eq(listings.id, l.id));
      }
    } catch (err) {
      stats.errors++;
      log(`check ${l.id} failed: ${(err as Error).message}`);
      await db.update(listings).set({ lastCheckedAt: new Date() }).where(eq(listings.id, l.id));
    }
  }
  log(`done: ${JSON.stringify(stats)}`);
  await finish("ok", stats);
  return stats;
}

export async function crawlAll() {
  const enabled = await db.select().from(sources).where(eq(sources.enabled, true));
  for (const s of enabled) await crawlSource(s);
}
