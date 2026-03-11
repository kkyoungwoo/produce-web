import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Footer from "@/components/footer";
import Header from "@/components/header";
import PageFx from "@/components/page-fx";
import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { createPageMetadata } from "@/lib/i18n/seo";

type Params = { locale: string };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return createPageMetadata(locale, "home");
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col" data-locale={locale}>
      <Header locale={locale as Locale} />
      <PageFx />
      <main className="flex-1">{children}</main>
      <Footer locale={locale as Locale} />
    </div>
  );
}
