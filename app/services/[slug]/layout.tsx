import type { ReactNode } from "react";

import { getPublicApiProductSlugs } from "@/lib/products/public-api-products";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublicApiProductSlugs("ko").map((slug) => ({ slug }));
}

export default function ServiceSlugLayout({ children }: { children: ReactNode }) {
  return children;
}
