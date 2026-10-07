export function CarPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 ${className}`}>
      <svg width="72" height="40" viewBox="0 0 72 40" aria-hidden className="text-slate-400">
        <path d="M6 28c0-3 1-5 4-6l8-2 9-9c2-2 4-3 7-3h12c3 0 5 1 7 3l7 8 5 1c3 1 4 3 4 6v3H6z" fill="currentColor" opacity=".55" />
        <circle cx="19" cy="31" r="5" fill="currentColor" />
        <circle cx="53" cy="31" r="5" fill="currentColor" />
      </svg>
    </div>
  );
}
