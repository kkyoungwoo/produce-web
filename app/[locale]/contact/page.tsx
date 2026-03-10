import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import JsonLd from "@/components/json-ld";
import { isLocale, type Locale } from "@/lib/i18n/config";
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

  const t = getLocaleContent(locale as Locale);

  return (
    <section className="container page-section">
      <JsonLd data={buildJsonLd(locale as Locale, "contact")} />
      <h1>{t.contact.title}</h1>
      <p className="lead">{t.contact.description}</p>

      <div className="card contact-card">
        <p>
          <strong>{t.contact.emailLabel}:</strong> {t.contact.emailValue}
        </p>
        <p>
          <strong>{t.contact.githubLabel}:</strong>{" "}
          <Link href={t.contact.githubValue} target="_blank" rel="noreferrer">
            {t.contact.githubValue}
          </Link>
        </p>
        <p>
          <strong>{t.contact.noteLabel}:</strong> {t.contact.noteValue}
        </p>
      </div>
    </section>
  );
}
