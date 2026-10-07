"use client";
import { useState } from "react";

export function SaveSearchButton({ loggedIn, loginHref, name, query, currency, labels }: { loggedIn: boolean; loginHref: string; name: string; query: string; currency: string; labels: { save: string; saved: string; login: string } }) {
  const [done, setDone] = useState(false);
  if (!loggedIn) return <a href={loginHref} className="btn-ghost !py-2" title={labels.login}>🔔 {labels.save}</a>;
  return (
    <button
      type="button"
      disabled={done}
      className="btn-ghost !py-2"
      onClick={async () => {
        const q = new URLSearchParams(query);
        q.set("cur", currency);
        const res = await fetch("/api/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, query: q.toString() }) });
        if (res.ok) setDone(true);
      }}
    >
      {done ? `✓ ${labels.saved}` : `🔔 ${labels.save}`}
    </button>
  );
}
