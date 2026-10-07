"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import { getDict, isLocale } from "@/i18n/dictionaries";
import { destroyAllSessions, destroySession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";

export type AccountState = { error?: string; ok?: string } | undefined;

export async function updateProfile(_: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) redirect("/cs/login");
  const l = String(fd.get("locale"));
  const locale = isLocale(l) ? l : user.locale;
  await db
    .update(users)
    .set({ name: String(fd.get("name") ?? "").trim().slice(0, 80) || null, locale, emailAlerts: fd.get("emailAlerts") === "on" })
    .where(eq(users.id, user.id));
  revalidatePath(`/${locale}/account`);
  return { ok: getDict(isLocale(locale) ? locale : "cs").account.saved };
}

export async function changePassword(_: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) redirect("/cs/login");
  const t = getDict(isLocale(user.locale) ? user.locale : "cs");
  if (!(await verifyPassword(String(fd.get("current") ?? ""), user.passwordHash))) return { error: t.auth.errors.invalid };
  const pw = String(fd.get("password") ?? "");
  if (pw.length < 8) return { error: t.auth.errors.weak };
  if (pw !== String(fd.get("password2") ?? "")) return { error: t.auth.errors.mismatch };
  await db.update(users).set({ passwordHash: await hashPassword(pw) }).where(eq(users.id, user.id));
  return { ok: t.account.saved };
}

export async function deleteAccount(_: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) redirect("/cs/login");
  const t = getDict(isLocale(user.locale) ? user.locale : "cs");
  if (!(await verifyPassword(String(fd.get("password") ?? ""), user.passwordHash))) return { error: t.auth.errors.invalid };
  await destroyAllSessions(user.id);
  await destroySession();
  // Bookmarks, saved searches and sessions cascade; reports keep the listing but lose the user link
  await db.delete(users).where(eq(users.id, user.id));
  redirect(`/${isLocale(user.locale) ? user.locale : "cs"}`);
}
