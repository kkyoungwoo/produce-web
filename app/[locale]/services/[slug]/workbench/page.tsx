import { redirect, notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

type Params = { locale: string; slug: string };

export default async function LocaleWorkbenchRedirectPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/services/${slug}/workbench`);
}
