import type { MetadataRoute } from "next";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, listings } from "@/db";
import { LOCALES } from "@/i18n/dictionaries";
import { listingPath } from "@/lib/paths";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

/** Static pages, make/model landing pages that have listings, and the most recent active listings. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];
  const alt = (path: (l: string) => string) => ({ languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${path(l)}`])) });
  for (const p of ["", "/auta", "/about", "/terms", "/privacy", "/cookies"]) {
    out.push({ url: `${SITE_URL}/cs${p}`, lastModified: now, changeFrequency: p === "" || p === "/auta" ? "hourly" : "monthly", alternates: alt((l) => `/${l}${p}`) });
  }
  const groups = await db
    .select({ make: listings.make, model: listings.model, n: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.status, "active"), eq(listings.kind, "car"), sql`${listings.make} is not null`))
    .groupBy(listings.make, listings.model);
  const makes = new Set<string>();
  for (const g of groups) {
    if (!makes.has(g.make!)) {
      makes.add(g.make!);
      out.push({ url: `${SITE_URL}/cs/auta/${g.make}`, changeFrequency: "daily", alternates: alt((l) => `/${l}/auta/${g.make}`) });
    }
    if (g.model && g.n >= 3) out.push({ url: `${SITE_URL}/cs/auta/${g.make}/${g.model}`, changeFrequency: "daily", alternates: alt((l) => `/${l}/auta/${g.make}/${g.model}`) });
  }
  const recent = await db
    .select({ id: listings.id, title: listings.title, lastSeenAt: listings.lastSeenAt })
    .from(listings)
    .where(and(eq(listings.status, "active"), eq(listings.kind, "car")))
    .orderBy(desc(listings.firstSeenAt))
    .limit(40000);
  for (const r of recent) out.push({ url: `${SITE_URL}${listingPath("cs", r)}`, lastModified: r.lastSeenAt, alternates: alt((l) => listingPath(l as "cs", r)) });
  return out;
}
