"use server";
import { eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, listings, reports, sessions, sources, users } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { checkLiveness, crawlSource } from "@/ingest/pipeline";
import { refreshMarketStats } from "@/ingest/market";
import { parseListing } from "@/parser/extract";

async function guard() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("forbidden");
  return admin;
}
const id = (fd: FormData, k = "id") => Number(fd.get(k));

export async function toggleSource(fd: FormData) {
  await guard();
  await db.update(sources).set({ enabled: sql`not ${sources.enabled}` }).where(eq(sources.id, id(fd)));
  revalidatePath("/[locale]/admin/sources", "page");
}

export async function saveSourceConfig(_: unknown, fd: FormData) {
  await guard();
  try {
    const config = JSON.parse(String(fd.get("config")));
    await db.update(sources).set({ config }).where(eq(sources.id, id(fd)));
    revalidatePath("/[locale]/admin/sources", "page");
    return { ok: "Uloženo" };
  } catch (e) {
    return { error: `Neplatný JSON: ${(e as Error).message}` };
  }
}

export async function addFeedSource(_: unknown, fd: FormData) {
  await guard();
  const key = String(fd.get("key") ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const name = String(fd.get("name") ?? "").trim();
  const feedUrl = String(fd.get("feedUrl") ?? "").trim();
  const country = fd.get("country") === "SK" ? "SK" : "CZ";
  if (!key || !name || !/^https?:\/\//.test(feedUrl)) return { error: "Vyplňte klíč, název a URL feedu." };
  await db
    .insert(sources)
    .values({
      key,
      name,
      country,
      baseUrl: new URL(feedUrl).origin,
      enabled: false,
      config: { adapter: "feed", feedUrl, format: fd.get("format") === "rss" ? "rss" : "autofeed", currency: country === "SK" ? "EUR" : "CZK", partner: true },
      complianceNote: "Partner feed added by admin.",
    })
    .onConflictDoNothing();
  revalidatePath("/[locale]/admin/sources", "page");
  return { ok: "Zdroj přidán (vypnutý). Zapněte ho po kontrole." };
}

export async function runSourceNow(fd: FormData) {
  await guard();
  const s = await db.query.sources.findFirst({ where: eq(sources.id, id(fd)) });
  if (s) void crawlSource(s).then(() => refreshMarketStats());
  revalidatePath("/[locale]/admin/runs", "page");
}

export async function runLivenessNow() {
  await guard();
  void checkLiveness(300);
}

export async function runMarketNow() {
  await guard();
  await refreshMarketStats();
  revalidatePath("/[locale]/admin", "layout");
}

export async function setListingStatus(fd: FormData) {
  await guard();
  const status = fd.get("status") === "hidden" ? "hidden" : "active";
  await db.update(listings).set({ status }).where(eq(listings.id, id(fd)));
  revalidatePath("/[locale]/admin/listings", "page");
}

export async function reparseListing(fd: FormData) {
  await guard();
  const l = await db.query.listings.findFirst({ where: eq(listings.id, id(fd)) });
  if (!l) return;
  const p = parseListing({ title: l.title, description: l.description, price: l.price, currency: l.currency });
  await db
    .update(listings)
    .set({ kind: p.kind, make: p.make, model: p.model, variant: p.variant, year: p.year, mileageKm: p.mileageKm, fuel: p.fuel, transmission: p.transmission, bodyType: p.bodyType, powerKw: p.powerKw, engineCcm: p.engineCcm, condition: p.condition, conditionNotes: p.conditionNotes, seller: p.seller, parseConfidence: p.confidence, parsedBy: "rules" })
    .where(eq(listings.id, l.id));
  revalidatePath("/[locale]/admin/listings", "page");
}

/** Manual correction of parsed attributes from the admin listing view. */
export async function correctListing(fd: FormData) {
  await guard();
  const numOrNull = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
  await db
    .update(listings)
    .set({
      make: String(fd.get("make") || "") || null,
      model: String(fd.get("model") || "") || null,
      year: numOrNull("year"),
      mileageKm: numOrNull("mileageKm"),
      condition: String(fd.get("condition")) as "ok",
      kind: String(fd.get("kind")) as "car",
      fuel: String(fd.get("fuel")) as "petrol",
      parsedBy: "manual",
      parseConfidence: 1,
    })
    .where(eq(listings.id, id(fd)));
  revalidatePath("/[locale]/admin/listings", "page");
}

export async function resolveReport(fd: FormData) {
  await guard();
  await db.update(reports).set({ resolvedAt: new Date() }).where(eq(reports.id, id(fd)));
  if (fd.get("hide") === "1") await db.update(listings).set({ status: "hidden" }).where(eq(listings.id, id(fd, "listingId")));
  revalidatePath("/[locale]/admin/reports", "page");
}

export async function resolveAllForListing(fd: FormData) {
  await guard();
  await db.update(reports).set({ resolvedAt: new Date() }).where(eq(reports.listingId, id(fd)));
  void isNull;
  revalidatePath("/[locale]/admin/reports", "page");
}

export async function setUserRole(fd: FormData) {
  const admin = await guard();
  if (id(fd) === admin.id) return;
  await db.update(users).set({ role: fd.get("role") === "admin" ? "admin" : "user" }).where(eq(users.id, id(fd)));
  revalidatePath("/[locale]/admin/users", "page");
}

export async function toggleBlock(fd: FormData) {
  const admin = await guard();
  if (id(fd) === admin.id) return;
  const u = await db.query.users.findFirst({ where: eq(users.id, id(fd)) });
  if (!u) return;
  await db.update(users).set({ blockedAt: u.blockedAt ? null : new Date() }).where(eq(users.id, u.id));
  if (!u.blockedAt) await db.delete(sessions).where(eq(sessions.userId, u.id));
  revalidatePath("/[locale]/admin/users", "page");
}
