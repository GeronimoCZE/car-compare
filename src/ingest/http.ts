/**
 * Polite HTTP client for crawlers: honours robots.txt, identifies itself, rate-limits per host,
 * retries transient failures with backoff.
 */
import robotsParser from "robots-parser";

type Robots = ReturnType<typeof robotsParser>;

const robotsCache = new Map<string, { robots: Robots | null; fetchedAt: number }>();
const lastRequestAt = new Map<string, number>();

export const USER_AGENT = process.env.CRAWLER_USER_AGENT ?? "AutolupaBot/1.0 (+https://example.cz/bot)";

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
  }
}

export type FetchOptions = {
  /** Minimum delay between requests to the same host, ms */
  minDelayMs?: number;
  /** Skip robots.txt (only for feeds a partner gave us explicitly) */
  ignoreRobots?: boolean;
  accept?: string;
};

async function getRobots(origin: string): Promise<Robots | null> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < 6 * 3600_000) return cached.robots;
  let robots: Robots | null = null;
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) robots = robotsParser(`${origin}/robots.txt`, await res.text());
    else if (res.status >= 500) throw new Error(`robots.txt ${res.status}`);
    // 4xx = no robots.txt = everything allowed
  } catch (err) {
    // Unreachable robots.txt: be conservative and treat the host as disallowed for this cycle
    robotsCache.set(origin, { robots: robotsParser(`${origin}/robots.txt`, "User-agent: *\nDisallow: /"), fetchedAt: Date.now() - 5.5 * 3600_000 });
    throw err;
  }
  robotsCache.set(origin, { robots, fetchedAt: Date.now() });
  return robots;
}

export async function isAllowed(url: string): Promise<boolean> {
  const u = new URL(url);
  const robots = await getRobots(u.origin);
  if (!robots) return true;
  return robots.isAllowed(url, USER_AGENT) !== false;
}

export async function crawlDelayMs(url: string): Promise<number | null> {
  const robots = await getRobots(new URL(url).origin);
  const d = robots?.getCrawlDelay(USER_AGENT);
  return d ? d * 1000 : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FetchResult = { status: number; url: string; body: string; ok: boolean };

export async function politeFetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const u = new URL(url);
  if (!opts.ignoreRobots && !(await isAllowed(url))) throw new RobotsDisallowedError(url);

  const delay = Math.max(opts.minDelayMs ?? 1500, (await crawlDelayMs(url).catch(() => null)) ?? 0);
  const last = lastRequestAt.get(u.host) ?? 0;
  const wait = last + delay - Date.now();
  if (wait > 0) await sleep(wait);

  let attempt = 0;
  for (;;) {
    lastRequestAt.set(u.host, Date.now());
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "cs,sk;q=0.9,en;q=0.5",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        attempt++;
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2000 * 2 ** attempt);
        continue;
      }
      return { status: res.status, url: res.url, body: await res.text(), ok: res.ok };
    } catch (err) {
      if (attempt >= 3) throw err;
      attempt++;
      await sleep(2000 * 2 ** attempt);
    }
  }
}
