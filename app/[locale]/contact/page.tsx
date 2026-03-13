import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import JsonLd from "@/components/json-ld";
import { isLocale } from "@/lib/i18n/config";
import { buildJsonLd, createPageMetadata } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";

type Params = { locale: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return createPageMetadata(locale, "contact");
}

export default async function ContactPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getLocaleContent(locale);

  return (
    <section className="relative min-h-[calc(100vh-160px)] w-full pt-5">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_2%,rgba(94,154,255,0.16),transparent_26%),radial-gradient(circle_at_92%_8%,rgba(54,210,184,0.14),transparent_24%),linear-gradient(180deg,#f7faff_0%,#edf4ff_100%)]" />
      <div className="mx-auto my-auto w-full max-w-6xl px-4 sm:px-6" data-reveal="up">
        <JsonLd data={buildJsonLd(locale, "contact")} />
        <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_16px_36px_rgba(44,86,150,0.12)] sm:p-6" data-clickable="true">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">DATA COLLABORATION</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{t.contact.title}</h1>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-600">{t.contact.description}</p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-blue-200 bg-slate-50/70 p-4" data-clickable="true">
              <h2 className="text-lg font-bold text-slate-800">{t.contact.purchaseTitle}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{t.contact.purchaseDescription}</p>
              <a className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600" href={t.contact.kakaoValue} target="_blank" rel="noreferrer">
                {t.store.buyLabel}
              </a>
            </article>

            <article className="rounded-xl border border-blue-200 bg-slate-50/70 p-4 text-sm leading-7 text-slate-600">
              <p>
                <strong>{t.contact.kakaoLabel}:</strong>{" "}
                <a href={t.contact.kakaoValue} target="_blank" rel="noreferrer" className="text-blue-600 underline underline-offset-2">
                  {t.contact.kakaoValue}
                </a>
              </p>
              <p>
                <strong>{t.contact.emailLabel}:</strong>{" "}
                <a href={`mailto:${t.contact.emailValue}`} className="text-blue-600 underline underline-offset-2">{t.contact.emailValue}</a>
              </p>
              <p>
                <strong>{t.contact.githubLabel}:</strong>{" "}
                <Link href={t.contact.githubValue} target="_blank" rel="noreferrer" className="text-blue-600 underline underline-offset-2">
                  {t.contact.githubValue}
                </Link>
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
