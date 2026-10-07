import type { ingestRuns } from "@/db/schema";

export function RunsTable({ runs }: { runs: (typeof ingestRuns.$inferSelect)[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted">
          <tr><th className="py-1">Start</th><th>Úloha</th><th>Zdroj</th><th>Stav</th><th className="text-right">Načteno</th><th className="text-right">Nové</th><th className="text-right">Změněné</th><th className="text-right">Odstraněné</th><th className="text-right">Chyby</th><th className="text-right">AI</th></tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-line" title={r.log.slice(-2000)}>
              <td className="py-1.5">{r.startedAt.toLocaleString("cs-CZ")}</td>
              <td>{r.job}</td>
              <td>{r.sourceId ?? "–"}</td>
              <td className={r.status === "failed" ? "text-red-600" : r.status === "running" ? "text-amber-600" : "text-emerald-700"}>{r.status}</td>
              <td className="text-right tabular-nums">{r.fetched}</td>
              <td className="text-right tabular-nums">{r.created}</td>
              <td className="text-right tabular-nums">{r.updated}</td>
              <td className="text-right tabular-nums">{r.removed}</td>
              <td className="text-right tabular-nums">{r.errors}</td>
              <td className="text-right tabular-nums">{r.llmCalls}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
