import type { Metadata } from "next";

import type { Locale } from "./config";
import { locales } from "./config";
import { getLocaleContent } from "./translations";

export const SITE_URL = "https://gorhrod-codex.web.app";

export type PageKey = "home" | "about" | "services" | "contact";

function getPathByPage(page: PageKey): string {
  if (page === "home") return "";
  return `/${page}`;
}

export function createPageMetadata(locale: Locale, page: PageKey): Metadata {
  const t = getLocaleContent(locale);
  const pageSeo = t.seo[page];
  const pagePath = getPathByPage(page);
  const canonical = `${SITE_URL}/${locale}${pagePath}`;

  const languageAlternates = Object.fromEntries(
    locales.map((lang) => [lang, `${SITE_URL}/${lang}${pagePath}`]),
  );

  return {
    title: pageSeo.title,
    description: pageSeo.description,
    keywords: pageSeo.keywords,
    alternates: {
      canonical,
      languages: {
        ...languageAlternates,
        "x-default": `${SITE_URL}/ko${pagePath}`,
      },
    },
    openGraph: {
      type: "website",
      locale,
      title: pageSeo.title,
      description: pageSeo.description,
      url: canonical,
      siteName: t.brand,
      images: [
        {
          url: `${SITE_URL}/logo.svg`,
          width: 512,
          height: 512,
          alt: `${t.brand} Logo`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageSeo.title,
      description: pageSeo.description,
      images: [`${SITE_URL}/logo.svg`],
      creator: "@gorhrod",
    },
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export function siteBaseMetadata(): Metadata {
  const t = getLocaleContent("ko");

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t.seo.home.title,
      template: `%s | ${t.brand}`,
    },
    description: t.seo.home.description,
    applicationName: t.brand,
    category: "technology",
    classification: "Developer Portfolio",
    creator: "GORHROD",
    publisher: "GORHROD",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    authors: [{ name: "GORHROD", url: SITE_URL }],
    referrer: "origin-when-cross-origin",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    other: {
      "theme-color": "#0b1620",
    },
  };
}

export function buildJsonLd(locale: Locale, page: PageKey) {
  const t = getLocaleContent(locale);
  const pagePath = getPathByPage(page);
  const pageUrl = `${SITE_URL}/${locale}${pagePath}`;

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: t.seo[page].title,
    description: t.seo[page].description,
    inLanguage: locale,
    url: pageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: t.brand,
      url: SITE_URL,
    },
    about: {
      "@type": "Person",
      name: "GORHROD",
      jobTitle: "Automation Developer",
      knowsAbout: ["Web Crawling", "Database Automation", "Next.js", "Data Pipeline"],
      url: `${SITE_URL}/ko/about`,
    },
  };
}
