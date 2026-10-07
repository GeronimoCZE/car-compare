import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["cs", "sk"];

/** Send visitors without a locale prefix to /cs or /sk (cookie, then Accept-Language, then host TLD). */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1];
  if (LOCALES.includes(first)) return NextResponse.next();

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

export const config = {
  // Skip API, the outbound redirect, Next internals and static files
  matcher: ["/((?!api|go|_next|favicon.ico|robots.txt|sitemap.xml|icon|opengraph-image|.*\\..*).*)"],
};
