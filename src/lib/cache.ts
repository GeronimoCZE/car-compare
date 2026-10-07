import { unstable_cache } from "next/cache";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

// The data cache stores JSON, so Date columns come back as strings; turn them back into Dates
function revive<T>(v: T): T {
  if (typeof v === "string" && ISO.test(v)) return new Date(v) as T;
  if (Array.isArray(v)) return v.map(revive) as T;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)])) as T;
  }
  return v;
}

/**
 * Shared, short-lived cache for public listing queries. Every visitor sees the same results, so the
 * database answers each search once per window instead of once per request. Never use for per-user data.
 */
export function cachedQuery<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, seconds: number) {
  const cached = unstable_cache(fn, [key], { revalidate: seconds, tags: ["listings"] });
  return async (...args: A): Promise<R> => revive(await cached(...args));
}
