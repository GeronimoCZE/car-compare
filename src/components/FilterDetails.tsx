"use client";
import { useEffect, useRef } from "react";

/** Collapsible filter panel: closed on phones so results come first, always open on desktop. */
export function FilterDetails({ summary, children }: { summary: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && window.matchMedia("(min-width: 1024px)").matches) ref.current.open = true;
  }, []);
  return (
    <details ref={ref} className="group">
      <summary className="cursor-pointer list-none font-bold">
        <span className="flex items-center justify-between">
          {summary}
          <span className="text-muted transition group-open:rotate-180 lg:hidden">▾</span>
        </span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
