"use client";
import { useState, useTransition } from "react";

export function BookmarkButton({ id, initial, loggedIn, labels, loginHref }: { id: number; initial: boolean; loggedIn: boolean; labels: { add: string; added: string }; loginHref: string }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  if (!loggedIn)
    return (
      <a href={loginHref} className="btn-ghost">♡ {labels.add}</a>
    );
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      onClick={() =>
        start(async () => {
          const res = await fetch("/api/bookmarks", { method: on ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: id }) });
          if (res.ok) setOn(!on);
        })
      }
      className={on ? "btn border border-rose-200 bg-rose-50 text-rose-700" : "btn-ghost"}
    >
      {on ? "♥" : "♡"} {on ? labels.added : labels.add}
    </button>
  );
}
