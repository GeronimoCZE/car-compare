import type { Locale } from "@/i18n/dictionaries";
import { slugify } from "@/parser/normalize";

export const listingPath = (locale: Locale, l: { id: number; title: string }) => `/${locale}/inzerat/${l.id}-${slugify(l.title).slice(0, 60)}`;
export const makePath = (locale: Locale, make: string) => `/${locale}/auta/${make}`;
export const modelPath = (locale: Locale, make: string, model: string) => `/${locale}/auta/${make}/${model}`;
