import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { bookmarks, db, listings, priceHistory, sources } from "@/db";
import { ConditionBadge, DealBadge } from "@/components/Badges";
import { BookmarkButton } from "@/components/BookmarkButton";
import { CarPlaceholder } from "@/components/CarPlaceholder";
import { PriceHistoryChart, YearPriceChart } from "@/components/charts";
import { CompareButton } from "@/components/CompareButton";
import { ListingCard } from "@/components/ListingCard";
import { ReportForm } from "@/components/ReportForm";
import { fmt, getDict, isLocale, type Locale } from "@/i18n/dictionaries";
import { cachedQuery } from "@/lib/cache";
import { getCurrentUser } from "@/lib/auth";
import { date, money, num, originalMoney } from "@/lib/format";
import { listingPath, makePath, modelPath } from "@/lib/paths";
import { SITE_URL } from "@/lib/site";
import { eurRate, yearStats } from "@/lib/stats";
import { makeName, modelName } from "@/parser/catalog";

// Listing data is public and identical for every visitor; per-user bits (bookmark state) are read live
const listingById = cachedQuery(
  async (id: number) =>
    db.select({ l: listings, sourceName: sources.name }).from(listings).innerJoin(sources, eq(sources.id, listings.sourceId)).where(eq(listings.id, id)).limit(1),
  "listing",
  60,
);
const priceHistoryFor = cachedQuery(
  async (listingId: number) => db.select().from(priceHistory).where(eq(priceHistory.listingId, listingId)).orderBy(asc(priceHistory.observedAt)),
  "price-history",
  300,
);
const sameCarFor = cachedQuery(
  async (clusterKey: string, id: number, sourceId: number) =>
    db
      .select({ l: listings, sourceName: sources.name })
      .from(listings)
      .innerJoin(sources, eq(sources.id, listings.sourceId))
      .where(and(eq(listings.clusterKey, clusterKey), ne(listings.id, id), ne(listings.sourceId, sourceId), eq(listings.status, "active")))
      .limit(6),
  "same-car",
  300,
);
const similarFor = cachedQuery(
  async (make: string, model: string, id: number, year: number | null) =>
    db
      .select({ listing: listings, sourceName: sources.name })
      .from(listings)
      .innerJoin(sources, eq(sources.id, listings.sourceId))
      .where(
        and(
          eq(listings.make, make),
          eq(listings.model, model),
          ne(listings.id, id),
          eq(listings.status, "active"),
          eq(listings.kind, "car"),
          year ? sql`abs(${listings.year} - ${year}) <= 1` : undefined,
        ),
      )
      .orderBy(sql`${listings.dealScore} asc nulls last`)
      .limit(6),
  "similar",
  300,
);

type Props = PageProps<"/[locale]/inzerat/[id]">;

async function load(props: Props) {
  const { locale: l, id } = await props.params;
  if (!isLocale(l)) notFound();
  const numericId = Number.parseInt(id, 10);
  if (!Number.isInteger(numericId)) notFound();
  const row = await listingById(numericId);
  if (!row[0] || row[0].l.status === "hidden") notFound();
  return { locale: l as Locale, id, ...row[0] };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, l } = await load(props);
  const t = getDict(locale);
  const rate = await eurRate();
  const path = listingPath(locale, l);
  const other = locale === "cs" ? "sk" : "cs";
  const facts = [l.year, l.mileageKm != null ? `${num(l.mileageKm, locale)} km` : null, t.fuel[l.fuel], t.condition[l.condition]].filter(Boolean).join(", ");
  return {
    title: `${l.title} – ${money(l.priceCzk, locale, rate)}`,
    description: `${facts}. ${l.description.slice(0, 120)}`,
    alternates: { canonical: path, languages: { [locale]: path, [other]: path.replace(`/${locale}/`, `/${other}/`) } },
    robots: l.status === "removed" ? { index: false } : undefined,
    openGraph: { title: l.title, images: l.imageUrl ? [l.imageUrl] : undefined, url: path },
  };
}

