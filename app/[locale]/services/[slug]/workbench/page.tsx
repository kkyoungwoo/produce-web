import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCollectorProfile } from "@/lib/collectors/collector-profiles";
import { isLocale, locales } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";
import { getPublicApiProductBySlug, getPublicApiProductSlugs } from "@/lib/products/public-api-products";
import { getApiKeyInputGuide, getWorkbenchBaseDate, getWorkbenchColumns, getWorkbenchRows } from "@/lib/products/workbench-config";

type Params = { locale: string; slug: string };

export function generateStaticParams() {
  return locales.flatMap((locale) => getPublicApiProductSlugs(locale).map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const product = getPublicApiProductBySlug(locale, slug);
  if (!product) return {};

  const t = getLocaleContent(locale);
  const canonical = `${SITE_URL}/${locale}/services/${product.slug}/workbench`;

  return {
    title: `${product.title} ${t.workbench.metaTitleSuffix} | GORHROD LAB`,
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
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const t = getLocaleContent(locale);
  const product = getPublicApiProductBySlug(locale, slug);
  if (!product) notFound();

  const collectorProfile = getCollectorProfile(product.collectorKey);
  const apiGuide = getApiKeyInputGuide(product);

  const defaultMap = Object.fromEntries(product.inputFields.map((field) => [field.key, field.example]));
  const previewBaseDate = getWorkbenchBaseDate(product);
  const previewColumns = getWorkbenchColumns(product);
  const previewRows = getWorkbenchRows(product, previewBaseDate);

  return (
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
                href={`/${locale}/services/${product.slug}`}
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

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)]" data-reveal="up" data-delay="1">
            <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.workbench.inputConfigBadge}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-800">{t.workbench.inputParamsTitle}</h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">{t.workbench.inputConfigHint}</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {product.inputFields.map((field) => (
                <label key={field.key} className="grid gap-1 rounded-xl border border-blue-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <strong className="text-sm text-slate-800">{field.label}</strong>
                  <span>{field.key}</span>
                  <input
                    className="mt-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-slate-700"
                    name={field.key}
                    placeholder={field.example}
                    aria-label={field.label}
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold !text-white transition hover:bg-blue-700">
                {t.workbench.previewRunLabel}
              </button>
              <button type="button" className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100">
                {t.workbench.resetInputsLabel}
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)]" data-reveal="up" data-delay="2">
            <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.workbench.autoFillPreviewBadge}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-800">{t.workbench.autoFillReadyTitle}</h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">{t.workbench.autoFillDescription}</p>

            <div className="mt-3 grid gap-2">
              {product.inputFields.map((field) => (
                <div key={field.key} className="flex items-center justify-between rounded-xl border border-blue-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-700">{field.label}</span>
                  <span className="rounded-md bg-white px-2 py-1 text-xs text-slate-600">{String(defaultMap[field.key] ?? field.example)}</span>
                </div>
              ))}
            </div>

            <ul className="mt-4 grid gap-2">
              {collectorProfile.runtimeHints.map((hint) => (
                <li key={hint.key} className="grid gap-1 rounded-xl border border-blue-200 bg-slate-50 p-3 text-sm text-slate-600">
                  <strong className="text-slate-800">{hint.label}</strong>
                  <span>{hint.description}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <article className="mt-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)]" data-reveal="up" data-delay="2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.workbench.pcPreviewBadge}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-800">{t.workbench.resultTableTitle}</h2>
            </div>
            <button
              type="button"
              className="inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold !text-white transition hover:bg-emerald-600"
            >
              {t.workbench.excelDownloadLabel}
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">
              <p className="text-xs text-slate-500">{t.workbench.baseDateLabel}</p>
              <strong>{previewBaseDate}</strong>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">
              <p className="text-xs text-slate-500">{t.workbench.expectedRowsLabel}</p>
              <strong>{previewRows.length}건</strong>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">
              <p className="text-xs text-slate-500">{t.workbench.statusLabel}</p>
              <strong>{t.workbench.statusReadyValue}</strong>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-blue-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-blue-50 text-slate-700">
                <tr>
                  {previewColumns.map((column) => (
                    <th key={column.key} className="px-3 py-2 font-bold">{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className="border-t border-blue-100 text-slate-600">
                    {previewColumns.map((column) => (
                      <td key={`${rowIndex}-${column.key}`} className="px-3 py-2">
                        {String(row[column.key] ?? "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}