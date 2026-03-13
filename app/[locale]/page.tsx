import type { Metadata } from "next";
import { notFound } from "next/navigation";

import JsonLd from "@/components/json-ld";
import { isLocale } from "@/lib/i18n/config";
import { buildJsonLd, createPageMetadata } from "@/lib/i18n/seo";
import { getLocaleContent } from "@/lib/i18n/translations";

type Params = { locale: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return createPageMetadata(locale, "home");
}

export default async function LocaleHomePage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const t = getLocaleContent(locale);
  const copy = t.landing;

  return (
    <>
      <JsonLd data={buildJsonLd(locale, "home")} />

      <main className="landing-page">
        <section className="hero-section">
          <div className="hero-bg-overlay" />

          <div className="container hero-inner">
            <div className="hero-copy">
              <div className="hero-badge-wrap">
                <div className="hero-points">
                  {copy.points.map((point) => (
                    <span key={point}>{point}</span>
                  ))}
                </div>
              </div>

              <h1 className="hero-title">
                {copy.title}
                <br />
                <span>{copy.titleAccent}</span>
              </h1>

              <p className="hero-desc">{copy.description}</p>
            </div>

            <div className="hero-side">
              <article className="hero-panel">
                <div className="panel-top">
                  <span className="status-dot" />
                  <span className="status-text">{copy.status}</span>
                </div>

                <h2>{copy.panelTitle}</h2>
                <p className="panel-desc">{copy.panelDescription}</p>
                  <div className="hero-actions">
                <a className="btn-primary" href={`/${locale}/services`}>
                  {copy.primaryCta}
                </a>
                <a className="btn-secondary" href={t.contact.kakaoValue} target="_blank" rel="noreferrer">
                  {copy.secondaryCta}
                </a>
              </div>
              </article>

            </div>
          </div>
        </section>

        <section className="trust-strip">
          <div className="container trust-grid">
            {copy.trustItems.map((item) => (
              <div key={item.kicker} className="trust-item click-interactive">
                <span className="trust-kicker">{item.kicker}</span>
                <strong>{item.label}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="section-wrap dark-flow">
          <div className="container">
            <div className="section-head left">
              <span className="section-tag">{copy.whyTag}</span>
              <h2>{copy.whyTitle}</h2>
              <p>{copy.whyDescription}</p>
            </div>

            <div className="process-grid">
              {copy.processCards.map((card) => (
                <article key={card.step} className="process-card click-interactive">
                  <span className="process-step">{card.step}</span>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-wrap section-business">
          <div className="container">
            <div className="section-head">
              <span className="section-tag">{copy.businessTag}</span>
              <h2>{copy.businessTitle}</h2>
              <p>{copy.businessDescription}</p>
            </div>

            <article className="final-message-card click-interactive">
              <p className="final-kicker">{copy.promiseKicker}</p>
              <h3>{copy.promiseTitle}</h3>
              <p className="final-desc">{copy.promiseDescription}</p>
              <div className="final-actions">
                <a className="btn-primary" href={`/${locale}/services`}>
                  {copy.promisePrimary}
                </a>
                <a className="btn-secondary dark" href={t.contact.kakaoValue} target="_blank" rel="noreferrer">
                  {copy.promiseSecondary}
                </a>
              </div>
            </article>
          </div>
        </section>
      </main>

      <style>{`
        .landing-page {
          background: #f8fafc;
          color: #0f172a;
        }

        .container {
          width: min(1200px, calc(100% - 32px));
          margin: 0 auto;
        }

        .hero-section {
          position: relative;
          overflow: hidden;
          padding: 96px 0 84px;
          background: linear-gradient(180deg, #ecf8ff 0%, #f7fbff 48%, #ffffff 100%);
          color: #0f172a;
        }

        .hero-bg-overlay {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 18% 18%, rgba(14, 165, 233, 0.16), transparent 26%),
            radial-gradient(circle at 82% 22%, rgba(16, 185, 129, 0.1), transparent 24%);
          pointer-events: none;
        }

        .hero-inner {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          gap: 36px;
          align-items: center;
        }

        .hero-copy {
          max-width: 700px;
        }

        .hero-badge-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 22px;
        }

        .hero-title {
          margin: 0;
          font-size: clamp(2.5rem, 5vw, 4.8rem);
          line-height: 1.08;
          letter-spacing: -0.045em;
          font-weight: 900;
          color: #0f172a;
          word-break: keep-all;
        }

        .hero-title span {
          color: #0284c7;
        }

        .hero-desc {
          max-width: 640px;
          margin: 24px 0 0;
          font-size: 1.08rem;
          line-height: 1.9;
          color: #334155;
          word-break: keep-all;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 32px;
        }

        .hero-points {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .hero-points span {
          display: inline-flex;
          align-items: center;
          min-height: 38px;
          padding: 0 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(148, 163, 184, 0.18);
          font-size: 0.92rem;
          font-weight: 700;
          color: #0f172a;
        }

        .btn-primary,
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 56px;
          padding: 0 24px;
          border-radius: 16px;
          font-weight: 800;
          text-decoration: none;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
        }

        .btn-primary {
          color: #ffffff;
          background: linear-gradient(180deg, #38bdf8, #0ea5e9);
          box-shadow: 0 16px 36px rgba(14, 165, 233, 0.2);
        }

        .btn-secondary {
          color: #0f172a;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .btn-secondary.dark {
          color: #0f172a;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.08);
        }

        .btn-primary:hover,
        .btn-secondary:hover {
          transform: translateY(-2px);
        }

        .hero-side {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .hero-panel {
          position: relative;
          padding: 30px;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.1);
        }

        .panel-top {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #61ffa8;
          box-shadow: 0 0 0 6px rgba(97, 255, 168, 0.14);
        }

        .status-text {
          font-size: 0.92rem;
          color: #047857;
          font-weight: 800;
        }

        .hero-panel h2 {
          margin: 0;
          font-size: 1.82rem;
          line-height: 1.25;
          color: #0f172a;
          word-break: keep-all;
        }

        .panel-desc {
          margin: 14px 0 0;
          color: #334155;
          line-height: 1.8;
          font-size: 1rem;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 24px;
        }

        .metric-card {
          padding: 17px 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.16);
        }

        .metric-card strong {
          display: block;
          font-size: 1.2rem;
          color: #0284c7;
        }

        .metric-card span {
          display: block;
          margin-top: 6px;
          color: #0f172a;
          font-size: 0.96rem;
          font-weight: 700;
        }

        .trust-strip {
          margin-top: -24px;
          padding-bottom: 30px;
          position: relative;
          z-index: 2;
        }

        .trust-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .trust-item {
          padding: 22px;
          border-radius: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
        }

        .trust-kicker {
          display: block;
          font-size: 0.74rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: #64748b;
          margin-bottom: 8px;
        }

        .trust-item strong {
          font-size: 1.04rem;
          line-height: 1.55;
          color: #0f172a;
          word-break: keep-all;
        }

        .section-wrap {
          padding: 86px 0;
        }

        .section-business {
          padding-top: 76px;
          padding-bottom: 96px;
        }

        .section-head {
          max-width: 800px;
          margin: 0 auto 38px;
          text-align: center;
        }

        .section-head.left {
          margin-left: 0;
          margin-bottom: 32px;
          text-align: left;
        }

        .section-tag {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: #e8f6ff;
          color: #0369a1;
          font-size: 0.8rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .section-head h2 {
          margin: 16px 0 12px;
          font-size: clamp(2rem, 3vw, 3rem);
          line-height: 1.22;
          letter-spacing: -0.03em;
          color: #0f172a;
          word-break: keep-all;
        }

        .section-head p {
          margin: 0;
          color: #475569;
          font-size: 1.04rem;
          line-height: 1.9;
          word-break: keep-all;
        }

        .dark-flow {
          background: linear-gradient(180deg, #eaf6ff 0%, #f8fbff 100%);
          color: #0f172a;
        }

        .dark-flow .section-head h2,
        .dark-flow .section-head p {
          color: #0f172a;
        }

        .dark-flow .section-head p {
          opacity: 1;
        }

        .dark-flow .section-tag {
          background: rgba(37, 99, 235, 0.08);
          color: #0369a1;
        }

        .process-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          margin-top: 28px;
        }

        .process-card {
          padding: 26px 24px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.84);
          border: 1px solid rgba(148, 163, 184, 0.16);
        }

        .process-step {
          display: inline-flex;
          margin-bottom: 12px;
          color: #0284c7;
          font-size: 0.82rem;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .process-card h3 {
          margin: 0 0 10px;
          font-size: 1.16rem;
          color: #0f172a;
          word-break: keep-all;
        }

        .process-card p {
          margin: 0;
          line-height: 1.8;
          color: #334155;
          font-size: 0.98rem;
          word-break: keep-all;
        }

        .final-message-card {
          margin-top: 18px;
          padding: 38px 28px;
          border-radius: 30px;
          background: linear-gradient(180deg, #ffffff, #edf6ff);
          color: #0f172a;
          text-align: center;
          box-shadow: 0 24px 60px rgba(37, 78, 145, 0.12);
        }

        .final-kicker {
          margin: 0 0 10px;
          font-size: 0.8rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: #0284c7;
        }

        .final-message-card h3 {
          margin: 0;
          font-size: clamp(1.6rem, 2.2vw, 2.3rem);
          line-height: 1.32;
          word-break: keep-all;
        }

        .final-desc {
          max-width: 680px;
          margin: 14px auto 0;
          color: #334155;
          line-height: 1.8;
          font-size: 1rem;
          word-break: keep-all;
        }

        .final-actions {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 24px;
        }


        .click-interactive {
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
        }

        .click-interactive:hover {
          transform: translateY(-2px);
        }

        .click-interactive:active {
          transform: scale(0.985);
        }
        @media (max-width: 1100px) {
          .hero-inner {
            grid-template-columns: 1fr;
          }

          .process-grid,
          .trust-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 780px) {
          .hero-section {
            padding: 80px 0 64px;
          }

          .hero-inner,
          .trust-grid,
          .process-grid {
            grid-template-columns: 1fr;
          }

          .hero-title {
            font-size: 2.35rem;
          }

          .hero-desc {
            font-size: 1rem;
            line-height: 1.8;
          }

          .section-wrap {
            padding: 64px 0;
          }

          .section-business {
            padding-top: 58px;
            padding-bottom: 78px;
          }

          .btn-primary,
          .btn-secondary {
            width: 100%;
          }

          .hero-actions,
          .final-actions {
            flex-direction: column;
          }

          .hero-panel,
          .process-card,
          .trust-item,
          .final-message-card {
            border-radius: 22px;
          }
        }
      `}</style>
    </>
  );
}
