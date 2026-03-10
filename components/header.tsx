import Link from "next/link";

import type { Locale } from "@/lib/i18n/config";
import { getLocaleContent } from "@/lib/i18n/translations";

import LanguageSwitcher from "./language-switcher";

type HeaderProps = {
  locale: Locale;
};

export default function Header({ locale }: HeaderProps) {
  const t = getLocaleContent(locale);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href={`/${locale}`} className="brand">
          {t.brand}
        </Link>
        <nav className="nav-links" aria-label="main navigation">
          <Link href={`/${locale}`}>{t.nav.home}</Link>
          <Link href={`/${locale}/about`}>{t.nav.about}</Link>
          <Link href={`/${locale}/services`}>{t.nav.services}</Link>
          <Link href={`/${locale}/contact`}>{t.nav.contact}</Link>
        </nav>
        <LanguageSwitcher locale={locale} />
      </div>
    </header>
  );
}
