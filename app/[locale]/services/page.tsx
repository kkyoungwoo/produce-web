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
  return createPageMetadata(locale, "services");
}

export default async function ServicesPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getLocaleContent(locale as Locale);

  return (
    <section className="container page-section">
      <JsonLd data={buildJsonLd(locale as Locale, "services")} />
      <h1>{t.services.title}</h1>
      <p className="lead">{t.services.description}</p>

      <div className="portfolio-grid">
        {t.services.items.map((item) => (
          <article key={item.title} className="card portfolio-card">
            <p className="status-pill">{item.status}</p>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <div className="chip-row">
              {item.stack.map((tech) => (
                <span key={tech} className="chip">
                  {tech}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
