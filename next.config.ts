import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Listing data changes constantly; pages render per request and cache via unstable_cache where useful.
  cacheComponents: false,
  output: "standalone",
  serverExternalPackages: ["postgres", "bcryptjs"],
  images: {
    // Thumbnails are hotlinked from the source sites and rendered with plain <img>.
    unoptimized: true,
  },
  poweredByHeader: false,
  async headers() {
    const security = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      // Pages get a per-request nonce CSP from src/proxy.ts; everything else (files, API, redirects) gets this locked-down one
      { key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" },
    ];
    const pageHeaders = security.filter((h) => h.key !== "Content-Security-Policy");
    return [
      { source: "/((?!cs|sk).*)", headers: security },
      { source: "/:locale(cs|sk)/:path*", headers: pageHeaders },
      { source: "/:locale(cs|sk)", headers: pageHeaders },
      // API is same-origin only (CORS is refused in src/proxy.ts); routes set their own Cache-Control
      { source: "/api/:path*", headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-origin" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
