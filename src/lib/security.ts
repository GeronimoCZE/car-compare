import { SITE_URL } from "@/lib/site";

type HeaderBag = { get(name: string): string | null };

/**
 * Client IP for rate limiting. X-Forwarded-For is only trusted for the number of reverse proxies we
 * actually run behind (TRUST_PROXY_HOPS), otherwise anyone could rotate a fake header to dodge limits.
 */
export function clientIp(h: HeaderBag): string {
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (hops > 0) {
    const chain = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const ip = chain[chain.length - hops];
    if (ip) return ip;
  }
  return h.get("x-real-ip") ?? "direct";
}

const allowedOrigins = () => {
  const set = new Set([new URL(SITE_URL).origin]);
  for (const o of (process.env.EXTRA_ALLOWED_ORIGINS ?? "").split(",")) if (o.trim()) set.add(o.trim().replace(/\/$/, ""));
  return set;
};

/**
 * CSRF / CORS check for requests that change state or read private data. Browsers always send Origin on
 * cross-site fetches and form posts, and Sec-Fetch-Site on all modern requests; a request carrying neither
 * is not from a browser and can't ride on a victim's cookies.
 */
export function isSameOrigin(h: HeaderBag): boolean {
  const site = h.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = h.get("origin");
  if (!origin) return true;
  if (allowedOrigins().has(origin)) return true;
  // Same host as the request (dev, preview hosts); proxies must pass the original Host through
  try {
    const host = h.get("x-forwarded-host") ?? h.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// In-memory fixed-window limiter (per process). Bounded so a flood of unique keys can't exhaust memory.
const windows = new Map<string, { n: number; reset: number }>();
const MAX_KEYS = 50_000;
export function rateLimited(key: string, max = 8, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  if (windows.size > MAX_KEYS) {
    for (const [k, w] of windows) if (w.reset < now) windows.delete(k);
    if (windows.size > MAX_KEYS) windows.clear();
  }
  const w = windows.get(key);
  if (!w || w.reset < now) {
    windows.set(key, { n: 1, reset: now + windowMs });
    return false;
  }
  w.n++;
  return w.n > max;
}

/** Parse a small JSON body; rejects oversized or malformed payloads instead of buffering them. */
export async function readJson<T>(req: Request, maxBytes = 8 * 1024): Promise<T | null> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return null;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" ? (v as T) : null;
  } catch {
    return null;
  }
}

// bcrypt only looks at the first 72 bytes; a cap also stops multi-megabyte "passwords" burning CPU
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const passwordOk = (pw: string) => pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX;