export default async function ListingPage(props: Props) {
  const { locale, id, l, sourceName } = await load(props);
  const canonical = listingPath(locale, l);
  if (`/${locale}/inzerat/${id}` !== canonical) permanentRedirect(canonical);
  const t = getDict(locale);
  const rate = await eurRate();
  const user = await getCurrentUser();
  const fm = (v: number) => money(v, locale, rate);

  const [history, sameCar, similar, stats, bm] = await Promise.all([
    priceHistoryFor(l.id),
    l.clusterKey ? sameCarFor(l.clusterKey, l.id, l.sourceId) : Promise.resolve([]),
    l.make && l.model ? similarFor(l.make, l.model, l.id, l.year) : Promise.resolve([]),
    l.make && l.model ? yearStats(l.make, l.model) : Promise.resolve([]),
    user ? db.query.bookmarks.findFirst({ where: and(eq(bookmarks.userId, user.id), eq(bookmarks.listingId, l.id)) }) : Promise.resolve(null),
  ]);

  const histPoints = history.filter((h) => h.price != null).map((h) => ({ at: h.observedAt, price: h.currency === "EUR" ? Math.round(h.price! * rate) : h.price! }));
  const drivable = l.condition === "ok" || l.condition === "unknown";
  const diff = l.dealScore != null ? Math.round((1 - l.dealScore) * 100) : null;
  const params: [string, string | null][] = [
    [t.attr.year, l.year ? String(l.year) : null],
    [t.attr.mileage, l.mileageKm != null ? `${num(l.mileageKm, locale)} km` : null],
    [t.attr.fuel, l.fuel !== "unknown" ? t.fuel[l.fuel] : null],
    [t.attr.transmission, l.transmission !== "unknown" ? t.transmission[l.transmission] : null],
    [t.attr.power, l.powerKw ? `${l.powerKw} kW (${Math.round(l.powerKw / 0.7355)} k)` : null],
    [t.attr.engine, l.engineCcm ? `${num(l.engineCcm, locale)} ccm` : null],
    [t.attr.body, l.bodyType ? (t.body[l.bodyType as keyof typeof t.body] ?? l.bodyType) : null],
    [t.attr.seller, l.seller !== "unknown" ? t.seller[l.seller] : null],
    [t.listing.stk, l.stkValidUntil ? l.stkValidUntil.split("-").reverse().join("/") : null],
    [t.listing.serviceBook, l.serviceBook ? t.listing.yes : null],
    [t.listing.firstOwner, l.firstOwner ? t.listing.yes : null],
    [t.listing.vatDeductible, l.vatDeductible ? t.listing.yes : null],
    [t.listing.location, l.location ? `${l.location}${l.postalCode ? `, ${l.postalCode}` : ""} (${t.country[l.country]})` : null],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: l.title,
    url: `${SITE_URL}${canonical}`,
    image: l.imageUrl ?? undefined,
    brand: l.make ? { "@type": "Brand", name: makeName(l.make) } : undefined,
    model: l.model ? modelName(l.make, l.model) : undefined,
    vehicleModelDate: l.year ?? undefined,
    mileageFromOdometer: l.mileageKm != null ? { "@type": "QuantitativeValue", value: l.mileageKm, unitCode: "KMT" } : undefined,
    fuelType: l.fuel !== "unknown" ? t.fuel[l.fuel] : undefined,
    vehicleTransmission: l.transmission !== "unknown" ? t.transmission[l.transmission] : undefined,
    itemCondition: "https://schema.org/UsedCondition",
    offers:
      l.price != null
        ? { "@type": "Offer", price: l.price, priceCurrency: l.currency, availability: l.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut", url: l.url }
        : undefined,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className="mb-4 text-sm text-muted" aria-label="breadcrumb">
        <Link href={`/${locale}/auta`} className="hover:underline">{t.search.title}</Link>
        {l.make && (<><span className="mx-1.5">/</span><Link href={makePath(locale, l.make)} className="hover:underline">{makeName(l.make)}</Link></>)}
        {l.make && l.model && (<><span className="mx-1.5">/</span><Link href={modelPath(locale, l.make, l.model)} className="hover:underline">{modelName(l.make, l.model)}</Link></>)}
      </nav>

      {l.status === "removed" && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.listing.removed}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="card overflow-hidden">
            {l.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.imageUrl} alt={l.title} referrerPolicy="no-referrer" className="aspect-[16/9] w-full object-cover" />
            ) : (
              <CarPlaceholder className="aspect-[16/9] w-full" />
            )}
          </div>

          <section className="card p-5">
            <h2 className="mb-3 font-bold">{t.listing.details}</h2>
            <dl className="grid gap-x-8 sm:grid-cols-2">
              {params.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-2 text-sm">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {l.conditionNotes.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {l.conditionNotes.map((n) => (
                  <span key={n} className="chip bg-amber-50 text-amber-800 ring-1 ring-amber-200">{t.notes[n as keyof typeof t.notes] ?? n}</span>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted">ⓘ {t.listing.parsedBy}</p>
          </section>

          {l.description && (
            <section className="card p-5">
              <h2 className="mb-3 font-bold">{t.listing.description}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{l.description}</p>
            </section>
          )}

          {stats.length >= 2 && l.make && l.model && (
            <section className="card p-5">
              <h2 className="font-bold">{t.model.byYear}: {makeName(l.make)} {modelName(l.make, l.model)}</h2>
              <p className="text-sm text-muted">{t.model.byYearSub}</p>
              <div className="mt-3">
                <YearPriceChart data={stats} highlight={l.year && l.priceCzk ? { year: l.year, price: l.priceCzk } : null} format={fm} label={t.model.byYear} />
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <div className="card p-5">
            <div className="flex flex-wrap gap-1.5">
              <ConditionBadge condition={l.condition} t={t} />
              <DealBadge score={l.dealScore} condition={l.condition} t={t} />
            </div>
            <h1 className="mt-3 text-xl font-bold leading-snug">{l.title}</h1>
            <div className="mt-3 text-3xl font-extrabold tracking-tight">{l.priceCzk != null ? fm(l.priceCzk) : t.listing.priceOnRequest}</div>
            {l.price != null && ((locale === "sk") !== (l.currency === "EUR")) && <div className="text-sm text-muted">{originalMoney(l.price, l.currency, locale)}</div>}

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
              {l.marketMedianCzk ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted">{t.listing.marketPrice}</span>
                    <span className="font-semibold">{fm(l.marketMedianCzk)}</span>
                  </div>
                  <div className="text-xs text-muted">{fmt(t.listing.basedOn, { n: l.marketSampleSize ?? 0 })}</div>
                  {diff != null && (
                    <div className={`mt-2 font-semibold ${diff > 4 ? "text-emerald-700" : diff < -8 ? "text-orange-700" : "text-slate-700"}`}>
                      {diff > 2 ? fmt(t.listing.belowMarket, { p: diff }) : diff < -2 ? fmt(t.listing.aboveMarket, { p: -diff }) : t.listing.atMarket}
                    </div>
                  )}
                  {!drivable && <div className="mt-1 text-xs text-amber-800">{t.listing.vsDrivable}</div>}
                </>
              ) : (
                <span className="text-muted">{t.listing.noMarket}</span>
              )}
            </div>

            <a href={`/go/${l.id}`} rel="nofollow noopener" target="_blank" className="btn-primary mt-4 w-full !py-3 text-base">
              {t.listing.goToSource} {sourceName} ↗
            </a>
            <p className="mt-2 text-center text-xs text-muted">{fmt(t.listing.redirectNote, { source: sourceName })}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <BookmarkButton id={l.id} initial={Boolean(bm)} loggedIn={Boolean(user)} loginHref={`/${locale}/login?next=${encodeURIComponent(canonical)}`} labels={{ add: t.listing.bookmark, added: t.listing.bookmarked }} />
              <CompareButton id={l.id} labels={{ add: t.listing.compare, added: t.listing.inCompare }} />
            </div>
            <dl className="mt-4 space-y-1 text-xs text-muted">
              <div className="flex justify-between"><dt>{t.listing.source}</dt><dd>{sourceName}</dd></div>
              <div className="flex justify-between"><dt>{t.listing.firstSeen}</dt><dd>{date(l.postedAt ?? l.firstSeenAt, locale)}</dd></div>
              <div className="flex justify-between"><dt>{t.listing.lastChecked}</dt><dd>{date(l.lastCheckedAt > l.lastSeenAt ? l.lastCheckedAt : l.lastSeenAt, locale)}</dd></div>
            </dl>
          </div>

          {histPoints.length >= 2 && (
            <div className="card p-5">
              <h2 className="mb-2 font-bold">{t.listing.priceHistory}</h2>
              <PriceHistoryChart points={histPoints} end={l.lastCheckedAt > l.lastSeenAt ? l.lastCheckedAt : l.lastSeenAt} format={fm} label={t.listing.priceHistory} />
            </div>
          )}

          {sameCar.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 font-bold">{t.listing.sameCar}</h2>
              <ul className="space-y-2 text-sm">
                {sameCar.map((s) => (
                  <li key={s.l.id} className="flex items-center justify-between gap-2">
                    <Link href={listingPath(locale, s.l)} className="truncate hover:underline">{s.sourceName}</Link>
                    <span className="font-semibold">{fm(s.l.priceCzk ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="px-1">
            <ReportForm listingId={l.id} labels={{ report: t.listing.report, done: t.listing.reported, reasons: t.listing.reportReasons }} />
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">{t.listing.similar}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map(({ listing, sourceName: sn }) => (
              <ListingCard key={listing.id} l={listing} sourceName={sn} locale={locale} t={t} eurRate={rate} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
