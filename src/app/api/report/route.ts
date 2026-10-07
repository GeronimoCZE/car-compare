import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, listings, reports } from "@/db";
import { json, sameOrigin } from "@/lib/api";
import { getCurrentUser, rateLimited } from "@/lib/auth";

const REASONS = ["wrong_data", "sold", "scam", "other"];

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (rateLimited(`report:${ip}`, 10, 3600_000)) return json({ error: "rate" }, 429);
  const body = (await req.json().catch(() => ({}))) as { listingId?: number; reason?: string; message?: string };
  const listingId = Number(body.listingId);
  if (!Number.isInteger(listingId) || !REASONS.includes(String(body.reason))) return json({ error: "bad request" }, 400);
  const user = await getCurrentUser();
  await db.insert(reports).values({ listingId, userId: user?.id ?? null, reason: String(body.reason), message: body.message?.slice(0, 1000) ?? null });
  await db.update(listings).set({ reportCount: sql`${listings.reportCount} + 1` }).where(eq(listings.id, listingId));
  return json({ ok: true });
}
