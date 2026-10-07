import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, savedSearches } from "@/db";
import { json, sameOrigin } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => ({}))) as { name?: string; query?: string };
  const query = String(body.query ?? "").replace(/^\?/, "").slice(0, 1000);
  const name = String(body.name ?? "").trim().slice(0, 120) || "Hledání";
  const count = (await db.select().from(savedSearches).where(eq(savedSearches.userId, user.id))).length;
  if (count >= 30) return json({ error: "limit" }, 400);
  await db.insert(savedSearches).values({ userId: user.id, name, query });
  return json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const id = Number(req.nextUrl.searchParams.get("id"));
  await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, user.id)));
  return json({ ok: true });
}
