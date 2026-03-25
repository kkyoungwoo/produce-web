import type { Metadata } from "next";

import SiteFrame from "@/components/site-frame";
import DbCleanupClient from "@/components/db-cleanup/db-cleanup-client";
import { SITE_URL } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";

export function generateMetadata(): Metadata {
  const t = getLocaleContent("ko");
  const pagePath = "/db-cleanup";

  return {
    title: `${t.dbCleanup.metaTitle} | ${t.brand}`,
    description: t.dbCleanup.metaDescription,
    alternates: {
      canonical: `${SITE_URL}${pagePath}`,
    },
    openGraph: {
      type: "website",
      locale: "ko",
      title: `${t.dbCleanup.metaTitle} | ${t.brand}`,
      description: t.dbCleanup.ogDescription,
      url: `${SITE_URL}${pagePath}`,
      siteName: t.brand,
      images: [{ url: `${SITE_URL}/logo.svg` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${t.dbCleanup.metaTitle} | ${t.brand}`,
      description: t.dbCleanup.twitterDescription,
      images: [`${SITE_URL}/logo.svg`],
    },
  };
}

export default function DbCleanupPage() {
  const t = getLocaleContent("ko");

  return (
    <SiteFrame>
      <section className="relative min-h-[calc(100vh-160px)] w-full pt-5">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_2%,rgba(94,154,255,0.18),transparent_24%),radial-gradient(circle_at_88%_10%,rgba(24,198,158,0.14),transparent_24%),linear-gradient(180deg,#f7faff_0%,#edf4ff_100%)]" />
        <div className="mx-auto my-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
          <DbCleanupClient labels={t.dbCleanup} />
        </div>
      </section>
    </SiteFrame>
  );
}
