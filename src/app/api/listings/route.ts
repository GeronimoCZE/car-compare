import { eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, listings, sources } from "@/db";
import { json } from "@/lib/api";

/** Public listing data for the comparison page (max 4 ids). */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 4);
  if (!ids.length) return json([]);
  const rows = await db
    .select({ l: listings, sourceName: sources.name })
    .from(listings)
    .innerJoin(sources, eq(sources.id, listings.sourceId))
    .where(inArray(listings.id, ids));
  return json(
    rows.map(({ l, sourceName }) => {
      const { description: _d, contentHash: _h, reportCount: _r, ...rest } = l;
      return { ...rest, sourceName };
    }),
  );
}
