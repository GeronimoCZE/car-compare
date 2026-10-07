"use client";
import { useState } from "react";
import type { Dict, Locale } from "@/i18n/dictionaries";

type Option = { slug: string; name: string; count: number };

export function HeroSearch({ locale, t, makes }: { locale: Locale; t: Dict; makes: Option[] }) {
  const [make, setMake] = useState("");
  const [models, setModels] = useState<Option[]>([]);
  const onMake = (value: string) => {
    setMake(value);
    setModels([]);
    if (value) fetch(`/api/models?make=${encodeURIComponent(value)}`).then((r) => r.json()).then(setModels).catch(() => {});
  };
  const thisYear = new Date().getFullYear();
  return (
    <form action={`/${locale}/auta`} className="grid gap-2 rounded-2xl bg-white p-3 text-ink shadow-2xl sm:grid-cols-2 lg:grid-cols-[1.3fr_1.3fr_1fr_1fr_auto]">
      <select name="make" value={make} onChange={(e) => onMake(e.target.value)} className="input !border-transparent !bg-slate-50" aria-label={t.search.make}>
        <option value="">{t.home.anyMake}</option>
        {makes.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
      </select>
      <select name="model" disabled={!make} className="input !border-transparent !bg-slate-50" aria-label={t.search.model}>
        <option value="">{t.home.anyModel}</option>
        {models.map((m) => <option key={m.slug} value={m.slug}>{m.name} ({m.count})</option>)}
      </select>
      <input name="priceTo" inputMode="numeric" placeholder={`${t.home.priceTo} (${locale === "sk" ? "€" : "Kč"})`} className="input !border-transparent !bg-slate-50" />
      <select name="yearFrom" className="input !border-transparent !bg-slate-50" aria-label={t.home.yearFrom} defaultValue="">
        <option value="">{t.home.yearFrom}</option>
        {Array.from({ length: 30 }, (_, i) => thisYear - i).map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <button className="btn-primary !px-8 !py-3 text-base">{t.home.searchCta}</button>
    </form>
  );
}
