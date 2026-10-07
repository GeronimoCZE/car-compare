"use client";
import { useEffect, useState } from "react";
import type { Dict, Locale } from "@/i18n/dictionaries";

type Option = { slug: string; name: string; count: number };

export type FilterValues = Record<string, string | string[] | undefined>;

const FUELS = ["petrol", "diesel", "lpg", "cng", "hybrid", "plugin_hybrid", "electric"] as const;
const BODIES = ["combi", "hatchback", "sedan", "suv", "mpv", "van", "coupe", "cabrio", "pickup"] as const;
const CONDITIONS = ["ok", "unknown", "damaged", "non_running", "parts"] as const;
const DEFAULT_CONDITIONS = ["ok", "unknown", "damaged"];

const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(",") : []);

export function FilterForm({
  locale,
  t,
  values,
  makes,
  sourcesList,
  action,
}: {
  locale: Locale;
  t: Dict;
  values: FilterValues;
  makes: Option[];
  sourcesList: { key: string; name: string }[];
  action: string;
}) {
  const s = t.search;
  const [make, setMake] = useState(String(values.make ?? ""));
  const [models, setModels] = useState<Option[]>([]);
  const parts = values.kind === "parts";
  const currency = locale === "sk" ? "€" : "Kč";
  const conditions = arr(values.condition).length ? arr(values.condition) : DEFAULT_CONDITIONS;

  useEffect(() => {
    if (!make) {
      setModels([]);
      return;
    }
    let alive = true;
    fetch(`/api/models?make=${encodeURIComponent(make)}`)
      .then((r) => r.json())
      .then((m: Option[]) => alive && setModels(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [make]);

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 40 }, (_, i) => thisYear - i);

  return (
    <form action={action} method="get" className="space-y-5">
      <div>
        <label className="label" htmlFor="q">{s.query}</label>
        <input id="q" name="q" defaultValue={String(values.q ?? "")} placeholder={s.queryPlaceholder} className="input" />
      </div>
      {parts && <input type="hidden" name="kind" value="parts" />}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="make">{s.make}</label>
          <select id="make" name="make" value={make} onChange={(e) => setMake(e.target.value)} className="input">
            <option value="">{t.home.anyMake}</option>
            {makes.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name} ({m.count})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="model">{s.model}</label>
          <select id="model" name="model" defaultValue={String(values.model ?? "")} disabled={!make} className="input" key={make + models.length}>
            <option value="">{t.home.anyModel}</option>
            {models.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name} ({m.count})</option>
            ))}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="label">{s.price} ({currency})</legend>
        <div className="grid grid-cols-2 gap-2">
          <input name="priceFrom" inputMode="numeric" defaultValue={String(values.priceFrom ?? "")} placeholder={s.from} className="input" />
          <input name="priceTo" inputMode="numeric" defaultValue={String(values.priceTo ?? "")} placeholder={s.to} className="input" />
        </div>
      </fieldset>
      {!parts && (
        <>
          <fieldset>
            <legend className="label">{s.year}</legend>
            <div className="grid grid-cols-2 gap-2">
              <select name="yearFrom" defaultValue={String(values.yearFrom ?? "")} className="input">
                <option value="">{s.from}</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select name="yearTo" defaultValue={String(values.yearTo ?? "")} className="input">
                <option value="">{s.to}</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="kmTo">{s.mileageTo}</label>
              <input id="kmTo" name="kmTo" inputMode="numeric" defaultValue={String(values.kmTo ?? "")} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="powerFrom">{s.powerFrom}</label>
              <input id="powerFrom" name="powerFrom" inputMode="numeric" defaultValue={String(values.powerFrom ?? "")} className="input" />
            </div>
          </div>
          <fieldset>
            <legend className="label">{s.condition}</legend>
            <div className="space-y-1.5">
              {CONDITIONS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="condition" value={c} defaultChecked={conditions.includes(c)} />
                  <span>{t.condition[c]}</span>
                  <span className="text-xs text-muted">· {t.conditionHint[c]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">{s.fuel}</legend>
            <div className="flex flex-wrap gap-1.5">
              {FUELS.map((f) => (
                <label key={f} className="cursor-pointer">
                  <input type="checkbox" name="fuel" value={f} defaultChecked={arr(values.fuel).includes(f)} className="peer sr-only" />
                  <span className="chip border border-line bg-white px-3 py-1 text-slate-700 peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-200">{t.fuel[f]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="transmission">{s.transmission}</label>
              <select id="transmission" name="transmission" defaultValue={String(values.transmission ?? "")} className="input">
                <option value="">{s.any}</option>
                <option value="manual">{t.transmission.manual}</option>
                <option value="automatic">{t.transmission.automatic}</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="body">{s.body}</label>
              <select id="body" name="body" defaultValue={arr(values.body)[0] ?? ""} className="input">
                <option value="">{s.any}</option>
                {BODIES.map((b) => <option key={b} value={b}>{t.body[b]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="seller">{s.seller}</label>
              <select id="seller" name="seller" defaultValue={String(values.seller ?? "")} className="input">
                <option value="">{s.any}</option>
                <option value="private">{t.seller.private}</option>
                <option value="dealer">{t.seller.dealer}</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="country">{s.country}</label>
              <select id="country" name="country" defaultValue={String(values.country ?? "")} className="input">
                <option value="">{s.any}</option>
                <option value="CZ">{t.country.CZ}</option>
                <option value="SK">{t.country.SK}</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="vat" value="1" defaultChecked={values.vat === "1"} />
            {s.vat}
          </label>
        </>
      )}
      <div>
        <label className="label" htmlFor="source">{s.source}</label>
        <select id="source" name="source" defaultValue={String(values.source ?? "")} className="input">
          <option value="">{s.any}</option>
          {sourcesList.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
        </select>
      </div>
      <input type="hidden" name="sort" value={String(values.sort ?? "newest")} />
      <div className="flex gap-2">
        <button className="btn-primary flex-1">{s.apply}</button>
        <a href={action} className="btn-ghost">{s.reset}</a>
      </div>
    </form>
  );
}
