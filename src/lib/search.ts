import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db, listings, sources } from "@/db";
import { fold } from "@/parser/normalize";

export const FUELS = ["petrol", "diesel", "lpg", "cng", "hybrid", "plugin_hybrid", "electric"] as const;
export const CONDITIONS = ["ok", "unknown", "damaged", "non_running", "parts"] as const;
export const DEFAULT_CONDITIONS = ["ok", "unknown", "damaged"] as const;
export const BODIES = ["combi", "hatchback", "sedan", "suv", "mpv", "van", "coupe", "cabrio", "pickup"] as const;
export const SORTS = ["newest", "price_asc", "price_desc", "km_asc", "year_desc", "deal"] as const;

export type SearchFilters = {
  q?: string;
  make?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  /** In CZK */
  priceFrom?: number;
  priceTo?: number;
  kmTo?: number;
  powerFrom?: number;
  fuel?: string[];
  transmission?: "manual" | "automatic";
  body?: string[];
  condition?: string[];
  kind?: "car" | "parts";
  country?: "CZ" | "SK";
  seller?: "private" | "dealer";
  vat?: boolean;
  source?: string;
  sort?: (typeof SORTS)[number];
  page?: number;
};

type Params = Record<string, string | string[] | undefined>;

const int = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? v.split(",") : []).map((s) => s.trim()).filter(Boolean);

/** Parse URL search params. Prices in the URL are in the visitor's display currency. */
export function filtersFromParams(p: Params, eurRate: number, currency: "CZK" | "EUR"): SearchFilters {
  const toCzk = (v?: number) => (v == null ? undefined : currency === "EUR" ? Math.round(v * eurRate) : v);
  const sort = one(p.sort) as SearchFilters["sort"];
  const country = one(p.country);
  const tr = one(p.transmission);
  const seller = one(p.seller);
  return {
    q: one(p.q)?.slice(0, 100),
    make: one(p.make),
    model: one(p.model),
    yearFrom: int(p.yearFrom),
    yearTo: int(p.yearTo),
    priceFrom: toCzk(int(p.priceFrom)),
    priceTo: toCzk(int(p.priceTo)),
    kmTo: int(p.kmTo),
    powerFrom: int(p.powerFrom),
    fuel: list(p.fuel).filter((f) => (FUELS as readonly string[]).includes(f)),
    transmission: tr === "manual" || tr === "automatic" ? tr : undefined,
    body: list(p.body).filter((b) => (BODIES as readonly string[]).includes(b)),
    condition: list(p.condition).filter((c) => (CONDITIONS as readonly string[]).includes(c)),
    kind: one(p.kind) === "parts" ? "parts" : "car",
    country: country === "CZ" || country === "SK" ? country : undefined,
    seller: seller === "private" || seller === "dealer" ? seller : undefined,
    vat: one(p.vat) === "1" || undefined,
    source: one(p.source),
    sort: sort && (SORTS as readonly string[]).includes(sort) ? sort : "newest",
    page: int(p.page) ?? 1,
  };
}

export function whereFor(f: SearchFilters): SQL {
  const conds: SQL[] = [eq(listings.status, "active"), eq(listings.kind, f.kind ?? "car")];
  if (f.q) {
    const terms = fold(f.q)
      .split(/\s+/)
      .filter((t) => t.length > 1)
      .map((t) => t.replace(/[^a-z0-9.-]/g, ""))
      .filter(Boolean)
      .map((t) => `${t}:*`)
      .join(" & ");
    if (terms)
      conds.push(
        sql`to_tsvector('simple', unaccent_immutable(${listings.title} || ' ' || coalesce(${listings.make}, '') || ' ' || coalesce(${listings.model}, ''))) @@ to_tsquery('simple', ${terms})`,
      );
  }
  if (f.make) conds.push(eq(listings.make, f.make));
  if (f.model) conds.push(eq(listings.model, f.model));
  if (f.yearFrom) conds.push(gte(listings.year, f.yearFrom));
  if (f.yearTo) conds.push(lte(listings.year, f.yearTo));
  if (f.priceFrom) conds.push(gte(listings.priceCzk, f.priceFrom));
  if (f.priceTo) conds.push(lte(listings.priceCzk, f.priceTo));
  if (f.kmTo) conds.push(lte(listings.mileageKm, f.kmTo));
  if (f.powerFrom) conds.push(gte(listings.powerKw, f.powerFrom));
  if (f.fuel?.length) conds.push(inArray(listings.fuel, f.fuel as (typeof FUELS)[number][]));
  if (f.transmission) conds.push(eq(listings.transmission, f.transmission));
  if (f.body?.length) conds.push(inArray(listings.bodyType, f.body));
  if (f.kind !== "parts") {
    const c = f.condition?.length ? f.condition : [...DEFAULT_CONDITIONS];
    conds.push(inArray(listings.condition, c as (typeof CONDITIONS)[number][]));
  }
  if (f.country) conds.push(eq(listings.country, f.country));
  if (f.seller) conds.push(eq(listings.seller, f.seller));
  if (f.vat) conds.push(eq(listings.vatDeductible, true));
  if (f.source) conds.push(sql`${listings.sourceId} = (select id from ${sources} where ${sources.key} = ${f.source})`);
  return and(...conds)!;
}

function orderFor(sort: SearchFilters["sort"]) {
  switch (sort) {
    case "price_asc":
      return [sql`${listings.priceCzk} asc nulls last`, desc(listings.id)];
    case "price_desc":
      return [sql`${listings.priceCzk} desc nulls last`, desc(listings.id)];
    case "km_asc":
      return [sql`${listings.mileageKm} asc nulls last`, desc(listings.id)];
    case "year_desc":
      return [sql`${listings.year} desc nulls last`, desc(listings.id)];
    case "deal":
      return [sql`${listings.dealScore} asc nulls last`, desc(listings.id)];
    default:
      return [sql`coalesce(${listings.postedAt}, ${listings.firstSeenAt}) desc`, desc(listings.id)];
  }
}

export const PAGE_SIZE = 24;

export async function searchListings(f: SearchFilters) {
  const where = whereFor(f);
  const page = Math.min(f.page ?? 1, 200);
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ listing: listings, sourceName: sources.name, sourceKey: sources.key })
      .from(listings)
      .innerJoin(sources, eq(sources.id, listings.sourceId))
      .where(where)
      .orderBy(...orderFor(f.sort))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(listings).where(where),
  ]);
  return { rows, total: count, page, pages: Math.max(1, Math.ceil(count / PAGE_SIZE)) };
}

/** Facet counts for the filter sidebar (makes with active listings). */
export async function makeFacets() {
  return db
    .select({ make: listings.make, count: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.status, "active"), eq(listings.kind, "car"), sql`${listings.make} is not null`))
    .groupBy(listings.make)
    .orderBy(desc(sql`count(*)`));
}

export async function modelFacets(make: string) {
  return db
    .select({ model: listings.model, count: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.status, "active"), eq(listings.kind, "car"), eq(listings.make, make), sql`${listings.model} is not null`))
    .groupBy(listings.model)
    .orderBy(desc(sql`count(*)`));
}

export { asc };
