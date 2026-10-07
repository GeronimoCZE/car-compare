/**
 * SSRF guard for the crawler. Feed URLs can be typed in by admins and sources can redirect anywhere,
 * so every hop is resolved and refused if it points at loopback, private, link-local (cloud metadata)
 * or other non-public address space.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class BlockedUrlError extends Error {}

function ipv4Blocked(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 4) return ipv4Blocked(ip);
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Blocked(mapped[1]);
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError(`scheme not allowed: ${url.protocol}`);
  if (url.username || url.password) throw new BlockedUrlError("credentials in URL");
  if (process.env.CRAWLER_ALLOW_PRIVATE === "1") return url; // local testing only
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isBlockedIp(a.address))) throw new BlockedUrlError(`non-public address for ${url.hostname}`);
  return url;
}
