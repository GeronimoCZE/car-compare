import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db, sources } from "@/db";
import { YearPriceChart } from "@/components/charts";
import { FilterDetails } from "@/components/FilterDetails";
import { FilterForm } from "@/components/FilterForm";
import { ListingCard } from "@/components/ListingCard";
import { Pagination } from "@/components/Pagination";
import { SaveSearchButton } from "@/components/SaveSearchButton";
import { SortSelect } from "@/components/SortSelect";
import { fmt, getDict, isLocale, type Locale } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { currencyFor, money, num } from "@/lib/format";
import { makePath, modelPath } from "@/lib/paths";
import { filtersFromParams, makeFacets, modelFacets, searchListings } from "@/lib/search";
import { eurRate, yearStats } from "@/lib/stats";
import { MAKE_BY_SLUG, makeName, modelName } from "@/parser/catalog";

type Props = PageProps<"/[locale]/auta/[[...slug]]">;

async function resolve(props: Props) {
  const { locale: l, slug = [] } = await props.params;
  if (!isLocale(l) || slug.length > 2) notFound();
  const locale = l as Locale;
  const [makeSlug, modelSlug] = slug;
  if (makeSlug && !MAKE_BY_SLUG.has(makeSlug)) notFound();
  if (modelSlug && !MAKE_BY_SLUG.get(makeSlug)!.models.some((m) => m.slug === modelSlug)) notFound();
  const sp = await props.searchParams;
  const params = { ...sp, ...(makeSlug ? { make: makeSlug } : {}), ...(modelSlug ? { model: modelSlug } : {}) };
  return { locale, makeSlug, modelSlug, sp, params };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, makeSlug, modelSlug, sp } = await resolve(props);
  const t = getDict(locale);
  const path = modelSlug ? modelPath(locale, makeSlug, modelSlug) : makeSlug ? makePath(locale, makeSlug) : `/${locale}/auta`;
  const other = locale === "cs" ? "sk" : "cs";
  const filtered = Object.keys(sp).some((k) => k !== "page");
  let title = t.search.title;
  let description = t.meta.description;
  if (makeSlug) {
    const rate = await eurRate();
    const stats = await yearStats(makeSlug, modelSlug ?? null);
    const count = stats.reduce((a, s) => a + s.n, 0);
    const all = stats.flatMap((s) => Array(s.n).fill(s.median) as number[]).sort((a, b) => a - b);
    const med = all.length ? all[all.length >> 1] : null;
    const name = [makeName(makeSlug), modelSlug ? modelName(makeSlug, modelSlug) : null].filter(Boolean).join(" ");
    title = modelSlug ? fmt(t.model.title, { make: makeName(makeSlug)!, model: modelName(makeSlug, modelSlug)! }) : fmt(t.model.titleMake, { make: makeName(makeSlug)! });
    description = fmt(t.model.desc, { name, count, median: money(med, locale, rate) });
  }
  return {
    title,
    description,
    alternates: { canonical: path, languages: { [locale]: path, [other]: path.replace(`/${locale}`, `/${other}`) } },
    // Filter combinations would create endless near-duplicate pages; only clean URLs are indexable
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: path },
  };
}

