import type { Metadata } from "next";
import Link from "next/link";

import SiteFrame from "@/components/site-frame";
import JsonLd from "@/components/json-ld";
import { buildJsonLd, createPageMetadata } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";
import { getPublicApiProducts } from "@/lib/products/public-api-products";

export function generateMetadata(): Metadata {
  return createPageMetadata("ko", "services");
}

export default function ServicesPage() {
  const t = getLocaleContent("ko");
  const products = getPublicApiProducts("ko");

  return (
    <SiteFrame>
      <section className="relative flex min-h-[calc(100vh-160px)] w-full pt-5">
        <JsonLd data={buildJsonLd("ko", "services")} />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_2%,rgba(94,154,255,0.2),transparent_24%),radial-gradient(circle_at_92%_8%,rgba(54,210,184,0.15),transparent_24%),linear-gradient(180deg,#f7faff_0%,#ecf4ff_100%)]" />

        <div className="mx-auto my-auto w-full max-w-6xl px-4 sm:px-6">
          <header
            className="grid cursor-pointer gap-4 rounded-2xl p-5 transition active:scale-[0.99] md:grid-cols-[1.25fr_0.75fr]"
            data-reveal="up"
            data-clickable="true"
          >
            <div>
              <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{t.services.badge}</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{t.services.title}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">{t.services.lead}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 max-[520px]:grid-cols-1">
              <div className="cursor-pointer rounded-xl border border-blue-200 bg-gradient-to-b from-white to-blue-50 p-3 transition active:scale-[0.99]" data-clickable="true">
                <strong className="block text-2xl font-black text-slate-800">{products.length}</strong>
                <span className="text-sm text-slate-600">{t.services.registeredLabel}</span>
              </div>
              <div className="cursor-pointer rounded-xl border border-blue-200 bg-gradient-to-b from-white to-blue-50 p-3 transition active:scale-[0.99]" data-clickable="true">
                <strong className="block text-2xl font-black text-slate-800">{t.services.realtimeValue}</strong>
                <span className="text-sm text-slate-600">{t.services.realtimeLabel}</span>
              </div>
            </div>
          </header>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((item, index) => (
              <Link
                key={item.slug}
                href={`/services/${item.slug}`}
                className="group grid cursor-pointer gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)] transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_20px_40px_rgba(42,84,146,0.16)] active:scale-[0.99]"
                data-clickable="true"
                data-reveal="up"
                data-delay="1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">{t.services.listStatusLabel}</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Data ID {item.portalDataId}</span>
                </div>

                <h2 className="text-lg font-bold leading-snug text-slate-900">{item.title}</h2>
                <p className="text-sm leading-7 text-slate-600">{item.summary}</p>
                <p className="text-xs text-slate-500">#{String(index + 1).padStart(2, "0")} · API Data Page</p>

                <div className="grid gap-1 text-xs text-slate-600">
                  <span>{t.store.deliveryLabel}: {item.delivery}</span>
                  <span>{t.store.audienceLabel}: {item.audience}</span>
                </div>

                <div className="inline-flex min-h-9 w-fit items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                  {t.services.listDetailCta}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
