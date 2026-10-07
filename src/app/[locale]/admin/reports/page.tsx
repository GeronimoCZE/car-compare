import Link from "next/link";
import { desc, eq, isNull } from "drizzle-orm";
import { db, listings, reports } from "@/db";
import { listingPath } from "@/lib/paths";
import { resolveReport } from "../actions";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ params }: PageProps<"/[locale]/admin/reports">) {
  const { locale } = await params;
  const rows = await db
    .select({ r: reports, l: listings })
    .from(reports)
    .innerJoin(listings, eq(listings.id, reports.listingId))
    .where(isNull(reports.resolvedAt))
    .orderBy(desc(reports.createdAt))
    .limit(100);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nahlášení</h1>
      {rows.length === 0 && <p className="text-muted">Žádná otevřená nahlášení.</p>}
      {rows.map(({ r, l }) => (
        <div key={r.id} className="card flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <Link href={listingPath(locale as "cs", l)} target="_blank" className="font-semibold hover:underline">{l.title}</Link>
            <div className="text-sm text-muted">{r.reason} · {r.createdAt.toLocaleString("cs-CZ")}</div>
            {r.message && <p className="mt-1 text-sm">{r.message}</p>}
          </div>
          <form action={resolveReport}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="listingId" value={l.id} /><input type="hidden" name="hide" value="1" /><button className="btn-danger !py-2">Skrýt inzerát</button></form>
          <form action={resolveReport}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="listingId" value={l.id} /><button className="btn-ghost !py-2">Zamítnout</button></form>
        </div>
      ))}
    </div>
  );
}
