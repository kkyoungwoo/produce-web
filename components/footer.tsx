import type { Locale } from "@/lib/i18n/config";
import { getLocaleContent } from "@/lib/i18n/translations";

type FooterProps = {
  locale?: Locale;
};

export default function Footer({ locale = "ko" }: FooterProps) {
  const t = getLocaleContent(locale);

  return (
    <footer className="mt-[50px] border-t border-slate-200/80 py-4 text-sm text-slate-500">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <p>
          © {new Date().getFullYear()} {t.brand}. {t.footer}
        </p>
      </div>
    </footer>
  );
}
