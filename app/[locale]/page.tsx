import { redirect, notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

type Params = { locale: string };

export default async function LocaleHomeRedirectPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect("/");
}
