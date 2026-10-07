import Link from "next/link";
import { Suspense } from "react";
import { getDict, type Locale } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/[locale]/(auth)/actions";
import { LocaleSwitch } from "./LocaleSwitch";
import { Logo } from "./Logo";

export async function Header({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href={`/${locale}`} aria-label="Home">
          <Logo />
        </Link>
        <nav className="ml-4 hidden items-center gap-1 text-sm font-medium md:flex">
          <Link href={`/${locale}/auta`} className="rounded-lg px-3 py-2 hover:bg-slate-100">{t.nav.search}</Link>
          <Link href={`/${locale}/compare`} className="rounded-lg px-3 py-2 hover:bg-slate-100">{t.nav.compare}</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Suspense>
            <LocaleSwitch locale={locale} />
          </Suspense>
          {user ? (
            <>
              {user.role === "admin" && (
                <Link href={`/${locale}/admin`} className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 sm:block">{t.nav.admin}</Link>
              )}
              <Link href={`/${locale}/account`} className="btn-ghost !py-2">{t.nav.account}</Link>
              <form action={logoutAction}>
                <input type="hidden" name="locale" value={locale} />
                <button className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:bg-slate-100 sm:block">{t.nav.logout}</button>
              </form>
            </>
          ) : (
            <>
              <Link href={`/${locale}/login`} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100">{t.nav.login}</Link>
              <Link href={`/${locale}/register`} className="btn-primary !py-2">{t.nav.register}</Link>
            </>
          )}
        </div>
      </div>
      <nav className="flex gap-1 border-t border-line px-4 py-1 text-sm font-medium md:hidden">
        <Link href={`/${locale}/auta`} className="rounded-lg px-3 py-1.5 hover:bg-slate-100">{t.nav.search}</Link>
        <Link href={`/${locale}/compare`} className="rounded-lg px-3 py-1.5 hover:bg-slate-100">{t.nav.compare}</Link>
      </nav>
    </header>
  );
}
