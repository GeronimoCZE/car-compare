import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { privacy } from "@/content/legal";
import { isLocale, type Locale } from "@/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: privacy(locale as Locale).title, alternates: { canonical: `/${locale}/privacy` } };
}

export default async function Page({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const doc = privacy(locale as Locale);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">{doc.title}</h1>
      <div className="prose-legal card mt-6 p-6 sm:p-8">{doc.body}</div>
    </article>
  );
}
