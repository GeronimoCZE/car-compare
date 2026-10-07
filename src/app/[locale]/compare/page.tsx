import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompareTable } from "@/components/CompareTable";
import { getDict, isLocale, type Locale } from "@/i18n/dictionaries";
import { eurRate } from "@/lib/stats";

export async function generateMetadata({ params }: PageProps<"/[locale]/compare">): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict((isLocale(locale) ? locale : "cs") as Locale).compare.title, robots: { index: false } };
}

export default async function ComparePage({ params }: PageProps<"/[locale]/compare">) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = getDict(locale);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t.compare.title}</h1>
      <CompareTable locale={locale} t={t} eurRate={await eurRate()} />
    </div>
  );
}
