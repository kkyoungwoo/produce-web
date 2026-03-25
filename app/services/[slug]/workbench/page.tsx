import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import SiteFrame from "@/components/site-frame";
import WorkbenchCollectorClient from "@/components/workbench-collector-client";
import { getCollectorProfile } from "@/lib/collectors/collector-profiles";
import { SITE_URL } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";
import { getPublicApiProductBySlug, getPublicApiProductSlugs } from "@/lib/products/public-api-products";
import { getApiKeyInputGuide } from "@/lib/products/workbench-config";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublicApiProductSlugs("ko").map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getPublicApiProductBySlug("ko", slug);
  if (!product) return {};

  const t = getLocaleContent("ko");
  const canonical = `${SITE_URL}/services/${product.slug}/workbench`;

  return {
    title: `${product.title} ${t.workbench.metaTitleSuffix} | ${t.brand}`,
    description: `${product.title} ${t.workbench.metaDescriptionSuffix}`,
    alternates: { canonical },
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
  };
}

export default async function WorkbenchPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const t = getLocaleContent("ko");
  const product = getPublicApiProductBySlug("ko", slug);
  if (!product) notFound();

  const collectorProfile = getCollectorProfile(product.collectorKey);
  const apiGuide = getApiKeyInputGuide(product);

  return (
    <SiteFrame>
      <section className="relative flex min-h-[calc(100vh-160px)] w-full pt-5">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_2%,rgba(83,150,247,0.2),transparent_24%),radial-gradient(circle_at_92%_8%,rgba(53,199,173,0.14),transparent_24%),linear-gradient(180deg,#f7faff_0%,#edf4ff_100%)]" />

        <div className="mx-auto my-auto w-full max-w-6xl px-4 sm:px-6">
          <header className="grid gap-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_16px_36px_rgba(44,86,150,0.12)] md:grid-cols-[1.3fr_0.7fr]" data-reveal="up">
            <div>
              <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.workbench.badge}</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{product.title} {t.workbench.titleSuffix}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">{t.workbench.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                  href={`/services/${product.slug}`}
                >
                  {t.workbench.backToDetailLabel}
                </Link>
                <a
                  className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold !text-white transition hover:bg-emerald-600"
                  href={t.contact.kakaoValue}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.workbench.consultLabel}
                </a>
              </div>
            </div>

            <aside className="rounded-xl border border-blue-200 bg-gradient-to-b from-white to-blue-50 p-4">
              <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.workbench.collectorModeLabel}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-800">{collectorProfile.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{collectorProfile.shortDescription}</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">{collectorProfile.runStrategy}</p>
              <div className="mt-3 rounded-xl border border-blue-200 bg-white p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">{t.workbench.apiKeyConfigLabel}</p>
                <p className="mt-1">{t.workbench.envVarLabel}: <code>{apiGuide.envVarName}</code></p>
                <p className="mt-1">{t.workbench.queryKeyLabel}: <code>{apiGuide.queryKey}</code></p>
              </div>
            </aside>
          </header>

          <WorkbenchCollectorClient
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
        </div>
      </section>
    </SiteFrame>
  );
}
