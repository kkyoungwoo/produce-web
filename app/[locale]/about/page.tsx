import type { Metadata } from "next";
import { notFound } from "next/navigation";

import JsonLd from "@/components/json-ld";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { buildJsonLd, createPageMetadata } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";

type Params = { locale: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return createPageMetadata(locale, "about");
}

export default async function AboutPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getLocaleContent(locale as Locale);

  return (
    <section className="container page-section">
      <JsonLd data={buildJsonLd(locale as Locale, "about")} />
      <h1>{t.about.title}</h1>
      <p className="lead">{t.about.summary}</p>

      <div className="split-grid">
        <article className="card">
          <h2>{t.about.strengthsTitle}</h2>
          <ul>
            {t.about.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>{t.about.timelineTitle}</h2>
          <ul>
            {t.about.timeline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
