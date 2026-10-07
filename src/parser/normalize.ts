/** Lowercase, strip diacritics, unify whitespace and common punctuation variants. */
export function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[   ]/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[“”„"]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(input: string): string {
  return fold(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Split text into sentence-like clauses so negation and context checks stay local. */
export function clauses(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+|\s+-\s+|,\s+(?=[a-z])|\s*•\s*|\s*\|\s*/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Parse "150 000", "150.000", "150,5", "150tis", "1,2 mil" into a number. */
export function parseNumber(raw: string): number | null {
  let s = fold(raw).replace(/\s+/g, "");
  let mult = 1;
  if (/(tis|tisic|t)\.?$/.test(s)) {
    mult = 1000;
    s = s.replace(/(tis|tisic|t)\.?$/, "");
  } else if (/(mil|mio)\.?$/.test(s)) {
    mult = 1_000_000;
    s = s.replace(/(mil|mio)\.?$/, "");
  }
  // "150.000" or "150,000" used as thousands separators
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * mult);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
