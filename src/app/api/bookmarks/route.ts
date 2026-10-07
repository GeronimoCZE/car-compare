import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { bookmarks, db, listings } from "@/db";
import { json, sameOrigin } from "@/lib/api";
import { rateLimited, readJson } from "@/lib/security";
import { getCurrentUser } from "@/lib/auth";

async function parse(req: NextRequest) {
  if (!sameOrigin(req)) return { error: json({ error: "forbidden" }, 403) };
  const user = await getCurrentUser();
  if (!user) return { error: json({ error: "unauthorized" }, 401) };
  if (rateLimited(`bm:${user.id}`, 120, 60_000)) return { error: json({ error: "rate" }, 429) };
  const body = await readJson<{ listingId?: unknown }>(req);
  const listingId = Number(body?.listingId);
  if (!Number.isSafeInteger(listingId) || listingId < 1) return { error: json({ error: "bad request" }, 400) };
  return { user, listingId };
}

export async function POST(req: NextRequest) {
  const p = await parse(req);
  if ("error" in p) return p.error;
  const l = await db.query.listings.findFirst({ where: eq(listings.id, p.listingId), columns: { priceCzk: true } });
  if (!l) return json({ error: "not found" }, 404);
  await db.insert(bookmarks).values({ userId: p.user.id, listingId: p.listingId, priceCzkAtSave: l.priceCzk }).onConflictDoNothing();
  return json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const p = await parse(req);
  if ("error" in p) return p.error;
  await db.delete(bookmarks).where(and(eq(bookmarks.userId, p.user.id), eq(bookmarks.listingId, p.listingId)));
  return json({ ok: true });
}
