import type { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { modelFacets } from "@/lib/search";
import { modelName } from "@/parser/catalog";

export async function GET(req: NextRequest) {
  const make = req.nextUrl.searchParams.get("make");
  if (!make) return json([]);
  const rows = await modelFacets(make);
  return json(rows.map((r) => ({ slug: r.model, name: modelName(make, r.model), count: r.count })));
}
