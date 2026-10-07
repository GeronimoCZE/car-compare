import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/security";

const LOCALES = ["cs", "sk"];
const dev = process.env.NODE_ENV !== "production";

/**
 * Per-request CSP. Scripts must carry this request's nonce ('strict-dynamic' lets Next's own chunks load),
 * so an injected <script> or inline handler never runs. Styles stay 'unsafe-inline' for chart attributes.
 */
function csp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Listing photos are hotlinked from the source sites
    "img-src 'self' https: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    ...((process.env.SITE_URL ?? "").startsWith("https:") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * CORS: the API serves only this site. Cross-origin preflights and requests are refused outright, and no
 * Access-Control-Allow-* headers are ever sent, so other sites can neither call nor read it.
 */
function api(req: NextRequest) {
  if (!isSameOrigin(req.headers)) {
    return new NextResponse(JSON.stringify({ error: "cross-origin requests are not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" },
    });
  }
  if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: { Allow: "GET, POST, DELETE", Vary: "Origin" } });
  const res = NextResponse.next();
  res.headers.set("Vary", "Origin");
  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) return api(req);

  const first = pathname.split("/")[1];
  if (!LOCALES.includes(first)) {
    // Send visitors without a locale prefix to /cs or /sk (cookie, then Accept-Language, then host TLD)
    let locale = req.cookies.get("locale")?.value;
    if (!locale || !LOCALES.includes(locale)) {
      const host = req.headers.get("host") ?? "";
      const accept = req.headers.get("accept-language")?.toLowerCase() ?? "";
      locale = host.endsWith(".sk") || /^sk\b|,\s*sk\b/.test(accept) ? "sk" : "cs";
    }
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  // Next reads the nonce from the request's CSP header and stamps it on its own inline scripts
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", policy);
  return res;
}

export const config = {
  // Skip the outbound redirect, Next internals and static files; prefetches don't need a fresh nonce
  matcher: [
    {
      source: "/((?!go/|_next/|favicon.ico|robots.txt|sitemap.xml|icon|opengraph-image|.*\\.[a-z0-9]+$).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
