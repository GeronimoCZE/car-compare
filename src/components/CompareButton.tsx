"use client";
import { useEffect, useState } from "react";

const KEY = "compare";
export function readCompare(): number[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]").filter((n: unknown) => typeof n === "number");
  } catch {
    return [];
  }
}
export function writeCompare(ids: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-4)));
    window.dispatchEvent(new Event("compare-change"));
  } catch {
    /* storage blocked */
  }
}

export function CompareButton({ id, labels, compact }: { id: number; labels: { add: string; added: string }; compact?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(readCompare().includes(id));
    sync();
    window.addEventListener("compare-change", sync);
    return () => window.removeEventListener("compare-change", sync);
  }, [id]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        const ids = readCompare();
        writeCompare(on ? ids.filter((x) => x !== id) : [...ids.filter((x) => x !== id), id]);
      }}
      aria-pressed={on}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-white text-slate-600 hover:bg-slate-50"} ${compact ? "" : "px-4 py-2.5 text-sm"}`}
    >
      {on ? "✓ " + labels.added : "⇄ " + labels.add}
    </button>
  );
}
