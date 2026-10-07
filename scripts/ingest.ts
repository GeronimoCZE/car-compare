/** One-off jobs:  npm run ingest -- crawl [sourceKey] | liveness | market | fx */
import { eq } from "drizzle-orm";
import { db, sources, sqlClient } from "@/db";
import { checkLiveness, crawlAll, crawlSource } from "@/ingest/pipeline";
import { refreshEurRate, refreshMarketStats, refreshSavedSearches } from "@/ingest/market";

const [job = "crawl", arg] = process.argv.slice(2);
(async () => {
  if (job === "crawl") {
    if (arg) {
      const s = await db.query.sources.findFirst({ where: eq(sources.key, arg) });
      if (!s) throw new Error(`unknown source ${arg}`);
      await crawlSource(s);
    } else await crawlAll();
  } else if (job === "liveness") await checkLiveness(Number(arg ?? 200));
  else if (job === "market") {
    console.log(`updated ${await refreshMarketStats()} listings`);
    await refreshSavedSearches();
  } else if (job === "fx") console.log(await refreshEurRate());
  else throw new Error(`unknown job ${job}`);
  await sqlClient.end();
})().catch(async (e) => {
  console.error(e);
  await sqlClient.end();
  process.exit(1);
});
