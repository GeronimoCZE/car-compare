"use client";
import { useActionState } from "react";

type State = { ok?: string; error?: string } | undefined;

export function StatefulForm({ action, children, submit, className }: { action: (s: State, fd: FormData) => Promise<State>; children: React.ReactNode; submit: string; className?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className ?? "space-y-2"}>
      {children}
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary !py-2">{submit}</button>
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
