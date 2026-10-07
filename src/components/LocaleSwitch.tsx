"use client";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/dictionaries";

export function LocaleSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const other: Locale = locale === "cs" ? "sk" : "cs";
  const href = pathname.replace(/^\/(cs|sk)/, `/${other}`) + (search.size ? `?${search}` : "");
  return (
    <a
      href={href}
      onClick={() => {
        document.cookie = `locale=${other}; path=/; max-age=31536000; samesite=lax`;
      }}
      className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold uppercase text-muted hover:bg-slate-50"
      title={other === "sk" ? "Slovensky" : "Česky"}
    >
      {other === "sk" ? "SK" : "CZ"}
    </a>
  );
}
