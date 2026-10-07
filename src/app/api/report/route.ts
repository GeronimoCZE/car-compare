import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, listings, reports } from "@/db";
import { json, sameOrigin } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimited, readJson } from "@/lib/security";

const REASONS = ["wrong_data", "sold", "scam", "other"];

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (rateLimited(`report:${clientIp(req.headers)}`, 10, 3600_000)) return json({ error: "rate" }, 429);
  const body = await readJson<{ listingId?: unknown; reason?: unknown; message?: unknown }>(req);
  const listingId = Number(body?.listingId);
  if (!body || !Number.isSafeInteger(listingId) || listingId < 1 || !REASONS.includes(String(body.reason))) return json({ error: "bad request" }, 400);
  const exists = await db.query.listings.findFirst({ where: eq(listings.id, listingId), columns: { id: true } });
  if (!exists) return json({ error: "not found" }, 404);
  const message = typeof body.message === "string" ? body.message.slice(0, 1000) : null;
  const user = await getCurrentUser();
  await db.insert(reports).values({ listingId, userId: user?.id ?? null, reason: String(body.reason), message });
  await db.update(listings).set({ reportCount: sql`${listings.reportCount} + 1` }).where(eq(listings.id, listingId));
  return json({ ok: true });
}
