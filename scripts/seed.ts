/**
 * Seeds sources and an admin account.  npm run seed  [-- --demo]
 * ADMIN_EMAIL / ADMIN_PASSWORD env vars create (or promote) the first admin.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, sources, sqlClient, users } from "@/db";

const SOURCES = [
  {
    key: "bazos_cz",
    name: "Bazoš.cz",
    country: "CZ" as const,
    baseUrl: "https://auto.bazos.cz",
    config: { adapter: "bazos", host: "https://auto.bazos.cz", currency: "CZK", maxPages: 25, minDelayMs: 3000 },
    complianceNote:
      "Bazoš terms forbid automated use and unofficial apps without their consent; robots.txt blocks known price-comparison bots. Enable only with written consent from Bazoš.",
  },
  {
    key: "bazos_sk",
    name: "Bazoš.sk",
    country: "SK" as const,
    baseUrl: "https://auto.bazos.sk",
    config: { adapter: "bazos", host: "https://auto.bazos.sk", currency: "EUR", maxPages: 25, minDelayMs: 3000 },
    complianceNote: "Same operator and terms as Bazoš.cz. Enable only with written consent.",
  },
  {
    key: "sbazar",
    name: "Sbazar.cz",
    country: "CZ" as const,
    baseUrl: "https://www.sbazar.cz",
    config: { adapter: "jsonld", sitemapUrls: ["https://www.sbazar.cz/sitemap.xml"], urlPattern: "/inzerat/", currency: "CZK" },
    complianceNote: "Seznam.cz property. robots.txt disallows generic crawlers, so the crawler will refuse to fetch. Needs a data agreement with Seznam.",
  },
  {
    key: "sauto",
    name: "Sauto.cz",
    country: "CZ" as const,
    baseUrl: "https://www.sauto.cz",
    config: { adapter: "jsonld", sitemapUrls: ["https://www.sauto.cz/sitemap.xml"], urlPattern: "/osobni/detail/", currency: "CZK" },
    complianceNote: "Largest CZ car portal (Seznam.cz). robots.txt disallows generic crawlers. Needs a partnership/feed from Seznam.",
  },
  {
    key: "tipcars",
    name: "TipCars",
    country: "CZ" as const,
    baseUrl: "https://www.tipcars.com",
    config: { adapter: "jsonld", sitemapUrls: ["https://www.tipcars.com/sitemap.xml"], urlPattern: "tipcars\\.com/[a-z0-9-]+/[a-z0-9-]+-\\d+\\.html", currency: "CZK", maxDetailPerRun: 200 },
    complianceNote:
      "robots.txt allows crawling listing pages and publishes a sitemap. Check their terms and verify the urlPattern against the live sitemap before enabling.",
  },
  {
    key: "autobazar_eu",
    name: "Autobazar.eu",
    country: "SK" as const,
    baseUrl: "https://www.autobazar.eu",
    config: { adapter: "jsonld", sitemapUrls: ["https://www.autobazar.eu/sitemap.xml"], urlPattern: "/detail/", currency: "EUR" },
    complianceNote: "Largest SK car portal. Terms and robots.txt not yet verified. Ask for a partner feed.",
  },
];

const DEMO = [
  { key: "demo_cz", name: "Demo CZ", country: "CZ" as const, baseUrl: "https://example.com", config: { adapter: "demo", count: 400, seed: 7 }, complianceNote: "Synthetic data for development." },
  { key: "demo_sk", name: "Demo SK", country: "SK" as const, baseUrl: "https://example.com", config: { adapter: "demo", count: 200, seed: 9 }, complianceNote: "Synthetic data for development." },
];

(async () => {
  const withDemo = process.argv.includes("--demo");
  for (const s of [...SOURCES, ...(withDemo ? DEMO : [])]) {
    await db
      .insert(sources)
      .values({ ...s, enabled: s.config.adapter === "demo" })
      .onConflictDoUpdate({ target: sources.key, set: { name: s.name, complianceNote: s.complianceNote } });
  }
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
    else await db.insert(users).values({ email, passwordHash: await bcrypt.hash(password, 12), role: "admin", name: "Admin", termsAcceptedAt: new Date() });
    console.log(`admin ready: ${email}`);
  }
  console.log("seeded");
  await sqlClient.end();
})();
