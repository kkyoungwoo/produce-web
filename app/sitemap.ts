export const dynamic = "force-static";

import type { MetadataRoute } from "next";

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
  const staticRoutes = ["", "/about", "/services", "/db-cleanup", "/contact", "/mp4Creater"];

  const rootEntries = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified,
    changeFrequency: route === "" ? ("daily" as const) : ("weekly" as const),
    priority: route === "" ? 1 : route === "/services" ? 0.95 : 0.8,
  }));

  const productEntries = getPublicApiProductSlugs("ko").map((slug) => ({
    url: `${SITE_URL}/services/${slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [...rootEntries, ...productEntries];
}
