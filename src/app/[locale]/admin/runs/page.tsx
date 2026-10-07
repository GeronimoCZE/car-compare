import { desc } from "drizzle-orm";
import { db, ingestRuns } from "@/db";
import { RunsTable } from "@/components/admin/RunsTable";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runs = await db.select().from(ingestRuns).orderBy(desc(ingestRuns.startedAt)).limit(100);
  const lastFailed = runs.find((r) => r.status === "failed");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Běhy importu</h1>
      <div className="card p-5"><RunsTable runs={runs} /></div>
      {lastFailed && (
        <div className="card p-5">
          <h2 className="mb-2 font-bold text-red-700">Poslední chyba ({lastFailed.startedAt.toLocaleString("cs-CZ")})</h2>
          <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{lastFailed.log}</pre>
        </div>
      )}
    </div>
  );
}
