"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dict, Locale } from "@/i18n/dictionaries";

export function CookieBanner({ locale, t }: { locale: Locale; t: Dict["cookies"] }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(!document.cookie.split("; ").some((c) => c.startsWith("consent=")));
  }, []);
  if (!show) return null;
  const choose = (v: "all" | "necessary") => {
    document.cookie = `consent=${v}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    setShow(false);
  };
  return (
    <div role="dialog" aria-live="polite" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-line bg-white p-4 shadow-xl sm:flex sm:items-center sm:gap-4">
      <p className="text-sm text-slate-700">
        {t.text} <Link href={`/${locale}/cookies`} className="font-medium text-brand-600 underline">{t.more}</Link>
      </p>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <button onClick={() => choose("necessary")} className="btn-ghost">{t.necessary}</button>
        <button onClick={() => choose("all")} className="btn-primary">{t.accept}</button>
      </div>
    </div>
  );
}
