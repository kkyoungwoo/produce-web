import type { Metadata } from "next";
import { notFound } from "next/navigation";

import JsonLd from "@/components/json-ld";
import ServiceDetailInteractiveShell from "@/components/service-detail-interactive-shell";
import { isLocale, locales } from "@/lib/i18n/config";
import { buildProductJsonLd, createProductMetadata } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";
import {
  getPublicApiProductBySlug,
  getPublicApiProductSlugs,
  getPublicApiProducts,
} from "@/lib/products/public-api-products";

type Params = { locale: string; slug: string };

export function generateStaticParams() {
  return locales.flatMap((locale) => getPublicApiProductSlugs(locale).map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const product = getPublicApiProductBySlug(locale, slug);
  if (!product) return {};

  return createProductMetadata(locale, product);
}

export default async function ServiceDetailPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const t = getLocaleContent(locale);
  const kakaoChatUrl = "http://pf.kakao.com/_qiXpxj/chat";
  const product = getPublicApiProductBySlug(locale, slug);
  if (!product) notFound();

  const products = getPublicApiProducts(locale);

  return (
    <section className="relative min-h-[calc(100vh-160px)] w-full pt-5">
      <JsonLd data={buildProductJsonLd(locale, product)} />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_0%,rgba(64,140,250,0.15),transparent_26%),radial-gradient(circle_at_92%_10%,rgba(47,208,167,0.13),transparent_24%),linear-gradient(180deg,#f7faff_0%,#eef5ff_100%)]" />

      <div className="mx-auto my-auto w-full max-w-6xl px-4 sm:px-6">
        <ServiceDetailInteractiveShell
          locale={locale}
          products={products}
          initialSlug={product.slug}
          t={t}
          kakaoChatUrl={kakaoChatUrl}
        />
      </div>
    </section>
  );
}
