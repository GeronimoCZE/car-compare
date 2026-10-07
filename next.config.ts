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
      {
        key: "Content-Security-Policy",
        // Listing photos are hotlinked from source sites, hence img-src https:
        value: [
          "default-src 'self'",
          "img-src 'self' https: data:",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join("; "),
      },
    ];
    return [
      { source: "/:path*", headers: security },
      // API is same-origin only: no CORS headers are sent, and responses are never cached by shared caches
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Cross-Origin-Resource-Policy", value: "same-origin" }] },
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
