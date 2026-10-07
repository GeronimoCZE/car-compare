import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/go/", "/*/admin", "/*/account", "/*/compare", "/*/login", "/*/register", "/*/forgot", "/*/reset"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
