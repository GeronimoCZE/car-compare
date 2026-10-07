import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/security";

/** Reject cross-site state-changing requests (cookies are SameSite=Lax, this is defence in depth). */
export const sameOrigin = (req: NextRequest) => isSameOrigin(req.headers);

/** JSON response. Private by default; pass `publicMaxAge` for anonymous, shareable data. */
export function json(data: unknown, status = 200, publicMaxAge?: number) {
  const res = NextResponse.json(data, { status });
  res.headers.set(
    "Cache-Control",
    publicMaxAge && status === 200 ? `public, max-age=${publicMaxAge}, s-maxage=${publicMaxAge}, stale-while-revalidate=${publicMaxAge * 5}` : "private, no-store",
  );
  return res;
}
