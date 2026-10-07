import { desc, ilike, sql } from "drizzle-orm";
import { bookmarks, db, users } from "@/db";
import { setUserRole, toggleBlock } from "../actions";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: PageProps<"/[locale]/admin/users">) {
  const q = String((await searchParams).q ?? "");
  const rows = await db
    .select({ u: users, bookmarks: sql<number>`(select count(*)::int from ${bookmarks} where ${bookmarks.userId} = ${users.id})` })
    .from(users)
    .where(q ? ilike(users.email, `%${q}%`) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Uživatelé</h1>
      <form><input name="q" defaultValue={q} placeholder="Hledat e-mail" className="input max-w-sm" /></form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr><th className="p-3">E-mail</th><th>Role</th><th>Registrace</th><th>Poslední přihlášení</th><th>Oblíbené</th><th /></tr>
          </thead>
          <tbody>
            {rows.map(({ u, bookmarks: b }) => (
              <tr key={u.id} className="border-t border-line">
                <td className="p-3">{u.email}{u.blockedAt && <span className="chip ml-2 bg-red-50 text-red-700">blokován</span>}</td>
                <td>{u.role}</td>
                <td>{u.createdAt.toLocaleDateString("cs-CZ")}</td>
                <td>{u.lastLoginAt?.toLocaleString("cs-CZ") ?? "–"}</td>
                <td>{b}</td>
                <td className="flex gap-2 p-2">
                  <form action={setUserRole}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="role" value={u.role === "admin" ? "user" : "admin"} /><button className="btn-ghost !px-2 !py-1 text-xs">{u.role === "admin" ? "Odebrat admina" : "Udělat adminem"}</button></form>
                  <form action={toggleBlock}><input type="hidden" name="id" value={u.id} /><button className="btn-ghost !px-2 !py-1 text-xs">{u.blockedAt ? "Odblokovat" : "Zablokovat"}</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
