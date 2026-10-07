import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db, listings, sources } from "@/db";
import { ConditionBadge } from "@/components/Badges";
import { HeroSearch } from "@/components/HeroSearch";
import { ListingCard } from "@/components/ListingCard";
import { getDict, isLocale, type Locale } from "@/i18n/dictionaries";
import { num } from "@/lib/format";
import { makePath } from "@/lib/paths";
import { makeFacets } from "@/lib/search";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { eurRate, siteStats } from "@/lib/stats";
import { makeName } from "@/parser/catalog";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = getDict(locale);
  const [rate, stats, makes, deals, newest] = await Promise.all([
    eurRate(),
    siteStats(),
    makeFacets(),
    db
      .select({ listing: listings, sourceName: sources.name })
      .from(listings)
      .innerJoin(sources, eq(sources.id, listings.sourceId))
      .where(
        and(
          eq(listings.status, "active"),
          eq(listings.kind, "car"),
          inArray(listings.condition, ["ok"]),
          isNotNull(listings.dealScore),
          lte(listings.dealScore, 0.92),
          sql`${listings.marketSampleSize} >= 5`,
          eq(listings.country, locale === "sk" ? "SK" : "CZ"),
        ),
      )
      .orderBy(listings.dealScore)
      .limit(6),
    db
      .select({ listing: listings, sourceName: sources.name })
      .from(listings)
      .innerJoin(sources, eq(sources.id, listings.sourceId))
      .where(and(eq(listings.status, "active"), eq(listings.kind, "car"), inArray(listings.condition, ["ok", "unknown"])))
      .orderBy(desc(listings.firstSeenAt), desc(listings.id))
      .limit(6),
  ]);
  const makeOptions = makes.filter((m) => m.make).map((m) => ({ slug: m.make!, name: makeName(m.make)!, count: m.count }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_URL}/${locale}`,
    potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/${locale}/auta?q={query}`, "query-input": "required name=query" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:pt-20">
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t.home.heroTitle}</h1>
          <p className="mt-4 max-w-2xl text-lg text-blue-100">{t.home.heroSubtitle}</p>
          <div className="mt-8">
            <HeroSearch locale={locale} t={t} makes={makeOptions} />
          </div>
          <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-6">
            {[
              [num(stats.active, locale), t.home.statsListings],
              [num(stats.deals, locale), t.home.statsDeals],
              [num(stats.sources, locale), t.home.statsSources],
            ].map(([v, k]) => (
              <div key={k}>
                <dt className="text-sm text-blue-100">{k}</dt>
                <dd className="text-3xl font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-bold">{t.home.popularMakes}</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {makeOptions.slice(0, 12).map((m) => (
            <Link key={m.slug} href={makePath(locale, m.slug)} className="card flex items-center justify-between px-4 py-3 transition hover:border-brand-500 hover:shadow-md">
              <span className="font-semibold">{m.name}</span>
              <span className="text-sm text-muted">{num(m.count, locale)}</span>
            </Link>
          ))}
        </div>
      </section>

      {deals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{t.home.bestDeals}</h2>
              <p className="text-muted">{t.home.bestDealsSub}</p>
            </div>
            <Link href={`/${locale}/auta?sort=deal&condition=ok`} className="text-sm font-semibold text-brand-600 hover:underline">{t.home.viewAll} →</Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map(({ listing, sourceName }) => (
              <ListingCard key={listing.id} l={listing} sourceName={sourceName} locale={locale} t={t} eurRate={rate} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-bold">{t.home.howTitle}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["1", t.home.how1t, t.home.how1],
            ["2", t.home.how2t, t.home.how2],
            ["3", t.home.how3t, t.home.how3],
          ].map(([n, title, text]) => (
            <div key={n} className="card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 font-extrabold text-brand-600">{n}</div>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
        <div className="card mt-6 flex flex-col gap-4 p-6 md:flex-row md:items-center">
          <div className="md:w-1/2">
            <h3 className="font-bold">{t.home.labelsTitle}</h3>
            <p className="mt-1 text-sm text-muted">{t.home.labelsText}</p>
          </div>
          <div className="flex flex-wrap gap-2 md:w-1/2 md:justify-end">
            {(["ok", "damaged", "non_running", "parts"] as const).map((c) => (
              <Link key={c} href={`/${locale}/auta?condition=${c}`}>
                <ConditionBadge condition={c} t={t} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t.home.newest}</h2>
          <Link href={`/${locale}/auta`} className="text-sm font-semibold text-brand-600 hover:underline">{t.home.viewAll} →</Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {newest.map(({ listing, sourceName }) => (
            <ListingCard key={listing.id} l={listing} sourceName={sourceName} locale={locale} t={t} eurRate={rate} />
          ))}
        </div>
      </section>
    </>
  );
}
