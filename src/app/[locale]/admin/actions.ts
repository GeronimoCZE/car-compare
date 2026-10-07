"use server";
import { eq, isNull, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { adminAudit, conditionEnum, db, fuelEnum, listingKindEnum, listings, reports, sessions, sources, users } from "@/db";
import { assertPublicUrl } from "@/ingest/netguard";
import { requireAdmin } from "@/lib/auth";
import { checkLiveness, crawlSource } from "@/ingest/pipeline";
import { refreshMarketStats } from "@/ingest/market";
import { parseListing } from "@/parser/extract";

/** Every admin action re-checks the session (server actions are public endpoints) and leaves an audit row. */
async function guard(action: string, fd?: FormData) {
  const admin = await requireAdmin();
  if (!admin) throw new Error("forbidden");
  const detail = fd ? Object.fromEntries([...fd.entries()].filter(([k, v]) => !k.startsWith("$") && typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 500)])) : null;
  await db.insert(adminAudit).values({ adminId: admin.id, action, detail });
  return admin;
}
// Public listing pages are cached for a minute; admin edits should show up immediately
const listingsChanged = () => updateTag("listings");
const oneOf = <T extends string>(values: readonly T[], v: FormDataEntryValue | null): T | null => (values.includes(String(v) as T) ? (String(v) as T) : null);
const id = (fd: FormData, k = "id") => Number(fd.get(k));

export async function toggleSource(fd: FormData) {
  await guard("toggleSource", fd);
  await db.update(sources).set({ enabled: sql`not ${sources.enabled}` }).where(eq(sources.id, id(fd)));
  listingsChanged();
  revalidatePath("/[locale]/admin/sources", "page");
}

export async function saveSourceConfig(_: unknown, fd: FormData) {
  await guard("saveSourceConfig", fd);
  try {
    const config = JSON.parse(String(fd.get("config")));
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("očekáván objekt");
    for (const k of ["feedUrl", "baseUrl", "sitemapUrl"]) if (typeof config[k] === "string") await assertPublicUrl(config[k]);
    await db.update(sources).set({ config }).where(eq(sources.id, id(fd)));
    revalidatePath("/[locale]/admin/sources", "page");
    return { ok: "Uloženo" };
  } catch (e) {
    return { error: `Neplatný JSON: ${(e as Error).message}` };
  }
}

export async function addFeedSource(_: unknown, fd: FormData) {
  await guard("addFeedSource", fd);
  const key = String(fd.get("key") ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const name = String(fd.get("name") ?? "").trim();
  const feedUrl = String(fd.get("feedUrl") ?? "").trim();
  const country = fd.get("country") === "SK" ? "SK" : "CZ";
  if (!key || !name || !/^https?:\/\//.test(feedUrl)) return { error: "Vyplňte klíč, název a URL feedu." };
  try {
    await assertPublicUrl(feedUrl);
  } catch (e) {
    return { error: `URL feedu není povolená: ${(e as Error).message}` };
  }
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
  await guard("runSourceNow", fd);
  const s = await db.query.sources.findFirst({ where: eq(sources.id, id(fd)) });
  if (s) void crawlSource(s).then(() => refreshMarketStats());
  revalidatePath("/[locale]/admin/runs", "page");
}

export async function runLivenessNow() {
  await guard("runLivenessNow");
  void checkLiveness(300);
}

export async function runMarketNow() {
  await guard("runMarketNow");
  await refreshMarketStats();
  revalidatePath("/[locale]/admin", "layout");
}

export async function setListingStatus(fd: FormData) {
  await guard("setListingStatus", fd);
  const status = fd.get("status") === "hidden" ? "hidden" : "active";
  await db.update(listings).set({ status }).where(eq(listings.id, id(fd)));
  listingsChanged();
  revalidatePath("/[locale]/admin/listings", "page");
}

export async function reparseListing(fd: FormData) {
  await guard("reparseListing", fd);
  const l = await db.query.listings.findFirst({ where: eq(listings.id, id(fd)) });
  if (!l) return;
  const p = parseListing({ title: l.title, description: l.description, price: l.price, currency: l.currency });
  await db
    .update(listings)
    .set({ kind: p.kind, make: p.make, model: p.model, variant: p.variant, year: p.year, mileageKm: p.mileageKm, fuel: p.fuel, transmission: p.transmission, bodyType: p.bodyType, powerKw: p.powerKw, engineCcm: p.engineCcm, condition: p.condition, conditionNotes: p.conditionNotes, seller: p.seller, parseConfidence: p.confidence, parsedBy: "rules" })
    .where(eq(listings.id, l.id));
  listingsChanged();
  revalidatePath("/[locale]/admin/listings", "page");
}

/** Manual correction of parsed attributes from the admin listing view. */
export async function correctListing(fd: FormData) {
  await guard("correctListing", fd);
  const numOrNull = (k: string) => {
    const n = Number(fd.get(k));
    return fd.get(k) && Number.isSafeInteger(n) && n >= 0 ? n : null;
  };
  const condition = oneOf(conditionEnum.enumValues, fd.get("condition"));
  const kind = oneOf(listingKindEnum.enumValues, fd.get("kind"));
  const fuel = oneOf(fuelEnum.enumValues, fd.get("fuel"));
  if (!condition || !kind) return;
  await db
    .update(listings)
    .set({
      make: String(fd.get("make") || "").slice(0, 40) || null,
      model: String(fd.get("model") || "").slice(0, 60) || null,
      year: numOrNull("year"),
      mileageKm: numOrNull("mileageKm"),
      condition,
      kind,
      fuel: fuel ?? "unknown",
      parsedBy: "manual",
      parseConfidence: 1,
    })
    .where(eq(listings.id, id(fd)));
  listingsChanged();
  revalidatePath("/[locale]/admin/listings", "page");
}

export async function resolveReport(fd: FormData) {
  await guard("resolveReport", fd);
  await db.update(reports).set({ resolvedAt: new Date() }).where(eq(reports.id, id(fd)));
  if (fd.get("hide") === "1") {
    await db.update(listings).set({ status: "hidden" }).where(eq(listings.id, id(fd, "listingId")));
    listingsChanged();
  }
  revalidatePath("/[locale]/admin/reports", "page");
}

export async function resolveAllForListing(fd: FormData) {
  await guard("resolveAllForListing", fd);
  await db.update(reports).set({ resolvedAt: new Date() }).where(eq(reports.listingId, id(fd)));
  void isNull;
  revalidatePath("/[locale]/admin/reports", "page");
}

export async function setUserRole(fd: FormData) {
  const admin = await guard("setUserRole", fd);
  if (id(fd) === admin.id) return;
  await db.update(users).set({ role: fd.get("role") === "admin" ? "admin" : "user" }).where(eq(users.id, id(fd)));
  revalidatePath("/[locale]/admin/users", "page");
}

export async function toggleBlock(fd: FormData) {
  const admin = await guard("toggleBlock", fd);
  if (id(fd) === admin.id) return;
  const u = await db.query.users.findFirst({ where: eq(users.id, id(fd)) });
  if (!u) return;
  await db.update(users).set({ blockedAt: u.blockedAt ? null : new Date() }).where(eq(users.id, u.id));
  if (!u.blockedAt) await db.delete(sessions).where(eq(sessions.userId, u.id));
  revalidatePath("/[locale]/admin/users", "page");
}
