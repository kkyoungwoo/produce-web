import Link from "next/link";

import type { Locale } from "@/lib/i18n/config";
import { getLocaleContent } from "@/lib/i18n/translations";

type HeaderProps = {
  locale?: Locale;
};

export default function Header({ locale = "ko" }: HeaderProps) {
  const t = getLocaleContent(locale);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex min-h-[72px] w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="text-sm font-black tracking-[0.14em] text-slate-800">
          {t.brand}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600" aria-label="main navigation">
          <Link href="/services" className="transition-colors hover:text-blue-600">
            {t.nav.services}
          </Link>
          <Link href="/db-cleanup" className="transition-colors hover:text-blue-600">
            {t.nav.dbCleanup}
          </Link>
          <Link href="/mp4Creater" className="transition-colors hover:text-blue-600">
            {t.nav.mp4Creater}
          </Link>
        </nav>
      </div>
    </header>
  );
}
