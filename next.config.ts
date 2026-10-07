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
