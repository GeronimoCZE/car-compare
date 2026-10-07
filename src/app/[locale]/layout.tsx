import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getDict, isLocale, LOCALES } from "@/i18n/dictionaries";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${SITE_NAME}: ${t.meta.title}`, template: `%s | ${SITE_NAME}` },
    description: t.meta.description,
    openGraph: { siteName: SITE_NAME, locale: locale === "sk" ? "sk_SK" : "cs_CZ", type: "website" },
    alternates: { languages: { cs: "/cs", sk: "/sk", "x-default": "/cs" } },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <Header locale={locale} />
        <main className="flex-1">{children}</main>
        <Footer locale={locale} />
        <CookieBanner locale={locale} t={getDict(locale).cookies} />
      </body>
    </html>
  );
}
