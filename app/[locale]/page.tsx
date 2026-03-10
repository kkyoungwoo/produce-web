import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";
import { content } from "@/lib/i18n/translations";

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

  const t = content[locale];

  return (
    <>
      <section className="hero container">
        <p className="eyebrow">{t.hero.eyebrow}</p>
        <h1>{t.hero.title}</h1>
        <p className="lead">{t.hero.description}</p>
        <div className="hero-actions">
          <Link className="btn primary" href={`/${locale}/services`}>
            {t.hero.ctaPrimary}
          </Link>
          <Link className="btn ghost" href={`/${locale}/contact`}>
            {t.hero.ctaSecondary}
          </Link>
        </div>
      </section>

      <section className="container split-grid">
        <article className="card">
          <h2>{t.sections.strengthsTitle}</h2>
          <ul>
            {t.sections.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>{t.sections.processTitle}</h2>
          <ol>
            {t.sections.process.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>
      </section>
    </>
  );
}