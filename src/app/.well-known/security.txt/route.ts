import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";

/** RFC 9116: where to report vulnerabilities. */
export function GET() {
  const expires = new Date(Date.now() + 180 * 86400_000).toISOString();
  const body = [`Contact: mailto:${CONTACT_EMAIL}`, `Expires: ${expires}`, "Preferred-Languages: cs, sk, en", `Canonical: ${SITE_URL}/.well-known/security.txt`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
