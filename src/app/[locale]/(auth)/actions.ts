"use server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, passwordResets, users } from "@/db";
import { isLocale, getDict } from "@/i18n/dictionaries";
import { createSession, destroyAllSessions, destroySession, hashPassword, newToken, sha256, verifyPassword } from "@/lib/auth";
import { clientIp, passwordOk, rateLimited } from "@/lib/security";
import { sendMail } from "@/lib/mail";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export type FormState = { error?: string; ok?: string } | undefined;

const loc = (fd: FormData) => {
  const l = String(fd.get("locale") ?? "cs");
  return isLocale(l) ? l : "cs";
};
const safeNext = (v: FormDataEntryValue | null, locale: string) => {
  const s = String(v ?? "");
  return s.startsWith(`/${locale}/`) && !s.startsWith("//") ? s : `/${locale}/account`;
};
const ip = async () => clientIp(await headers());
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const t = getDict(locale).auth.errors;
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  // Per account (slows guessing one password) and per IP (slows spraying many accounts)
  if (rateLimited(`login:${email}`, 10) || rateLimited(`login-ip:${await ip()}`, 30)) return { error: t.rate };
  if (password.length > 1024) return { error: t.invalid };
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    await hashPassword(password); // keep timing similar so the form doesn't reveal which emails exist
    return { error: t.invalid };
  }
  if (!(await verifyPassword(password, user.passwordHash))) return { error: t.invalid };
  if (user.blockedAt) return { error: t.blocked };
  await createSession(user.id);
  redirect(safeNext(fd.get("next"), locale));
}

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const t = getDict(locale).auth.errors;
  if (rateLimited(`register:${await ip()}`, 5)) return { error: t.rate };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const name = String(fd.get("name") ?? "").trim().slice(0, 80) || null;
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: t.email };
  if (!passwordOk(password)) return { error: t.weak };
  if (password !== String(fd.get("password2") ?? "")) return { error: t.mismatch };
  if (fd.get("terms") !== "on") return { error: t.terms };
  const exists = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (exists) return { error: t.exists };
  const [u] = await db
    .insert(users)
    .values({ email, name, passwordHash: await hashPassword(password), locale, termsAcceptedAt: new Date() })
    .returning({ id: users.id });
  await createSession(u.id);
  redirect(safeNext(fd.get("next"), locale));
}

export async function logoutAction(fd: FormData) {
  await destroySession();
  redirect(`/${loc(fd)}`);
}

export async function forgotAction(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const t = getDict(locale).auth;
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (rateLimited(`forgot:${await ip()}`, 5) || rateLimited(`forgot:${email}`, 3, 3600_000)) return { error: t.errors.rate };
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (user) {
    const { token, id } = newToken();
    await db.insert(passwordResets).values({ id, userId: user.id, expiresAt: new Date(Date.now() + 3600_000) });
    const link = `${SITE_URL}/${locale}/reset?token=${token}`;
    await sendMail(email, `${SITE_NAME}: ${t.resetTitle}`, `${t.forgotText}\n\n${link}\n`);
  }
  // Same answer either way so the form can't be used to discover accounts
  return { ok: t.forgotSent };
}

export async function resetAction(_: FormState, fd: FormData): Promise<FormState> {
  const locale = loc(fd);
  const t = getDict(locale).auth;
  if (rateLimited(`reset:${await ip()}`, 10)) return { error: t.errors.rate };
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  if (!passwordOk(password)) return { error: t.errors.weak };
  if (password !== String(fd.get("password2") ?? "")) return { error: t.errors.mismatch };
  const row = await db.query.passwordResets.findFirst({
    where: and(eq(passwordResets.id, sha256(token)), gt(passwordResets.expiresAt, new Date()), isNull(passwordResets.usedAt)),
  });
  if (!row) return { error: t.resetInvalid };
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, row.userId));
  // Burn every outstanding reset link for this account, not only the one used
  await db.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.userId, row.userId), isNull(passwordResets.usedAt)));
  await destroyAllSessions(row.userId);
  return { ok: t.resetDone };
}
