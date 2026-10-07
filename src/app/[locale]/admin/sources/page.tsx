import { asc } from "drizzle-orm";
import { db, sources } from "@/db";
import { StatefulForm } from "@/components/admin/AdminForms";
import { addFeedSource, runSourceNow, saveSourceConfig, toggleSource } from "../actions";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const rows = await db.select().from(sources).orderBy(asc(sources.id));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Zdroje</h1>
      <p className="text-sm text-muted">Zdroj zapínejte jen tehdy, když to dovolují jeho podmínky (nebo máte souhlas provozovatele). Crawler vždy respektuje robots.txt a limituje rychlost dotazů.</p>
      {rows.map((s) => (
        <section key={s.id} className="card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold">{s.name}</h2>
            <span className="chip bg-slate-100 text-slate-600">{s.key}</span>
            <span className="chip bg-slate-100 text-slate-600">{s.country}</span>
            {s.enabled ? <span className="chip bg-emerald-50 text-emerald-700">zapnuto</span> : <span className="chip bg-slate-100 text-slate-500">vypnuto</span>}
            <div className="ml-auto flex gap-2">
              <form action={toggleSource}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost !py-2">{s.enabled ? "Vypnout" : "Zapnout"}</button></form>
              <form action={runSourceNow}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost !py-2" disabled={!s.enabled}>Spustit teď</button></form>
            </div>
          </div>
          {s.complianceNote && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">⚖ {s.complianceNote}</p>}
          <p className="mt-2 text-xs text-muted">Poslední běh: {s.lastRunAt?.toLocaleString("cs-CZ") ?? "nikdy"} · {s.baseUrl}</p>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-600">Konfigurace</summary>
            <StatefulForm action={saveSourceConfig} submit="Uložit konfiguraci" className="mt-2 space-y-2">
              <input type="hidden" name="id" value={s.id} />
              <textarea name="config" rows={8} defaultValue={JSON.stringify(s.config, null, 2)} className="input font-mono text-xs" />
            </StatefulForm>
          </details>
        </section>
      ))}
      <section className="card p-5">
        <h2 className="mb-3 font-bold">Přidat partnerský feed</h2>
        <StatefulForm action={addFeedSource} submit="Přidat" className="grid gap-2 sm:grid-cols-2">
          <input name="key" placeholder="klic_zdroje" required className="input" />
          <input name="name" placeholder="Název (např. Autobazar Novák)" required className="input" />
          <input name="feedUrl" placeholder="https://…/feed.xml" required className="input sm:col-span-2" />
          <select name="format" className="input"><option value="autofeed">XML feed (náš formát)</option><option value="rss">RSS 2.0</option></select>
          <select name="country" className="input"><option value="CZ">Česko</option><option value="SK">Slovensko</option></select>
        </StatefulForm>
      </section>
    </div>
  );
}
