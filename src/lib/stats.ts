import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db, listings, settings, sources } from "@/db";

export type YearStat = { year: number; n: number; p10: number; median: number; p90: number; km: number | null };

/** Price distribution per production year for drivable cars of one make (and optionally model). */
export const yearStats = unstable_cache(
  async (make: string, model: string | null): Promise<YearStat[]> => {
    const rows = await db
      .select({
        year: listings.year,
        n: sql<number>`count(*)::int`,
        p10: sql<number>`percentile_cont(0.1) within group (order by ${listings.priceCzk})::int`,
        median: sql<number>`percentile_cont(0.5) within group (order by ${listings.priceCzk})::int`,
        p90: sql<number>`percentile_cont(0.9) within group (order by ${listings.priceCzk})::int`,
        km: sql<number | null>`percentile_cont(0.5) within group (order by ${listings.mileageKm})::int`,
      })
      .from(listings)
      .where(
        and(
          eq(listings.status, "active"),
          eq(listings.kind, "car"),
          eq(listings.make, make),
          model ? eq(listings.model, model) : undefined,
          inArray(listings.condition, ["ok", "unknown"]),
          isNotNull(listings.priceCzk),
          isNotNull(listings.year),
          gte(listings.year, 1960),
        ),
      )
      .groupBy(listings.year)
      .orderBy(listings.year);
    return rows.filter((r) => r.n >= 2) as YearStat[];
  },
  ["year-stats"],
  { revalidate: 900 },
);

export const siteStats = unstable_cache(
  async () => {
    const [row] = await db
      .select({
        active: sql<number>`count(*) filter (where ${listings.status} = 'active' and ${listings.kind} = 'car')::int`,
        deals: sql<number>`count(*) filter (where ${listings.status} = 'active' and ${listings.dealScore} <= 0.9 and ${listings.condition} in ('ok','unknown'))::int`,
      })
      .from(listings);
    const [src] = await db.select({ n: sql<number>`count(*)::int` }).from(sources).where(eq(sources.enabled, true));
    return { ...row, sources: src.n };
  },
  ["site-stats"],
  { revalidate: 600 },
);

export const eurRate = unstable_cache(
  async () => {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "eur_czk") });
    const v = Number((row?.value as { rate?: number } | undefined)?.rate);
    return Number.isFinite(v) && v > 0 ? v : Number(process.env.EUR_CZK_RATE ?? 24.3);
  },
  ["eur-rate"],
  { revalidate: 3600 },
);
