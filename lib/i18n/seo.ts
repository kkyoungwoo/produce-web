import type { Metadata } from "next";

import { getPublicApiProducts } from "@/lib/products/public-api-products";

import type { Locale } from "./config";
import { locales } from "./config";
import { getLocaleContent } from "./translations";
import type { ProductItem } from "./types";

export const SITE_URL = "https://gorhrod-codex.web.app";

export type PageKey = "home" | "about" | "services" | "contact";

const CORE_SEO_KEYWORDS = [
  "사업자DB",
  "사업자 DB 판매",
  "사업자 주소록",
  "DB 수집 프로그램",
  "DB 제작 솔루션",
  "공공데이터 API",
  "data.go.kr",
  "영업DB",
  "잠재고객 DB",
  "B2B DB",
  "DB 자동수집",
  "DB 맞춤제작",
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
      product.summary,
      product.portalDataId,
      "API 수집기",
      "DB 판매",
      "사업자 DB 솔루션",
      "데이터 수집",
      "ETL",
      "공공 API",
    ],
  );
}

function buildProductCatalog(locale: Locale) {
  const t = getLocaleContent(locale);
  const products = getPublicApiProducts(locale);

  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: `${t.brand} 사업자 DB 수집 상품 카탈로그`,
    url: `${SITE_URL}/${locale}/services`,
    numberOfItems: products.length,
    itemListElement: products.map((item, index) => ({
      "@type": "Offer",
      position: index + 1,
      priceCurrency: "KRW",
      price: item.priceValue,
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/${locale}/services/${item.slug}`,
      itemOffered: {
        "@type": "Product",
        name: item.title,
        description: item.description,
        sku: item.slug,
        category: "사업자 DB 수집 프로그램",
        audience: {
          "@type": "Audience",
          audienceType: item.audience,
        },
      },
    })),
  };
}

export function createPageMetadata(locale: Locale, page: PageKey): Metadata {
  const t = getLocaleContent(locale);
  const pageSeo = t.seo[page];
  const pagePath = getPathByPage(page);
  const canonical = `${SITE_URL}/${locale}${pagePath}`;

  const languageAlternates = Object.fromEntries(locales.map((lang) => [lang, `${SITE_URL}/${lang}${pagePath}`]));

  const keywords = uniqueKeywords(pageSeo.keywords, CORE_SEO_KEYWORDS);

  return {
    title: pageSeo.title,
    description: pageSeo.description,
    keywords,
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

export function createProductMetadata(locale: Locale, product: ProductItem): Metadata {
  const t = getLocaleContent(locale);
  const canonical = `${SITE_URL}/${locale}/services/${product.slug}`;

  return {
    title: `${product.title} | ${t.brand}`,
    description: `${product.summary} | ${product.collectFocus}`,
    keywords: buildProductKeywords(product),
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(locales.map((lang) => [lang, `${SITE_URL}/${lang}/services/${product.slug}`])),
        "x-default": `${SITE_URL}/ko/services/${product.slug}`,
      },
    },
    openGraph: {
      type: "website",
      locale,
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
    classification: "사업자 DB 판매 및 수집 솔루션",
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
  const t = getLocaleContent(locale);
  const pagePath = getPathByPage(page);
  const pageUrl = `${SITE_URL}/${locale}${pagePath}`;

  const pageSchema = {
    "@context": "https://schema.org",
    "@type": page === "contact" ? "ContactPage" : "WebPage",
    name: t.seo[page].title,
    description: t.seo[page].description,
    inLanguage: locale,
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
      contactType: "sales",
      email: t.contact.emailValue,
      availableLanguage: ["ko", "en", "ja", "zh"],
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
      target: `${SITE_URL}/${locale}/services?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "사업자 DB는 어떻게 구매하나요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "서비스 페이지에서 상품을 선택한 뒤 상담을 통해 바로 구매할 수 있습니다.",
        },
      },
      {
        "@type": "Question",
        name: "DB 수집 조건은 커스터마이징 가능한가요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "날짜, 지역, 키워드 등 입력 조건을 상품별로 커스터마이징해 수집할 수 있습니다.",
        },
      },
      {
        "@type": "Question",
        name: "공공데이터 API 기반 수집도 가능한가요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "data.go.kr API를 기반으로 DB 수집/가공/출력까지 연결되는 구조로 제공합니다.",
        },
      },
    ],
  };

  if (page === "home") {
    return [pageSchema, organizationSchema, websiteSchema, faqSchema, buildProductCatalog(locale)];
  }

  if (page === "about") {
    return [
      pageSchema,
      organizationSchema,
      {
        "@context": "https://schema.org",
        "@type": "Person",
        name: "GORHROD",
        jobTitle: "Public API Collection Developer",
        knowsAbout: ["Public API", "Database Automation", "Next.js", "Data Pipeline"],
        url: `${SITE_URL}/ko/about`,
      },
    ];
  }

  if (page === "contact") {
    return [pageSchema, organizationSchema];
  }

  if (page === "services") {
    return [pageSchema, organizationSchema, buildProductCatalog(locale)];
  }

  return [pageSchema, organizationSchema];
}

export function buildProductJsonLd(locale: Locale, product: ProductItem) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    sku: product.slug,
    category: "사업자 DB 수집 프로그램",
    brand: {
      "@type": "Brand",
      name: "GORHROD LAB",
    },
    url: `${SITE_URL}/${locale}/services/${product.slug}`,
    offers: {
      "@type": "Offer",
      priceCurrency: "KRW",
      price: product.priceValue,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "GORHROD LAB",
      },
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "Portal Data ID", value: product.portalDataId },
      { "@type": "PropertyValue", name: "Collect Focus", value: product.collectFocus },
      { "@type": "PropertyValue", name: "Delivery", value: product.delivery },
      { "@type": "PropertyValue", name: "Audience", value: product.audience },
    ],
  };
}
