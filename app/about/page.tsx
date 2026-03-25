import type { Metadata } from "next";

import SiteFrame from "@/components/site-frame";
import JsonLd from "@/components/json-ld";
import { buildJsonLd, createPageMetadata } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";

export function generateMetadata(): Metadata {
  return createPageMetadata("ko", "about");
}

export default function AboutPage() {
  const t = getLocaleContent("ko");

  return (
    <SiteFrame>
      <section className="relative min-h-[calc(100vh-160px)] w-full pt-5">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_2%,rgba(94,154,255,0.16),transparent_26%),radial-gradient(circle_at_92%_8%,rgba(54,210,184,0.14),transparent_24%),linear-gradient(180deg,#f7faff_0%,#edf4ff_100%)]" />
        <div className="mx-auto my-auto w-full max-w-6xl px-4 sm:px-6" data-reveal="up">
          <JsonLd data={buildJsonLd("ko", "about")} />
          <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_16px_36px_rgba(44,86,150,0.12)] sm:p-6" data-clickable="true">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{t.about.title}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">{t.about.summary}</p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <article className="rounded-xl border border-blue-200 bg-slate-50/70 p-4" data-clickable="true">
                <h2 className="text-lg font-bold text-slate-800">{t.about.strengthsTitle}</h2>
                <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 text-slate-600">
                  {t.about.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="rounded-xl border border-blue-200 bg-slate-50/70 p-4" data-clickable="true">
                <h2 className="text-lg font-bold text-slate-800">{t.about.timelineTitle}</h2>
                <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 text-slate-600">
                  {t.about.timeline.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