export default async function SearchPage(props: Props) {
  const { locale, makeSlug, modelSlug, sp, params } = await resolve(props);
  const t = getDict(locale);
  const rate = await eurRate();
  const currency = currencyFor(locale);
  const filters = filtersFromParams(params, rate, currency);
  const [result, makes, user, srcs, models, stats] = await Promise.all([
    searchListings(filters),
    makeFacets(),
    getCurrentUser(),
    db.select({ key: sources.key, name: sources.name }).from(sources).where(eq(sources.enabled, true)),
    makeSlug && !modelSlug ? modelFacets(makeSlug) : Promise.resolve([]),
    makeSlug ? yearStats(makeSlug, modelSlug ?? null) : Promise.resolve([]),
  ]);
  const makeOptions = makes.filter((m) => m.make).map((m) => ({ slug: m.make!, name: makeName(m.make)!, count: m.count }));

  const basePath = modelSlug ? modelPath(locale, makeSlug, modelSlug) : makeSlug ? makePath(locale, makeSlug) : `/${locale}/auta`;
  const queryWithout = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v == null || k === "page") continue;
      for (const vv of Array.isArray(v) ? v : [v]) p.append(k, vv);
    }
    for (const [k, v] of Object.entries(extra)) if (v != null) p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const heading = modelSlug
    ? `${makeName(makeSlug)} ${modelName(makeSlug, modelSlug)}`
    : makeSlug
      ? makeName(makeSlug)!
      : filters.kind === "parts"
        ? t.kind.parts
        : t.search.title;
  const fmtMoney = (v: number) => money(v, locale, rate);
  const searchName = [heading, filters.yearFrom && `${filters.yearFrom}+`, sp.priceTo && `≤ ${sp.priceTo}`].filter(Boolean).join(" ");
  const loginHref = `/${locale}/login?next=${encodeURIComponent(basePath + queryWithout({}))}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-3 text-sm text-muted" aria-label="breadcrumb">
        <Link href={`/${locale}`} className="hover:underline">{t.common.home}</Link>
        <span className="mx-1.5">/</span>
        <Link href={`/${locale}/auta`} className="hover:underline">{t.search.title}</Link>
        {makeSlug && (
          <>
            <span className="mx-1.5">/</span>
            <Link href={makePath(locale, makeSlug)} className="hover:underline">{makeName(makeSlug)}</Link>
          </>
        )}
        {modelSlug && (
          <>
            <span className="mx-1.5">/</span>
            <span>{modelName(makeSlug, modelSlug)}</span>
          </>
        )}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{makeSlug ? (modelSlug ? fmt(t.model.title, { make: makeName(makeSlug)!, model: modelName(makeSlug, modelSlug)! }) : fmt(t.model.titleMake, { make: makeName(makeSlug)! })) : heading}</h1>
          <p className="mt-1 text-muted">
            {num(result.total, locale)} {t.search.results}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={filters.kind === "parts" ? `/${locale}/auta` : `/${locale}/auta?kind=parts`} className="btn-ghost !py-2">
            {filters.kind === "parts" ? t.search.showCars : t.search.showParts}
          </Link>
          <SaveSearchButton
            loggedIn={Boolean(user)}
            loginHref={loginHref}
            name={searchName}
            query={new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v == null ? [] : (Array.isArray(v) ? v : [v]).map((vv) => [k, vv])))).toString()}
            currency={currency}
            labels={{ save: t.search.saveSearch, saved: t.search.saved, login: t.search.loginToSave }}
          />
          <Suspense>
            <SortSelect options={t.search.sorts} label={t.search.sort} />
          </Suspense>
        </div>
      </div>

      {models.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {models.map((m) => (
            <Link key={m.model} href={modelPath(locale, makeSlug, m.model!)} className="chip border border-line bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-brand-500">
              {modelName(makeSlug, m.model)} <span className="text-muted">{m.count}</span>
            </Link>
          ))}
        </div>
      )}

      {stats.length >= 2 && (
        <section className="card mt-6 p-5">
          <h2 className="font-bold">{t.model.byYear}</h2>
          <p className="text-sm text-muted">{t.model.byYearSub}</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[3fr_2fr]">
            <YearPriceChart data={stats} format={fmtMoney} label={t.model.byYear} />
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="py-1.5">{t.model.yearCol}</th>
                    <th className="text-right">{t.model.minCol}</th>
                    <th className="text-right">{t.model.medianCol}</th>
                    <th className="text-right">{t.model.maxCol}</th>
                    <th className="pl-3 text-right">{t.model.kmCol}</th>
                    <th className="pl-3 text-right">n</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats].reverse().map((s) => (
                    <tr key={s.year} className="border-t border-line">
                      <td className="py-1.5 font-semibold">
                        <Link className="hover:underline" href={`${basePath}?yearFrom=${s.year}&yearTo=${s.year}&sort=price_asc`}>{s.year}</Link>
                      </td>
                      <td className="text-right tabular-nums">{fmtMoney(s.p10)}</td>
                      <td className="text-right font-semibold tabular-nums">{fmtMoney(s.median)}</td>
                      <td className="text-right tabular-nums">{fmtMoney(s.p90)}</td>
                      <td className="pl-3 text-right tabular-nums text-muted">{s.km ? `${num(Math.round(s.km / 1000), locale)} tkm` : "–"}</td>
                      <td className="pl-3 text-right tabular-nums text-muted">{s.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="card h-fit p-5 lg:sticky lg:top-20">
          <FilterDetails summary={t.search.filters}>
            <FilterForm locale={locale} t={t} values={params} makes={makeOptions} sourcesList={srcs} action={`/${locale}/auta`} />
          </FilterDetails>
        </aside>
        <section>
          {result.rows.length === 0 ? (
            <div className="card p-10 text-center text-muted">{t.search.noResults}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.rows.map(({ listing, sourceName }) => (
                <ListingCard key={listing.id} l={listing} sourceName={sourceName} locale={locale} t={t} eurRate={rate} />
              ))}
            </div>
          )}
          <Pagination page={result.page} pages={result.pages} hrefFor={(p) => basePath + queryWithout({ page: p > 1 ? p : undefined })} labels={{ prev: t.search.prev, next: t.search.next }} />
        </section>
      </div>
    </div>
  );
}
