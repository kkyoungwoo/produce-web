export const dynamic = "force-static";

import type { MetadataRoute } from "next";

import { locales } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/i18n/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/about", "/services", "/contact"];
  const now = new Date();

  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `${SITE_URL}/${locale}${route}`,
      lastModified: now,
      changeFrequency: route === "" ? ("daily" as const) : ("weekly" as const),
      priority: route === "" ? 1 : 0.82,
    })),
  );
}
