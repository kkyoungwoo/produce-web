"use client";

import { usePathname, useRouter } from "next/navigation";

import type { Locale } from "@/lib/i18n/config";
import { locales } from "@/lib/i18n/config";
import { getLocaleContent } from "@/lib/i18n/translations";

type LanguageSwitcherProps = {
  locale: Locale;
};

export default function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();

  const onChange = (nextLocale: Locale) => {
    const segments = pathname.split("/");
    if (segments.length > 1) {
      segments[1] = nextLocale;
      router.push(segments.join("/"));
    }
  };

  return (
    <div className="language-switcher" role="group" aria-label="language switcher">
      {locales.map((lang) => (
        <button
          key={lang}
          type="button"
          className={lang === locale ? "active" : ""}
          onClick={() => onChange(lang)}
        >
          {getLocaleContent(lang).localeName}
        </button>
      ))}
    </div>
  );
}
