import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/features", "/pricing", "/sign-up"],
        disallow: [
          "/api/",
          "/account",
          "/dashboard",
          "/workspace",
          "/checkout",
          "/onboarding",
          "/invite",
          "/demo",
          "/sign-in",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
