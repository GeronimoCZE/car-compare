import Link from "next/link";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { db, ingestRuns, listings, reports, sources, users } from "@/db";
import { RunsTable } from "@/components/admin/RunsTable";
import { runLivenessNow, runMarketNow } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  const [[counts], [userCount], [openReports], perSource, recentRuns] = await Promise.all([
    db
      .select({
        active: sql<number>`count(*) filter (where status='active')::int`,
        removed: sql<number>`count(*) filter (where status='removed')::int`,
        hidden: sql<number>`count(*) filter (where status='hidden')::int`,
        lowConf: sql<number>`count(*) filter (where status='active' and kind='car' and parse_confidence < 0.6)::int`,
        llm: sql<number>`count(*) filter (where parsed_by='llm')::int`,
        stale: sql<number>`count(*) filter (where status='active' and last_seen_at < now() - interval '24 hours')::int`,
      })
      .from(listings),
    db.select({ n: sql<number>`count(*)::int` }).from(users),
    db.select({ n: sql<number>`count(*)::int` }).from(reports).where(isNull(reports.resolvedAt)),
    db
      .select({ name: sources.name, enabled: sources.enabled, n: sql<number>`count(${listings.id}) filter (where ${listings.status}='active')::int`, lastRunAt: sources.lastRunAt })
      .from(sources)
      .leftJoin(listings, eq(listings.sourceId, sources.id))
      .groupBy(sources.id)
      .orderBy(sources.name),
    db.select().from(ingestRuns).orderBy(desc(ingestRuns.startedAt)).limit(8),
  ]);
  const tiles = [
    ["Aktivní inzeráty", counts.active],
    ["Neviděné 24 h+", counts.stale],
    ["Odstraněné", counts.removed],
    ["Skryté", counts.hidden],
    ["Nízká jistota parseru", counts.lowConf],
    ["Doplněno AI", counts.llm],
    ["Uživatelé", userCount.n],
    ["Otevřená nahlášení", openReports.n],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Přehled</h1>
        <div className="flex gap-2">
          <form action={runLivenessNow}><button className="btn-ghost">Ověřit aktivitu inzerátů</button></form>
          <form action={runMarketNow}><button className="btn-ghost">Přepočítat tržní ceny</button></form>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className="text-xs font-semibold uppercase text-muted">{k}</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <section className="card p-5">
        <h2 className="mb-3 font-bold">Zdroje</h2>
        <table className="w-full text-sm">
          <tbody>
            {perSource.map((s) => (
              <tr key={s.name} className="border-t border-line">
                <td className="py-2 font-medium">{s.name}</td>
                <td>{s.enabled ? <span className="chip bg-emerald-50 text-emerald-700">zapnuto</span> : <span className="chip bg-slate-100 text-slate-600">vypnuto</span>}</td>
                <td className="text-right tabular-nums">{s.n}</td>
                <td className="text-right text-muted">{s.lastRunAt?.toLocaleString("cs-CZ") ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card p-5">
        <div className="mb-3 flex justify-between">
          <h2 className="font-bold">Poslední běhy</h2>
          <Link href={`/${locale}/admin/runs`} className="text-sm text-brand-600">vše →</Link>
        </div>
        <RunsTable runs={recentRuns} />
      </section>
    </div>
  );
}
