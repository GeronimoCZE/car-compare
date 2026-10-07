import { describe, expect, it } from "vitest";
import { assertPublicUrl, isBlockedIp } from "@/ingest/netguard";
import { clientIp, isSameOrigin, rateLimited } from "@/lib/security";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe("SSRF guard", () => {
  it("blocks private, loopback and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(isBlockedIp(ip), ip).toBe(true);
    for (const ip of ["77.75.77.222", "2a02:598::1", "8.8.8.8"]) expect(isBlockedIp(ip), ip).toBe(false);
  });
  it("rejects bad schemes and literal private hosts", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow();
    await expect(assertPublicUrl("http://[::1]:5432/")).rejects.toThrow();
    await expect(assertPublicUrl("http://user:pw@8.8.8.8/")).rejects.toThrow();
  });
});

describe("origin check", () => {
  it("accepts same origin and non-browser requests", () => {
    expect(isSameOrigin(h({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(true);
    expect(isSameOrigin(h({ host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(h({ host: "localhost:3000", "sec-fetch-site": "same-origin" }))).toBe(true);
  });
  it("rejects cross-site", () => {
    expect(isSameOrigin(h({ host: "localhost:3000", origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(h({ host: "localhost:3000", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(h({ host: "localhost:3000", origin: "null" }))).toBe(false);
  });
});

describe("client ip", () => {
  it("ignores X-Forwarded-For unless proxies are trusted", () => {
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4" }))).toBe("direct");
    process.env.TRUST_PROXY_HOPS = "1";
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
    delete process.env.TRUST_PROXY_HOPS;
  });
});

describe("rate limiter", () => {
  it("blocks after the limit", () => {
    const k = `t${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimited(k, 3)).toBe(false);
    expect(rateLimited(k, 3)).toBe(true);
  });
});
