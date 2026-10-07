import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, listings } from "@/db";

/** Outbound redirect to the source listing. Keeps the source URL out of crawlers' link graph. */
export async function GET(req: NextRequest, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  const l = await db.query.listings.findFirst({ where: eq(listings.id, Number(id)), columns: { url: true } });
  if (!l || !/^https?:\/\//.test(l.url)) return NextResponse.redirect(new URL("/", req.url));
  const res = NextResponse.redirect(l.url, 302);
  res.headers.set("X-Robots-Tag", "noindex");
  res.headers.set("Referrer-Policy", "origin");
  return res;
}
