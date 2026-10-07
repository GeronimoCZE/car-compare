import { NextResponse, type NextRequest } from "next/server";

/** Reject cross-site state-changing requests (cookies are SameSite=Lax, this is defence in depth). */
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
