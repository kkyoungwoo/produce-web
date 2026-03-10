import type { Metadata } from "next";

import type { Locale } from "./config";
import { locales } from "./config";
import { content } from "./translations";

const SITE_URL = "https://gorhrod-codex.web.app";

type PageKey = "home" | "about" | "services" | "contact";

function getPathByPage(page: PageKey): string {
  if (page === "home") return "";
  return `/${page}`;
}

export function createPageMetadata(locale: Locale, page: PageKey): Metadata {
  const localeContent = content[locale].seo[page];
  const pagePath = getPathByPage(page);
  const canonical = `${SITE_URL}/${locale}${pagePath}`;

  const languageAlternates = Object.fromEntries(
    locales.map((lang) => [lang, `${SITE_URL}/${lang}${pagePath}`]),
  );

  return {
    title: localeContent.title,
    description: localeContent.description,
    keywords: localeContent.keywords,
    alternates: {
      canonical,
      languages: languageAlternates,
    },
    openGraph: {
      type: "website",
      locale,
      title: localeContent.title,
      description: localeContent.description,
      url: canonical,
      siteName: content[locale].brand,
      images: [
        {
          url: `${SITE_URL}/logo.svg`,
          width: 512,
          height: 512,
          alt: content[locale].brand,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: localeContent.title,
      description: localeContent.description,
      images: [`${SITE_URL}/logo.svg`],
    },
  };
}

export function siteBaseMetadata(): Metadata {
  const ko = content.ko.seo.home;
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: ko.title,
      template: "%s | 글로벌 프로듀스",
    },
    description: ko.description,
    applicationName: "글로벌 프로듀스",
    category: "business",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}
