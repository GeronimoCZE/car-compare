"use client";
import { useState } from "react";

export function ReportForm({ listingId, labels }: { listingId: number; labels: { report: string; done: string; reasons: Record<string, string> } }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <p className="text-sm text-emerald-700">{labels.done}</p>;
  if (!open) return <button onClick={() => setOpen(true)} className="text-sm text-muted underline hover:text-ink">{labels.report}</button>;
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, reason: fd.get("reason"), message: fd.get("message") }) });
        if (res.ok) setDone(true);
      }}
    >
      <select name="reason" className="input" required>
        {Object.entries(labels.reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <textarea name="message" maxLength={1000} rows={2} className="input" />
      <button className="btn-ghost">{labels.report}</button>
    </form>
  );
}
