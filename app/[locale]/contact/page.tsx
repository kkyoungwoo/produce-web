import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocale, type Locale } from "@/lib/i18n/config";
import { createPageMetadata } from "@/lib/i18n/seo";
import { content } from "@/lib/i18n/translations";

type Params = { locale: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return createPageMetadata(locale, "contact");
}

export default async function ContactPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = content[locale as Locale];

  return (
    <section className="container page-section">
      <h1>{t.contact.title}</h1>
      <p className="lead">{t.contact.description}</p>
      <div className="card contact-card">
        <p>
          <strong>{t.contact.emailLabel}:</strong> hello@gorhrod-codex.web.app
        </p>
        <p>
          <strong>{t.contact.phoneLabel}:</strong> +82-2-0000-0000
        </p>
        <p>
          <strong>{t.contact.addressLabel}:</strong> Seoul, Republic of Korea
        </p>
      </div>
    </section>
  );
}