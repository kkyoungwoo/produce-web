import { ReactNode } from "react";

import { locales } from "@/lib/i18n/config";
import { getPublicApiProductSlugs } from "@/lib/products/public-api-products";

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    getPublicApiProductSlugs(locale).map((slug) => ({ locale, slug })),
  );
}

export default function ServiceSlugLayout({ children }: { children: ReactNode }) {
  return children;
}