import type { Dict } from "@/i18n/dictionaries";

const CONDITION_STYLE: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  unknown: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  damaged: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  non_running: "bg-red-50 text-red-700 ring-1 ring-red-200",
  parts: "bg-zinc-800 text-white",
};

const CONDITION_ICON: Record<string, string> = { ok: "✓", unknown: "?", damaged: "!", non_running: "✕", parts: "⚙" };

export function ConditionBadge({ condition, t }: { condition: string; t: Dict }) {
  const key = condition as keyof Dict["condition"];
  return (
    <span className={`chip ${CONDITION_STYLE[condition] ?? CONDITION_STYLE.unknown}`} title={t.conditionHint[key]}>
      <span aria-hidden>{CONDITION_ICON[condition]}</span>
      {t.condition[key]}
    </span>
  );
}

export function dealLevel(score: number | null | undefined): "great" | "good" | "fair" | "high" | null {
  if (score == null) return null;
  if (score <= 0.85) return "great";
  if (score <= 0.95) return "good";
  if (score <= 1.08) return "fair";
  return "high";
}

const DEAL_STYLE = {
  great: "bg-emerald-600 text-white",
  good: "bg-emerald-100 text-emerald-800",
  fair: "bg-slate-100 text-slate-700",
  high: "bg-orange-100 text-orange-800",
};

/** Deal badges only make sense for drivable cars; wrecks are always "cheap". */
export function DealBadge({ score, condition, t }: { score: number | null; condition: string; t: Dict }) {
  const level = dealLevel(score);
  if (!level || (condition !== "ok" && condition !== "unknown")) return null;
  const pct = Math.round(Math.abs(1 - (score as number)) * 100);
  return (
    <span className={`chip ${DEAL_STYLE[level]}`}>
      {t.deal[level]}
      {level !== "fair" && <span className="font-normal opacity-90">{level === "high" ? `+${pct} %` : `−${pct} %`}</span>}
    </span>
  );
}
