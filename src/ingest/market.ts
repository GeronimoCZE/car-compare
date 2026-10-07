/**
 * Market comparison. For every active car we find comparable listings (same make, model and fuel,
 * production year within ±1, similar mileage, drivable) and store their median price. The ratio
 * price / median is the "deal score" shown as a badge (0.85 = 15 % below market).
 * Damaged, non-running and for-parts cars are compared against the drivable median too, but the UI
 * labels them so nobody mistakes a wreck for a bargain.
 */
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, ingestRuns, listings, savedSearches, settings } from "@/db";
import { whereFor, filtersFromParams } from "@/lib/search";
import { getEurRate } from "./pipeline";

type Row = { id: number; make: string; model: string; year: number | null; fuel: string; mileageKm: number | null; priceCzk: number; condition: string; clusterKey: string | null };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

function similarKm(a: number | null, b: number | null) {
  if (a == null || b == null) return true;
  return Math.abs(a - b) <= Math.max(40_000, 0.35 * Math.max(a, b));
}

export function computeMarket(rows: Row[], minPeers = 4) {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.make}|${r.model}`;
    const g = groups.get(k) ?? [];
    g.push(r);
    groups.set(k, g);
  }
  const out: { id: number; median: number | null; n: number; score: number | null }[] = [];
  for (const group of groups.values()) {
    const drivable = group.filter((r) => r.condition === "ok" || r.condition === "unknown");
    for (const r of group) {
      const peerBase = drivable.filter((p) => p.id !== r.id && (r.clusterKey == null || p.clusterKey !== r.clusterKey));
      const tiers = [
        peerBase.filter((p) => p.fuel === r.fuel && r.year != null && p.year != null && Math.abs(p.year - r.year) <= 1 && similarKm(p.mileageKm, r.mileageKm)),
        peerBase.filter((p) => p.fuel === r.fuel && r.year != null && p.year != null && Math.abs(p.year - r.year) <= 1),
        peerBase.filter((p) => r.year != null && p.year != null && Math.abs(p.year - r.year) <= 2),
      ];
      const peers = tiers.find((t) => t.length >= minPeers);
      if (!peers) {
        out.push({ id: r.id, median: null, n: 0, score: null });
        continue;
      }
      const med = median(peers.map((p) => p.priceCzk));
      out.push({ id: r.id, median: med, n: peers.length, score: Math.round((r.priceCzk / med) * 1000) / 1000 });
    }
  }
  return out;
}

export async function refreshMarketStats() {
  const started = new Date();
  const rows = (await db
    .select({
      id: listings.id,
      make: listings.make,
      model: listings.model,
      year: listings.year,
      fuel: listings.fuel,
      mileageKm: listings.mileageKm,
      priceCzk: listings.priceCzk,
      condition: listings.condition,
      clusterKey: listings.clusterKey,
    })
    .from(listings)
    .where(and(eq(listings.status, "active"), eq(listings.kind, "car"), isNotNull(listings.make), isNotNull(listings.model), isNotNull(listings.priceCzk)))) as Row[];
  const res = computeMarket(rows);
  // Batch update with unnest for speed
  for (let i = 0; i < res.length; i += 2000) {
    const chunk = res.slice(i, i + 2000);
    await db.execute(sql`
      update listings l set market_median_czk = v.median, market_sample_size = v.n, deal_score = v.score
      from (select unnest(${sql.raw(`ARRAY[${chunk.map((c) => c.id).join(",") || "NULL"}]::int[]`)}) as id,
                   unnest(${sql.raw(`ARRAY[${chunk.map((c) => c.median ?? "NULL").join(",") || "NULL"}]::int[]`)}) as median,
                   unnest(${sql.raw(`ARRAY[${chunk.map((c) => c.n).join(",") || "NULL"}]::int[]`)}) as n,
                   unnest(${sql.raw(`ARRAY[${chunk.map((c) => c.score ?? "NULL").join(",") || "NULL"}]::real[]`)}) as score) v
      where l.id = v.id`);
  }
  await db.insert(ingestRuns).values({ job: "market", status: "ok", startedAt: started, finishedAt: new Date(), updated: res.length });
  return res.length;
}

/** Count new matches for saved searches; the account page shows them as notifications. */
export async function refreshSavedSearches() {
  const eurRate = await getEurRate();
  const all = await db.select().from(savedSearches).where(eq(savedSearches.notify, true));
  for (const s of all) {
    const params = Object.fromEntries(new URLSearchParams(s.query));
    const f = filtersFromParams(params, eurRate, params.cur === "EUR" ? "EUR" : "CZK");
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(whereFor(f), sql`${listings.firstSeenAt} > ${s.lastCheckedAt}`));
    if (count > 0) await db.update(savedSearches).set({ newMatches: sql`${savedSearches.newMatches} + ${count}`, lastCheckedAt: new Date() }).where(eq(savedSearches.id, s.id));
  }
}

/** Daily EUR/CZK rate from the Czech National Bank. */
export async function refreshEurRate() {
  try {
    const res = await fetch("https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt", { signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    const line = text.split("\n").find((l) => l.includes("|EUR|"));
    const rate = line ? Number(line.split("|")[4].replace(",", ".")) : NaN;
    if (!Number.isFinite(rate) || rate < 15 || rate > 40) throw new Error("unexpected CNB response");
    await db
      .insert(settings)
      .values({ key: "eur_czk", value: { rate, at: new Date().toISOString() } })
      .onConflictDoUpdate({ target: settings.key, set: { value: { rate, at: new Date().toISOString() }, updatedAt: new Date() } });
    await db.execute(sql`update listings set price_czk = round(price * ${rate}) where currency = 'EUR' and price is not null`);
    return rate;
  } catch (err) {
    console.warn(`[fx] could not refresh EUR rate: ${(err as Error).message}`);
    return null;
  }
}
