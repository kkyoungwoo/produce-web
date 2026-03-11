import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import JsonLd from "@/components/json-ld";
import ProductSalesCard from "@/components/product-sales-card";
import { isLocale, locales } from "@/lib/i18n/config";
import { buildProductJsonLd, createProductMetadata } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";
import { getPublicApiProductBySlug, getPublicApiProducts, getPublicApiProductSlugs } from "@/lib/products/public-api-products";

type Params = { locale: string; slug: string };

function pickRandomProducts<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    getPublicApiProductSlugs(locale).map((slug) => ({ locale, slug })),
  );
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
  const product = getPublicApiProductBySlug(locale, slug);
  if (!product) notFound();

  const allProducts = getPublicApiProducts(locale);
  const excludedCurrent = allProducts.filter((item) => item.slug !== product.slug);
  const pool = excludedCurrent.length > 0 ? excludedCurrent : allProducts;
  const otherProducts = pickRandomProducts(pool, 3);

  return (
    <section className="relative min-h-[calc(100vh-160px)] w-full pt-5">
      <JsonLd data={buildProductJsonLd(locale, product)} />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_0%,rgba(64,140,250,0.15),transparent_26%),radial-gradient(circle_at_92%_10%,rgba(47,208,167,0.13),transparent_24%),linear-gradient(180deg,#f7faff_0%,#eef5ff_100%)]" />

      <div className="mx-auto my-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_16px_36px_rgba(44,86,150,0.12)] lg:grid-cols-[1.2fr_0.8fr]" data-reveal="up">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.serviceDetail.badge}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{product.title}</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">{product.summary}</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">{product.description}</p>

            <div className="mt-3 grid gap-1 text-sm text-slate-600">
              <span>{t.store.priceLabel}: {product.priceLabel}</span>
              <span>{t.store.deliveryLabel}: {product.delivery}</span>
              <span>{t.store.audienceLabel}: {product.audience}</span>
              <span>Data ID: {product.portalDataId}</span>
            </div>

            <div className="mt-5 grid gap-2">
              <Link
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-base font-extrabold !text-white shadow-[0_12px_28px_rgba(37,99,235,0.28)] transition hover:bg-blue-700"
                href={`/${locale}/services/${product.slug}/workbench`}
              >
                {t.store.useLabel}
              </Link>
            </div>
          </div>

          <aside className="rounded-xl border border-blue-200 bg-gradient-to-b from-white to-blue-50 p-4" data-reveal="up" data-delay="1">
            <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.serviceDetail.apiSourcesTitle}</p>
            <ul className="mt-3 grid gap-2">
              <li>
                <a
                  href={product.apiDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[42px] w-full items-center justify-between rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <span>{t.serviceDetail.apiDocLabel}</span>
                  <span>{t.serviceDetail.openLabel}</span>
                </a>
              </li>
              {product.apiGuideUrl ? (
                <li>
                  <a
                    href={product.apiGuideUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[42px] w-full items-center justify-between rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span>{t.serviceDetail.apiGuideLabel}</span>
                    <span>{t.serviceDetail.openLabel}</span>
                  </a>
                </li>
              ) : null}
              <li>
                <a
                  href={product.accountGuideUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[42px] w-full items-center justify-between rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <span>{t.serviceDetail.apiAccountLabel}</span>
                  <span>{t.serviceDetail.openLabel}</span>
                </a>
              </li>
              <li>
                <a
                  href={t.contact.kakaoValue}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[42px] w-full items-center justify-between rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <span>{t.serviceDetail.apiChatLabel}</span>
                  <span>{t.serviceDetail.openLabel}</span>
                </a>
              </li>
            </ul>
          </aside>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-[0_14px_28px_rgba(99,102,241,0.08)]" data-reveal="up" data-delay="1">
            <p className="text-xs font-extrabold tracking-[0.14em] text-indigo-700">{t.serviceDetail.inputGuideBadge}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-800">INPUT SCHEMA</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {product.inputFields.map((field) => (
                <div key={field.key} className="grid gap-1 rounded-xl border border-indigo-200 bg-white p-3 text-xs text-slate-600">
                  <strong className="text-sm text-slate-800">{field.label}</strong>
                  <span>{field.key}</span>
                  <span>예시: {field.example}</span>
                  <span>{field.required ? "필수" : "선택"}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 shadow-[0_14px_28px_rgba(20,184,166,0.08)]" data-reveal="up" data-delay="2">
            <p className="text-xs font-extrabold tracking-[0.14em] text-teal-700">{t.serviceDetail.sampleRequestBadge}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-800">SAMPLE REQUEST</h2>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white p-3 text-xs text-slate-700">{product.sampleRequest}</pre>
            <p className="mt-3 text-xs text-slate-500">
              {t.serviceDetail.sampleCodeLabel}: <code>lib/collectors/public-api-collector-sample.ts</code>
            </p>
          </article>
        </div>

        <article className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-[0_14px_28px_rgba(245,158,11,0.08)]" data-reveal="up" data-delay="2">
          <p className="text-xs font-extrabold tracking-[0.14em] text-amber-700">{t.serviceDetail.includesBadge}</p>
          <h2 className="mt-1 text-xl font-bold text-slate-800">{t.store.includedLabel}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700">
            {product.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </article>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_12px_28px_rgba(30,41,59,0.08)]" data-reveal="up" data-delay="2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{t.serviceDetail.otherProductsTitle}</h2>
            <Link
              className="inline-flex min-h-[42px] w-full items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100 sm:w-auto"
              href={`/${locale}/services`}
            >
              {t.serviceDetail.allProductsLabel}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {otherProducts.map((item, index) => (
              <div
                key={item.slug}
                className={[
                  index === 0 ? "block" : "",
                  index === 1 ? "hidden md:block" : "",
                  index === 2 ? "hidden lg:block" : "",
                ].join(" ")}
              >
                <ProductSalesCard
                  locale={locale}
                  item={item}
                  detailLabel={t.store.detailLabel}
                  mode="compact"
                  labels={{
                    collect: t.serviceDetail.cardCollectLabel,
                    input: t.serviceDetail.cardInputLabel,
                    doc: t.serviceDetail.cardDocLabel,
                    guide: t.serviceDetail.cardGuideLabel,
                    account: t.serviceDetail.cardAccountLabel,
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}