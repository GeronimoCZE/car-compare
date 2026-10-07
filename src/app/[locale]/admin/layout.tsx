import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { robots: { index: false } };

const NAV = [
  ["", "Přehled"],
  ["/sources", "Zdroje"],
  ["/runs", "Běhy"],
  ["/listings", "Inzeráty"],
  ["/reports", "Nahlášení"],
  ["/users", "Uživatelé"],
  ["/parser", "Test parseru"],
];

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/admin`);
  if (user.role !== "admin") notFound();
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {NAV.map(([p, label]) => (
          <Link key={p} href={`/${locale}/admin${p}`} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-white">
            {label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
