import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { bookmarks, db, listings, savedSearches, sources } from "@/db";
import { ActionForm, DeleteSearchButton, RemoveBookmarkButton } from "@/components/AccountForms";
import { ConditionBadge } from "@/components/Badges";
import { fmt, getDict, isLocale, type Locale } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { listingPath } from "@/lib/paths";
import { eurRate } from "@/lib/stats";
import { changePassword, deleteAccount, updateProfile } from "./actions";

export const metadata: Metadata = { robots: { index: false } };

export default async function AccountPage({ params, searchParams }: PageProps<"/[locale]/account">) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = getDict(locale);
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/account`);
  const rate = await eurRate();
  const tab = String((await searchParams).tab ?? "bookmarks");

  const [saved, searches] = await Promise.all([
    db
      .select({ b: bookmarks, l: listings, sourceName: sources.name })
      .from(bookmarks)
      .innerJoin(listings, eq(listings.id, bookmarks.listingId))
      .innerJoin(sources, eq(sources.id, listings.sourceId))
      .where(eq(bookmarks.userId, user.id))
      .orderBy(desc(bookmarks.createdAt)),
    db.select().from(savedSearches).where(eq(savedSearches.userId, user.id)).orderBy(desc(savedSearches.createdAt)),
  ]);
  if (tab === "searches" && searches.some((s) => s.newMatches > 0)) {
    // Opening the tab acknowledges the notifications
    await db.update(savedSearches).set({ newMatches: 0 }).where(eq(savedSearches.userId, user.id));
  }
  const newTotal = searches.reduce((a, s) => a + s.newMatches, 0);
  const tabs = [
    ["bookmarks", `${t.account.bookmarks} (${saved.length})`],
    ["searches", `${t.account.searches}${newTotal ? ` • ${fmt(t.account.newMatches, { n: newTotal })}` : ""}`],
    ["profile", t.account.profile],
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.account.title}</h1>
      <p className="text-muted">{user.email}</p>
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/${locale}/account?tab=${k}`} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-ink"}`}>
            {label}
          </Link>
        ))}
      </div>

      {tab === "bookmarks" && (
        <div className="mt-6 space-y-3">
          {saved.length === 0 && <div className="card p-8 text-center text-muted">{t.account.noBookmarks}</div>}
          {saved.map(({ b, l: li, sourceName }) => {
            const delta = b.priceCzkAtSave != null && li.priceCzk != null ? li.priceCzk - b.priceCzkAtSave : 0;
            return (
              <div key={li.id} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={listingPath(locale, li)} className="font-semibold hover:underline">{li.title}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <ConditionBadge condition={li.condition} t={t} />
                    <span>{sourceName}</span>
                    {li.status !== "active" && <span className="text-red-600">{t.account.inactive}</span>}
                    {delta < 0 && <span className="font-semibold text-emerald-700">{fmt(t.account.priceDrop, { amount: money(-delta, locale, rate) })}</span>}
                    {delta > 0 && <span className="text-orange-700">{fmt(t.account.priceUp, { amount: money(delta, locale, rate) })}</span>}
                  </div>
                </div>
                <div className="text-lg font-bold">{money(li.priceCzk, locale, rate)}</div>
                <RemoveBookmarkButton id={li.id} label={t.account.delete} />
              </div>
            );
          })}
        </div>
      )}

      {tab === "searches" && (
        <div className="mt-6 space-y-3">
          {searches.length === 0 && <div className="card p-8 text-center text-muted">{t.account.noSearches}</div>}
          {searches.map((s) => (
            <div key={s.id} className="card flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{s.name}</div>
                {s.newMatches > 0 && <span className="chip mt-1 bg-brand-600 text-white">{fmt(t.account.newMatches, { n: s.newMatches })}</span>}
              </div>
              <Link href={`/${locale}/auta?${s.query.replace(/(^|&)cur=[^&]*/, "")}&sort=newest`} className="btn-ghost !py-2">{t.account.open}</Link>
              <DeleteSearchButton id={s.id} label={t.account.delete} />
            </div>
          ))}
        </div>
      )}

      {tab === "profile" && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-4 font-bold">{t.account.profile}</h2>
            <ActionForm action={updateProfile} submit={t.account.save}>
              <div>
                <label className="label" htmlFor="name">{t.auth.name}</label>
                <input id="name" name="name" defaultValue={user.name ?? ""} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="locale">{t.account.language}</label>
                <select id="locale" name="locale" defaultValue={user.locale} className="input">
                  <option value="cs">Čeština</option>
                  <option value="sk">Slovenčina</option>
                </select>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="emailAlerts" defaultChecked={user.emailAlerts} className="mt-1" />
                {t.account.emailAlerts}
              </label>
            </ActionForm>
          </section>
          <section className="card p-5">
            <h2 className="mb-4 font-bold">{t.account.changePassword}</h2>
            <ActionForm action={changePassword} submit={t.account.save}>
              <input name="current" type="password" required placeholder={t.account.currentPassword} autoComplete="current-password" className="input" />
              <input name="password" type="password" required minLength={8} placeholder={t.auth.passwordNew} autoComplete="new-password" className="input" />
              <input name="password2" type="password" required minLength={8} placeholder={t.auth.passwordConfirm} autoComplete="new-password" className="input" />
            </ActionForm>
          </section>
          <section className="card p-5 md:col-span-2">
            <h2 className="mb-2 font-bold">{t.account.privacy}</h2>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page */}
            <a href="/api/account/export" className="btn-ghost">{t.account.exportData}</a>
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50/50 p-4">
              <h3 className="font-semibold text-red-800">{t.account.deleteAccount}</h3>
              <p className="mb-3 text-sm text-red-800/80">{t.account.deleteWarning}</p>
              <ActionForm action={deleteAccount} submit={t.account.deleteAccount} danger>
                <input name="password" type="password" required placeholder={t.account.deleteConfirm} autoComplete="current-password" className="input max-w-sm" />
              </ActionForm>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
