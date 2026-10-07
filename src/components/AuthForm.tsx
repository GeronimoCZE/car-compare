"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/[locale]/(auth)/actions";
import type { Dict, Locale } from "@/i18n/dictionaries";

type Mode = "login" | "register" | "forgot" | "reset";

export function AuthForm({
  mode,
  action,
  locale,
  t,
  next,
  token,
}: {
  mode: Mode;
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  locale: Locale;
  t: Dict["auth"];
  next?: string;
  token?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const title = { login: t.loginTitle, register: t.registerTitle, forgot: t.forgotTitle, reset: t.resetTitle }[mode];
  const [termsBefore, termsAfter] = t.acceptTerms.split("{terms}");
  const [mid, privacyAfter] = (termsAfter ?? "").split("{privacy}");
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {mode === "register" && <p className="mt-2 text-sm text-muted">{t.benefits}</p>}
        {mode === "forgot" && <p className="mt-2 text-sm text-muted">{t.forgotText}</p>}
        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {next && <input type="hidden" name="next" value={next} />}
          {token && <input type="hidden" name="token" value={token} />}
          {mode !== "reset" && (
            <div>
              <label className="label" htmlFor="email">{t.email}</label>
              <input id="email" name="email" type="email" required autoComplete="email" className="input" />
            </div>
          )}
          {mode === "register" && (
            <div>
              <label className="label" htmlFor="name">{t.name}</label>
              <input id="name" name="name" maxLength={80} autoComplete="name" className="input" />
            </div>
          )}
          {mode !== "forgot" && (
            <div>
              <label className="label" htmlFor="password">{mode === "reset" ? t.passwordNew : t.password}</label>
              <input id="password" name="password" type="password" required minLength={mode === "login" ? 1 : 8} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} className="input" />
            </div>
          )}
          {(mode === "register" || mode === "reset") && (
            <div>
              <label className="label" htmlFor="password2">{t.passwordConfirm}</label>
              <input id="password2" name="password2" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="input" />
            </div>
          )}
          {mode === "register" && (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" name="terms" required className="mt-1" />
              <span>
                {termsBefore}
                <Link href={`/${locale}/terms`} target="_blank" className="text-brand-600 underline">{t.termsLink}</Link>
                {mid}
                <Link href={`/${locale}/privacy`} target="_blank" className="text-brand-600 underline">{t.privacyLink}</Link>
                {privacyAfter}
              </span>
            </label>
          )}
          {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
          <button disabled={pending} className="btn-primary w-full">
            {mode === "login" ? t.submitLogin : mode === "register" ? t.submitRegister : mode === "forgot" ? t.forgotTitle : t.resetTitle}
          </button>
        </form>
        <div className="mt-6 space-y-2 text-center text-sm text-muted">
          {mode === "login" && (
            <>
              <p><Link href={`/${locale}/forgot`} className="text-brand-600 hover:underline">{t.forgot}</Link></p>
              <p>{t.noAccount} <Link href={`/${locale}/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-600 hover:underline">{t.submitRegister}</Link></p>
            </>
          )}
          {mode === "register" && (
            <p>{t.haveAccount} <Link href={`/${locale}/login`} className="font-semibold text-brand-600 hover:underline">{t.submitLogin}</Link></p>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <p><Link href={`/${locale}/login`} className="text-brand-600 hover:underline">{t.submitLogin}</Link></p>
          )}
        </div>
      </div>
    </div>
  );
}
