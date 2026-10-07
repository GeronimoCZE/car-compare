"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dict, Locale } from "@/i18n/dictionaries";
import { readCompare, writeCompare } from "./CompareButton";

type Item = {
  id: number;
  title: string;
  url: string;
  imageUrl: string | null;
  priceCzk: number | null;
  year: number | null;
  mileageKm: number | null;
  fuel: keyof Dict["fuel"];
  transmission: keyof Dict["transmission"];
  powerKw: number | null;
  engineCcm: number | null;
  condition: keyof Dict["condition"];
  seller: keyof Dict["seller"];
  location: string | null;
  country: "CZ" | "SK";
  dealScore: number | null;
  marketMedianCzk: number | null;
  sourceName: string;
  status: string;
};

export function CompareTable({ locale, t, eurRate }: { locale: Locale; t: Dict; eurRate: number }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const load = () => {
    const ids = readCompare();
    (ids.length ? fetch(`/api/listings?ids=${ids.join(",")}`) : Promise.resolve(new Response("[]")))
      .then((r) => r.json())
      .then((rows: Item[]) => setItems(ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Item[]))
      .catch(() => setItems([]));
  };
  useEffect(() => {
    load();
    window.addEventListener("compare-change", load);
    return () => window.removeEventListener("compare-change", load);
  }, []);

  const nf = new Intl.NumberFormat(locale === "sk" ? "sk-SK" : "cs-CZ");
  const money = (czk: number | null) =>
    czk == null
      ? "–"
      : new Intl.NumberFormat(locale === "sk" ? "sk-SK" : "cs-CZ", { style: "currency", currency: locale === "sk" ? "EUR" : "CZK", maximumFractionDigits: 0 }).format(locale === "sk" ? czk / eurRate : czk);

  if (items === null) return <p className="text-muted">{t.common.loading}</p>;
  if (!items.length) return <div className="card p-10 text-center text-muted">{t.compare.empty}</div>;

  const best = (vals: (number | null)[], dir: "min" | "max") => {
    const v = vals.filter((x): x is number => x != null);
    return v.length > 1 ? (dir === "min" ? Math.min(...v) : Math.max(...v)) : null;
  };
  const bestPrice = best(items.map((i) => i.priceCzk), "min");
  const bestKm = best(items.map((i) => i.mileageKm), "min");
  const bestYear = best(items.map((i) => i.year), "max");
  const bestPower = best(items.map((i) => i.powerKw), "max");
  const bestDeal = best(items.map((i) => i.dealScore), "min");
  const hl = (on: boolean) => (on ? "bg-emerald-50 font-bold text-emerald-800" : "");

  const rows: [string, (i: Item) => React.ReactNode, (i: Item) => boolean][] = [
    [t.listing.price, (i) => money(i.priceCzk), (i) => i.priceCzk === bestPrice],
    [t.listing.marketPrice, (i) => money(i.marketMedianCzk), (i) => i.dealScore === bestDeal],
    [t.attr.year, (i) => i.year ?? "–", (i) => i.year === bestYear],
    [t.attr.mileage, (i) => (i.mileageKm != null ? `${nf.format(i.mileageKm)} km` : "–"), (i) => i.mileageKm === bestKm],
    [t.attr.power, (i) => (i.powerKw ? `${i.powerKw} kW` : "–"), (i) => i.powerKw === bestPower],
    [t.attr.engine, (i) => (i.engineCcm ? `${nf.format(i.engineCcm)} ccm` : "–"), () => false],
    [t.attr.fuel, (i) => t.fuel[i.fuel], () => false],
    [t.attr.transmission, (i) => t.transmission[i.transmission], () => false],
    [t.attr.condition, (i) => t.condition[i.condition], () => false],
    [t.attr.seller, (i) => t.seller[i.seller], () => false],
    [t.listing.location, (i) => `${i.location ?? "–"} (${i.country})`, () => false],
    [t.listing.source, (i) => i.sourceName, () => false],
  ];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={() => writeCompare([])} className="btn-ghost !py-2">{t.compare.clear}</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className="w-40" />
              {items.map((i) => (
                <th key={i.id} className="p-3 text-left align-top font-normal">
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imageUrl} alt="" referrerPolicy="no-referrer" className="mb-2 aspect-[16/10] w-full rounded-lg object-cover" />
                  ) : null}
                  <Link href={`/${locale}/inzerat/${i.id}`} className="font-semibold hover:underline">{i.title}</Link>
                  <div className="mt-2 flex gap-2">
                    <a href={`/go/${i.id}`} target="_blank" rel="nofollow noopener" className="text-xs font-semibold text-brand-600 hover:underline">{i.sourceName} ↗</a>
                    <button onClick={() => writeCompare(readCompare().filter((x) => x !== i.id))} className="text-xs text-muted hover:text-red-600">{t.compare.remove}</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, render, isBest]) => (
              <tr key={label} className="border-t border-line">
                <th className="p-3 text-left text-xs font-semibold uppercase text-muted">{label}</th>
                {items.map((i) => (
                  <td key={i.id} className={`p-3 ${hl(isBest(i))}`}>{render(i)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">{t.compare.max}</p>
    </div>
  );
}
