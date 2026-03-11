"use client";

import type { Locale } from "@/lib/i18n/config";
import { locales } from "@/lib/i18n/config";

type LanguageSwitcherProps = {
  locale: Locale;
};

export default function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  void locale;

  if (locales.length <= 1) {
    return null;
  }

  return null;
}
