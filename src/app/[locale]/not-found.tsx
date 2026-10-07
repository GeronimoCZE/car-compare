import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="text-6xl font-extrabold text-brand-600">404</div>
      <p className="mt-4 text-lg">Stránka nenalezena · Stránka nenájdená</p>
      <Link href="/" className="btn-primary mt-8">← Home</Link>
    </div>
  );
}
