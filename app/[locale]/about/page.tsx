import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocale, type Locale } from "@/lib/i18n/config";
import { createPageMetadata } from "@/lib/i18n/seo";
import { content } from "@/lib/i18n/translations";

type Params = { locale: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return createPageMetadata(locale, "about");
}

export default async function AboutPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = content[locale as Locale];

  return (
    <section className="container page-section">
      <h1>{t.about.title}</h1>
      <p className="lead">{t.about.description}</p>
    </section>
  );
}