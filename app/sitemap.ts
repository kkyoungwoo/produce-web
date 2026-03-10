export const dynamic = "force-static";

import type { MetadataRoute } from "next";

import { locales } from "@/lib/i18n/config";

const siteUrl = "https://gorhrod-codex.web.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/about", "/services", "/contact"];

  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `${siteUrl}/${locale}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8,
    })),
  );
}
