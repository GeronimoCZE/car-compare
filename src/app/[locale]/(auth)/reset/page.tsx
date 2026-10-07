import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { getDict, isLocale, type Locale } from "@/i18n/dictionaries";
import { resetAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/[locale]/reset">): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict((isLocale(locale) ? locale : "cs") as Locale).auth;
  return { title: t.resetTitle, robots: { index: false } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/reset">) {
  const { locale: l } = await params;
  const locale = (isLocale(l) ? l : "cs") as Locale;
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return <AuthForm mode="reset" action={resetAction} locale={locale} t={getDict(locale).auth} next={next} token={typeof sp.token === "string" ? sp.token : undefined} />;
}
