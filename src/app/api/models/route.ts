import type { NextRequest } from "next/server";
import { json } from "@/lib/api";
import { modelFacets } from "@/lib/search";
import { MAKE_BY_SLUG, modelName } from "@/parser/catalog";

export async function GET(req: NextRequest) {
  const make = req.nextUrl.searchParams.get("make");
  if (!make || !MAKE_BY_SLUG.has(make)) return json([], 200, 300);
  const rows = await modelFacets(make);
  return json(rows.map((r) => ({ slug: r.model, name: modelName(make, r.model), count: r.count })), 200, 300);
}
