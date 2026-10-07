"use client";
import { useActionState } from "react";
import type { AccountState } from "@/app/[locale]/account/actions";

export function ActionForm({
  action,
  children,
  submit,
  danger,
}: {
  action: (s: AccountState, fd: FormData) => Promise<AccountState>;
  children: React.ReactNode;
  submit: string;
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      {children}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      <button disabled={pending} className={danger ? "btn-danger" : "btn-primary"}>{submit}</button>
    </form>
  );
}

export function DeleteSearchButton({ id, label }: { id: number; label: string }) {
  return (
    <button
      onClick={async () => {
        await fetch(`/api/saved-searches?id=${id}`, { method: "DELETE" });
        location.reload();
      }}
      className="text-sm text-muted hover:text-red-600"
    >
      {label}
    </button>
  );
}

export function RemoveBookmarkButton({ id, label }: { id: number; label: string }) {
  return (
    <button
      onClick={async () => {
        await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: id }) });
        location.reload();
      }}
      className="text-sm text-muted hover:text-red-600"
    >
      {label}
    </button>
  );
}
