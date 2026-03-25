"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import WorkbenchCollectorClient from "@/components/workbench-collector-client";
import type { LocaleContent, ProductItem } from "@/lib/i18n/types";

type Props = {
  locale?: string;
  products: ProductItem[];
  initialSlug: string;
  t: LocaleContent;
  kakaoChatUrl: string;
};

const UI_TEXT = {
  summaryArrow: "v",
  prevIcon: "<",
  nextIcon: ">",
} as const;

function getVisibleCount(width: number) {
  if (width < 768) return 1;
  if (width < 1280) return 2;
  return 3;
}

export default function ServiceDetailInteractive({ locale, products, initialSlug, t, kakaoChatUrl }: Props) {
  void locale;
  const product = useMemo(() => products.find((item) => item.slug === initialSlug) ?? products[0], [products, initialSlug]);

  const otherProducts = useMemo(
    () => products.filter((item) => item.slug !== product?.slug),
    [products, product?.slug],
  );

  const [visibleCount, setVisibleCount] = useState(3);
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return;
      setVisibleCount(getVisibleCount(window.innerWidth));
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    setStartIndex(0);
  }, [product?.slug, visibleCount]);

  if (!product) return null;

  const maxStart = Math.max(0, otherProducts.length - visibleCount);
  const canPrev = startIndex > 0;
  const canNext = startIndex < maxStart;

  const cardWidthPercent = Number((100 / Math.max(1, visibleCount)).toFixed(4));
  const trackTranslatePercent = Number((startIndex * cardWidthPercent).toFixed(4));
  const translateValue = trackTranslatePercent === 0 ? "0" : String(trackTranslatePercent);
  const cardBasisValue = `${cardWidthPercent.toFixed(4)}%`;
  const trackTransform = trackTranslatePercent === 0 ? "translateX(0%)" : `translateX(-${translateValue}%)`;

  return (
    <>
      <div
        className="grid gap-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_16px_36px_rgba(44,86,150,0.12)] lg:grid-cols-[1.2fr_0.8fr]"
        data-reveal="up"
      >
        <div>
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.serviceDetail.badge}</p>
          <h1 className="mt-1 break-words text-3xl font-extrabold tracking-tight text-slate-900">{product.title}</h1>
          <p className="mt-2 break-words text-sm leading-7 text-slate-600">{product.summary}</p>
          <p className="mt-2 break-words text-sm leading-7 text-slate-600">{product.description}</p>

          <div className="mt-3 grid gap-1 text-sm text-slate-600 [overflow-wrap:anywhere]">
            <span>Data ID: {product.portalDataId}</span>
            <span>{t.store.deliveryLabel}: {product.delivery}</span>
            <span>{t.store.audienceLabel}: {product.audience}</span>
            <span>{t.serviceDetail.cardCollectLabel}: {product.delivery}</span>
          </div>
        </div>

        <aside
          className="rounded-xl border border-blue-200 bg-gradient-to-b from-white to-blue-50 p-4"
          data-reveal="up"
          data-delay="1"
        >
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.serviceDetail.apiSourcesTitle}</p>
          <ul className="mt-3 grid gap-2">
            <li>
              <a
                href={product.apiDocUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[42px] w-full items-center justify-between rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="truncate">{t.serviceDetail.apiDocLabel}</span>
                <span>{t.serviceDetail.openLabel}</span>
              </a>
            </li>
            <li>
              <a
                href={product.accountGuideUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[42px] w-full items-center justify-between rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="truncate">{t.serviceDetail.apiAccountLabel}</span>
                <span>{t.serviceDetail.openLabel}</span>
              </a>
            </li>
            <li>
              <a
                href={kakaoChatUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[42px] w-full items-center justify-between rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="truncate">{t.serviceDetail.apiChatLabel}</span>
                <span>{t.serviceDetail.openLabel}</span>
              </a>
            </li>
          </ul>
        </aside>
      </div>

      <article
        id="workbench"
        className="mt-6 rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)]"
        data-reveal="up"
        data-delay="3"
      >
        <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.workbench.badge}</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          {product.title} {t.workbench.titleSuffix}
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">{t.workbench.description}</p>

        <WorkbenchCollectorClient
          key={product.slug}
          product={product}
          labels={{
            runLabel: t.workbench.previewRunLabel,
            resetLabel: t.workbench.resetInputsLabel,
            resultBadge: t.workbench.pcPreviewBadge,
            resultTitle: t.workbench.resultTableTitle,
            excelLabel: t.workbench.excelDownloadLabel,
            successLabel: t.workbench.queryResultLabel,
            errorLabel: t.workbench.queryErrorLabel,
            noDataLabel: t.workbench.noDataLabel,
            sourceUrlLabel: t.workbench.sourceUrlLabel,
          }}
        />
      </article>

      <details className="group mt-5" data-reveal="up" data-delay="2">
        <summary className="flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-white/90 px-4 py-2 text-sm font-extrabold text-amber-700 [&::-webkit-details-marker]:hidden">
          <span>{t.serviceDetail.allProductsLabel}</span>
          <span className="inline-flex items-center gap-2">
            <span className="hidden items-center gap-2 group-open:inline-flex">
              <button
                type="button"
                aria-label={t.serviceDetail.prevLabel}
                disabled={!canPrev}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setStartIndex((prev) => Math.max(0, prev - 1));
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {UI_TEXT.prevIcon}
              </button>
              <button
                type="button"
                aria-label={t.serviceDetail.nextLabel}
                disabled={!canNext}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setStartIndex((prev) => Math.min(maxStart, prev + 1));
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {UI_TEXT.nextIcon}
              </button>
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-base leading-none transition-transform duration-300 group-open:rotate-180">{UI_TEXT.summaryArrow}</span>
          </span>
        </summary>

        {otherProducts.length === 0 ? (
          <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]">{t.serviceDetail.noOtherProducts}</p>
        ) : (
          <div className="mt-3">
            <div className="overflow-hidden">
              <div
                className="flex items-stretch transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: trackTransform }}
              >
                {otherProducts.map((item) => (
                  <div key={item.slug} className="flex-none px-1.5" style={{ flexBasis: cardBasisValue }}>
                    <Link
                      href={`/services/${item.slug}`}
                      className="group flex h-full flex-col rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35)] transition hover:bg-amber-50 hover:shadow-[inset_0_0_0_1px_rgba(245,158,11,0.6)] active:scale-[0.99]"
                    >
                      <p className="line-clamp-1 text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 line-clamp-2 flex-1 text-xs leading-6 text-slate-600">{item.summary}</p>
                      <p className="mt-2 text-xs font-semibold text-amber-700">{t.serviceDetail.relatedStatusLabel} · Data ID {item.portalDataId}</p>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </details>
    </>
  );
}
