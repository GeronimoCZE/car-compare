import { SITE_NAME } from "@/lib/site";

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#2554e8" />
        <circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" strokeWidth="2.6" />
        <path d="M19 19l6 6" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M10.8 15.2l2.2-3h3l1.6 3" fill="none" stroke="#9fd8ff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      {SITE_NAME}
    </span>
  );
}
