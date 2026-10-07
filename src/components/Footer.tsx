import Link from "next/link";
import { getDict, type Locale } from "@/i18n/dictionaries";
import { Logo } from "./Logo";

export function Footer({ locale }: { locale: Locale }) {
  const t = getDict(locale).footer;
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted">{t.tagline}</p>
          <p className="mt-2 max-w-sm text-xs text-muted">{t.disclaimer}</p>
        </div>
        <ul className="space-y-2 text-sm">
          <li><Link className="hover:underline" href={`/${locale}/terms`}>{t.terms}</Link></li>
          <li><Link className="hover:underline" href={`/${locale}/privacy`}>{t.privacy}</Link></li>
          <li><Link className="hover:underline" href={`/${locale}/cookies`}>{t.cookies}</Link></li>
        </ul>
        <ul className="space-y-2 text-sm">
          <li><Link className="hover:underline" href={`/${locale}/about`}>{t.about}</Link></li>
          <li><Link className="hover:underline" href={`/${locale}/auta`}>{getDict(locale).nav.search}</Link></li>
        </ul>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">© {new Date().getFullYear()}</div>
    </footer>
  );
}
