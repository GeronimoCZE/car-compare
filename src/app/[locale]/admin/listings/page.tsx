import Link from "next/link";
import { and, asc, desc, eq, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { db, listings, sources } from "@/db";
import { listingPath } from "@/lib/paths";
import { CATALOG } from "@/parser/catalog";
import { parseListing } from "@/parser/extract";
import { correctListing, reparseListing, setListingStatus } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminListings({ params, searchParams }: PageProps<"/[locale]/admin/listings">) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const filter = typeof sp.f === "string" ? sp.f : "lowconf";
  const conds: SQL[] = [];
  if (q) conds.push(or(ilike(listings.title, `%${q}%`), sql`${listings.id}::text = ${q}`)!);
  if (filter === "lowconf") conds.push(and(eq(listings.kind, "car"), lt(listings.parseConfidence, 0.6), eq(listings.status, "active"))!);
  if (filter === "reported") conds.push(sql`${listings.reportCount} > 0`);
  if (filter === "hidden") conds.push(eq(listings.status, "hidden"));
  const rows = await db
    .select({ l: listings, src: sources.name })
    .from(listings)
    .innerJoin(sources, eq(sources.id, listings.sourceId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(filter === "lowconf" ? asc(listings.parseConfidence) : desc(listings.id))
    .limit(50);
  const tabs = [["lowconf", "Nízká jistota"], ["reported", "Nahlášené"], ["hidden", "Skryté"], ["all", "Vše"]];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inzeráty</h1>
      <form className="flex gap-2">
        <input type="hidden" name="f" value={filter} />
        <input name="q" defaultValue={q} placeholder="Hledat v titulku nebo ID" className="input max-w-sm" />
        <button className="btn-ghost">Hledat</button>
      </form>
      <div className="flex gap-1">
        {tabs.map(([k, v]) => (
          <Link key={k} href={`?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === k ? "bg-brand-600 text-white" : "hover:bg-white"}`}>{v}</Link>
        ))}
      </div>
      {rows.map(({ l, src }) => {
        const evidence = parseListing({ title: l.title, description: l.description, price: l.price, currency: l.currency }).evidence;
        return (
          <details key={l.id} className="card p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="text-xs text-muted">#{l.id}</span>
              <span className="font-semibold">{l.title}</span>
              <span className="chip bg-slate-100 text-slate-600">{src}</span>
              <span className="chip bg-slate-100 text-slate-600">{l.status}</span>
              <span className={`chip ${l.parseConfidence < 0.6 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{Math.round(l.parseConfidence * 100)} % · {l.parsedBy}</span>
              {l.reportCount > 0 && <span className="chip bg-amber-50 text-amber-800">{l.reportCount}× nahlášeno</span>}
            </summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="text-sm">
                <p className="whitespace-pre-line text-slate-700">{l.description.slice(0, 1500)}</p>
                <div className="mt-3 text-xs text-muted">
                  <b>Důkazy parseru:</b>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(evidence).map(([k, v]) => <li key={k}><code>{k}</code>: „{v}“</li>)}
                  </ul>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={listingPath(locale as "cs", l)} className="btn-ghost !py-1.5" target="_blank">Zobrazit</Link>
                  <a href={l.url} target="_blank" rel="noreferrer" className="btn-ghost !py-1.5">Zdroj ↗</a>
                  <form action={reparseListing}><input type="hidden" name="id" value={l.id} /><button className="btn-ghost !py-1.5">Znovu rozpoznat</button></form>
                  <form action={setListingStatus}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value={l.status === "hidden" ? "active" : "hidden"} /><button className="btn-ghost !py-1.5">{l.status === "hidden" ? "Zobrazit na webu" : "Skrýt z webu"}</button></form>
                </div>
              </div>
              <form action={correctListing} className="grid grid-cols-2 gap-2 text-sm">
                <input type="hidden" name="id" value={l.id} />
                <label>Druh<select name="kind" defaultValue={l.kind} className="input">{["car", "parts", "wanted", "rental", "other"].map((k) => <option key={k}>{k}</option>)}</select></label>
                <label>Stav<select name="condition" defaultValue={l.condition} className="input">{["ok", "unknown", "damaged", "non_running", "parts"].map((k) => <option key={k}>{k}</option>)}</select></label>
                <label>Značka<select name="make" defaultValue={l.make ?? ""} className="input"><option value="">–</option>{CATALOG.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>
                <label>Model<input name="model" defaultValue={l.model ?? ""} className="input" /></label>
                <label>Rok<input name="year" type="number" defaultValue={l.year ?? ""} className="input" /></label>
                <label>Nájezd<input name="mileageKm" type="number" defaultValue={l.mileageKm ?? ""} className="input" /></label>
                <label>Palivo<select name="fuel" defaultValue={l.fuel} className="input">{["petrol", "diesel", "lpg", "cng", "hybrid", "plugin_hybrid", "electric", "unknown"].map((k) => <option key={k}>{k}</option>)}</select></label>
                <div className="flex items-end"><button className="btn-primary w-full !py-2">Uložit opravu</button></div>
              </form>
            </div>
          </details>
        );
      })}
      {rows.length === 0 && <p className="text-muted">Nic k zobrazení.</p>}
    </div>
  );
}
