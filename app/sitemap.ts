export const dynamic = "force-static";

import type { MetadataRoute } from "next";

import { locales } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/i18n/seo";
import { getPublicApiProductSlugs } from "@/lib/products/public-api-products";

const SITE_UPDATED_AT = process.env.NEXT_PUBLIC_SITE_UPDATED_AT;

function getLastModified(): Date {
  if (!SITE_UPDATED_AT) return new Date();

  const parsed = new Date(SITE_UPDATED_AT);
  if (Number.isNaN(parsed.getTime())) return new Date();

  return parsed;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = getLastModified();
  const localizedRoutes = ["", "/about", "/services", "/contact"];

  const rootEntry: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "daily",
      priority: 0.92,
    },
  ];

  const localizedEntries = locales.flatMap((locale) => {
    const staticRoutes = localizedRoutes.map((route) => ({
      url: `${SITE_URL}/${locale}${route}`,
      lastModified,
      changeFrequency: route === "" ? ("daily" as const) : ("weekly" as const),
      priority: route === "" ? 1 : route === "/services" ? 0.95 : 0.8,
    }));

    const productRoutes = getPublicApiProductSlugs(locale).map((slug) => ({
      url: `${SITE_URL}/${locale}/services/${slug}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }));

    return [...staticRoutes, ...productRoutes];
  });

  return [...rootEntry, ...localizedEntries];
}
