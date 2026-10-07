import Link from "next/link";

export function Pagination({ page, pages, hrefFor, labels }: { page: number; pages: number; hrefFor: (p: number) => string; labels: { prev: string; next: string } }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1" aria-label="pagination">
      {page > 1 && <Link rel="prev" href={hrefFor(page - 1)} className="btn-ghost !px-3 !py-2">← {labels.prev}</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
          <Link href={hrefFor(n)} aria-current={n === page ? "page" : undefined} className={`min-w-10 rounded-xl px-3 py-2 text-center text-sm font-semibold ${n === page ? "bg-brand-600 text-white" : "hover:bg-white"}`}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link rel="next" href={hrefFor(page + 1)} className="btn-ghost !px-3 !py-2">{labels.next} →</Link>}
    </nav>
  );
}
