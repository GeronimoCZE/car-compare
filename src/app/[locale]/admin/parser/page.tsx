import { parseListing } from "@/parser/extract";

export const dynamic = "force-dynamic";

/** Paste any ad text and see what the parser extracts, with the evidence for each value. */
export default async function ParserPage({ searchParams }: PageProps<"/[locale]/admin/parser">) {
  const sp = await searchParams;
  const title = String(sp.title ?? "Škoda Octavia Combi 2.0 TDI 110kW DSG");
  const description = String(sp.description ?? "Rok výroby 2016, najeto 186 000 km. Nikdy nebourané, servisní knížka. STK do 05/2027. Možnost odpočtu DPH.");
  const result = parseListing({ title, description, price: Number(sp.price) || null, currency: "CZK" });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Test parseru</h1>
      <form className="card space-y-3 p-5">
        <input name="title" defaultValue={title} className="input" />
        <textarea name="description" defaultValue={description} rows={6} className="input" />
        <input name="price" defaultValue={String(sp.price ?? "")} placeholder="Cena (Kč)" className="input max-w-xs" />
        <button className="btn-primary">Rozpoznat</button>
      </form>
      <pre className="card overflow-auto p-5 text-xs">{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}
