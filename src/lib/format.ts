import type { Locale } from "@/i18n/dictionaries";

export const currencyFor = (locale: Locale): "CZK" | "EUR" => (locale === "sk" ? "EUR" : "CZK");

/** Format a CZK amount in the visitor's currency (CZ: Kč, SK: €). */
export function money(czk: number | null | undefined, locale: Locale, eurRate: number): string {
  if (czk == null) return "–";
  const cur = currencyFor(locale);
  const value = cur === "EUR" ? czk / eurRate : czk;
  return new Intl.NumberFormat(locale === "sk" ? "sk-SK" : "cs-CZ", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0,
  }).format(cur === "EUR" ? Math.round(value / 10) * 10 : Math.round(value / 100) * 100);
}

/** Format the original listing price in its own currency. */
export function originalMoney(price: number | null, currency: "CZK" | "EUR", locale: Locale) {
  if (price == null) return null;
  return new Intl.NumberFormat(locale === "sk" ? "sk-SK" : "cs-CZ", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
}

export function num(n: number | null | undefined, locale: Locale) {
  if (n == null) return "–";
  return new Intl.NumberFormat(locale === "sk" ? "sk-SK" : "cs-CZ").format(n);
}

export function date(d: Date | null | undefined, locale: Locale) {
  if (!d) return "–";
  return new Intl.DateTimeFormat(locale === "sk" ? "sk-SK" : "cs-CZ", { day: "numeric", month: "numeric", year: "numeric" }).format(d);
}

export function relativeDays(d: Date, locale: Locale) {
  const days = Math.floor((Date.now() - d.getTime()) / 86400_000);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day");
}
