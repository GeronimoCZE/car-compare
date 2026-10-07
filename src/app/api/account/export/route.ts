import { eq } from "drizzle-orm";
import { bookmarks, db, reports, savedSearches } from "@/db";
import { json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

/** GDPR art. 15/20: everything we store about the signed-in user. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const { passwordHash: _p, ...profile } = user;
  const data = {
    exportedAt: new Date().toISOString(),
    profile,
    bookmarks: await db.select().from(bookmarks).where(eq(bookmarks.userId, user.id)),
    savedSearches: await db.select().from(savedSearches).where(eq(savedSearches.userId, user.id)),
    reports: await db.select().from(reports).where(eq(reports.userId, user.id)),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="my-data.json"` },
  });
}
