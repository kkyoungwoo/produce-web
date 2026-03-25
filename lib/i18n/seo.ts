import type { Metadata } from "next";

import { getPublicApiProducts } from "@/lib/products/public-api-products";

import type { Locale } from "./config";
import { getLocaleContent } from "./translations";
import type { ProductItem } from "./types";

export const SITE_URL = "https://gorhrod-codex.web.app";

export type PageKey = "home" | "about" | "services" | "contact";

const CORE_SEO_KEYWORDS = [
  "공공 API",
  "data.go.kr",
  "데이터 분석",
  "조건 조회",
  "엑셀 다운로드",
  "지역 필터",
  "실무 데이터 활용",
  "API 조회 화면",
  "데이터 탐색",
  "운영 분석",
  "시장 조사",
  "사업 활용 데이터",
];

function getPathByPage(page: PageKey): string {
  if (page === "home") return "";
  return `/${page}`;
}

function uniqueKeywords(...groups: Array<string[] | undefined>): string[] {
  const set = new Set<string>();

  for (const group of groups) {
    if (!group) continue;
    for (const keyword of group) {
      const normalized = keyword.trim();
      if (!normalized) continue;
      set.add(normalized);
    }
  }

  return Array.from(set);
}

function buildProductKeywords(product: ProductItem): string[] {
  return uniqueKeywords(
    CORE_SEO_KEYWORDS,
    [
      product.title,
      product.collectFocus,
      product.portalDataId,
      "공공 API 데이터",
      "데이터 조회",
      "데이터 분석 화면",
      "필터 조회",
      "엑셀 정리",
    ],
  );
}

function buildProductCatalog() {
  const t = getLocaleContent("ko");
  const products = getPublicApiProducts("ko");

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${t.brand} 데이터 페이지 모음`,
    url: `${SITE_URL}/services`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/services/${item.slug}`,
        name: item.title,
        description: item.summary,
      })),
    },
  };
}

export function createPageMetadata(locale: Locale, page: PageKey): Metadata {
  void locale;
  const t = getLocaleContent("ko");
  const pageSeo = t.seo[page];
  const pagePath = getPathByPage(page);
  const canonical = `${SITE_URL}${pagePath}`;
  const keywords = uniqueKeywords(pageSeo.keywords, CORE_SEO_KEYWORDS);

  return {
    title: pageSeo.title,
    description: pageSeo.description,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      locale: "ko",
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

export function createProductMetadata(locale: Locale, product: ProductItem): Metadata {
  void locale;
  const t = getLocaleContent("ko");
  const canonical = `${SITE_URL}/services/${product.slug}`;

  return {
    title: `${product.title} | ${t.brand}`,
    description: `${product.summary} | ${product.collectFocus}`,
    keywords: buildProductKeywords(product),
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      locale: "ko",
      title: product.title,
      description: product.summary,
      url: canonical,
      siteName: t.brand,
      images: [{ url: `${SITE_URL}/logo.svg` }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description: product.summary,
      images: [`${SITE_URL}/logo.svg`],
    },
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

export function siteBaseMetadata(): Metadata {
  const t = getLocaleContent("ko");
  const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  const naverSiteVerification = process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t.seo.home.title,
      template: `%s | ${t.brand}`,
    },
    description: t.seo.home.description,
    applicationName: t.brand,
    category: "software",
    classification: "공공 API 데이터 조회 및 분석 도구",
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
    verification: {
      ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
      ...(naverSiteVerification ? { other: { "naver-site-verification": naverSiteVerification } } : {}),
    },
    other: {
      "theme-color": "#f5f9ff",
      "application-name": t.brand,
    },
  };
}

export function buildJsonLd(locale: Locale, page: PageKey) {
  void locale;
  const t = getLocaleContent("ko");
  const pagePath = getPathByPage(page);
  const pageUrl = `${SITE_URL}${pagePath}`;

  const pageSchema = {
    "@context": "https://schema.org",
    "@type": page === "contact" ? "ContactPage" : "WebPage",
    name: t.seo[page].title,
    description: t.seo[page].description,
    inLanguage: "ko",
    url: pageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: t.brand,
      url: SITE_URL,
    },
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: t.brand,
    url: SITE_URL,
    sameAs: ["https://github.com/gorhr"],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: t.contact.emailValue,
      availableLanguage: ["ko"],
    },
    knowsAbout: CORE_SEO_KEYWORDS,
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: t.brand,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/services?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "이 사이트에서는 무엇을 할 수 있나요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "공공 API 데이터를 날짜와 조건 기준으로 조회하고 결과를 표와 엑셀로 확인할 수 있습니다.",
        },
      },
      {
        "@type": "Question",
        name: "데이터를 사업에 어떻게 활용할 수 있나요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "지역 비교, 시장 조사, 운영 점검, 신규 대상 탐색처럼 빠른 판단이 필요한 업무에 바로 활용할 수 있습니다.",
        },
      },
      {
        "@type": "Question",
        name: "공공데이터 API 문서도 함께 확인할 수 있나요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "각 데이터 상세 페이지에서 data.go.kr 문서와 계정 신청 링크를 함께 제공합니다.",
        },
      },
    ],
  };

  if (page === "home") {
    return [pageSchema, organizationSchema, websiteSchema, faqSchema, buildProductCatalog()];
  }

  if (page === "about") {
    return [
      pageSchema,
      organizationSchema,
      {
        "@context": "https://schema.org",
        "@type": "Person",
        name: "GORHROD",
        jobTitle: "Public API Data Workflow Developer",
        knowsAbout: ["Public API", "Data Exploration", "Next.js", "Data Pipeline"],
        url: `${SITE_URL}/about`,
      },
    ];
  }

  if (page === "contact") {
    return [pageSchema, organizationSchema];
  }

  if (page === "services") {
    return [pageSchema, organizationSchema, buildProductCatalog()];
  }

  return [pageSchema, organizationSchema];
}

export function buildProductJsonLd(locale: Locale, product: ProductItem) {
  void locale;
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: product.title,
    description: product.description,
    identifier: product.portalDataId,
    url: `${SITE_URL}/services/${product.slug}`,
    creator: {
      "@type": "Organization",
      name: "GORHROD LAB",
    },
    includedInDataCatalog: {
      "@type": "DataCatalog",
      name: "WORKVISA DATA LAB",
      url: `${SITE_URL}/services`,
    },
    keywords: buildProductKeywords(product),
    variableMeasured: [product.collectFocus, product.portalDataId],
    additionalProperty: [
      { "@type": "PropertyValue", name: "Portal Data ID", value: product.portalDataId },
      { "@type": "PropertyValue", name: "Collect Focus", value: product.collectFocus },
      { "@type": "PropertyValue", name: "Query Mode", value: product.delivery },
      { "@type": "PropertyValue", name: "Use Case", value: product.audience },
    ],
  };
}
