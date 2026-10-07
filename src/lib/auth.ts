import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, sessions, users, type User } from "@/db";

// __Host- prefix: browser only accepts it over HTTPS, for path "/", without a Domain, so subdomains can't plant or read it
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-sid" : "sid";
const SESSION_DAYS = 30;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

export async function destroyAllSessions(userId: number) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}


/** Current user for this request (cached per render). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = row[0]?.user ?? null;
  if (user?.blockedAt) return null;
  return user;
});

export async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u || u.role !== "admin") return null;
  return u;
}

export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, id: sha256(token) };
}
export { sha256 };

export { rateLimited } from "@/lib/security";
