import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getDict, isLocale, type Locale } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict((isLocale(locale) ? locale : "cs") as Locale).auth;
  return { title: t.loginTitle, robots: { index: false } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale: l } = await params;
  const locale = (isLocale(l) ? l : "cs") as Locale;
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getCurrentUser()) redirect(`/${locale}/account`);
  return <AuthForm mode="login" action={loginAction} locale={locale} t={getDict(locale).auth} next={next} token={typeof sp.token === "string" ? sp.token : undefined} />;
}
