/**
 * Background worker. Run alongside the web app:  npm run worker
 *
 *   every 20 min  crawl all enabled sources (each adapter stops once it reaches known listings)
 *   every 10 min  re-check the least recently verified listings (removed ads disappear quickly)
 *   every 30 min  recompute market medians and deal scores, count saved-search matches
 *   daily 14:45   refresh EUR/CZK rate from the Czech National Bank
 */
import cron from "node-cron";
import { checkLiveness, crawlAll } from "@/ingest/pipeline";
import { refreshEurRate, refreshMarketStats, refreshSavedSearches } from "@/ingest/market";

const locks = new Set<string>();
async function once(name: string, fn: () => Promise<unknown>) {
  if (locks.has(name)) return;
  locks.add(name);
  try {
    await fn();
  } catch (err) {
    console.error(`[worker] ${name} failed`, err);
  } finally {
    locks.delete(name);
  }
}

cron.schedule("*/20 * * * *", () => once("crawl", crawlAll));
cron.schedule("*/10 * * * *", () => once("liveness", () => checkLiveness(Number(process.env.LIVENESS_BATCH ?? 200))));
cron.schedule("5,35 * * * *", () => once("market", async () => { await refreshMarketStats(); await refreshSavedSearches(); }));
cron.schedule("45 14 * * *", () => once("fx", refreshEurRate), { timezone: "Europe/Prague" });

console.log("[worker] started");
void once("startup", async () => {
  await refreshEurRate();
  await crawlAll();
  await refreshMarketStats();
});
