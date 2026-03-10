import Link from "next/link";
import { notFound } from "next/navigation";

import JsonLd from "@/components/json-ld";
import { isLocale } from "@/lib/i18n/config";
import { buildJsonLd } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";

type Params = { locale: string };

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const t = getLocaleContent(locale);

  return (
    <>
      <JsonLd data={buildJsonLd(locale, "home")} />

      <section className="hero container">
        <p className="eyebrow">{t.hero.badge}</p>
        <h1>{t.hero.title}</h1>
        <p className="lead">{t.hero.description}</p>
        <div className="hero-actions">
          <Link className="btn primary" href={`/${locale}/services`}>
            {t.hero.primaryCta}
          </Link>
          <Link className="btn ghost" href={`/${locale}/contact`}>
            {t.hero.secondaryCta}
          </Link>
        </div>
      </section>

      <section className="container">
        <h2 className="section-title">{t.home.focusTitle}</h2>
        <div className="focus-grid">
          {t.home.focusCards.map((item) => (
            <article key={item.title} className="card focus-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container page-block">
        <h2 className="section-title">{t.home.featuredTitle}</h2>
        <div className="portfolio-grid">
          {t.home.featuredProjects.map((project) => (
            <article key={project.title} className="card portfolio-card">
              <p className="status-pill">{project.status}</p>
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <div className="chip-row">
                {project.stack.map((tech) => (
                  <span key={tech} className="chip">
                    {tech}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container page-block workflow">
        <h2 className="section-title">{t.home.workflowTitle}</h2>
        <ol>
          {t.home.workflow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </>
  );
}
