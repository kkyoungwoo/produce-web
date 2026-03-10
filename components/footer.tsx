import type { Locale } from "@/lib/i18n/config";
import { getLocaleContent } from "@/lib/i18n/translations";

type FooterProps = {
  locale: Locale;
};

export default function Footer({ locale }: FooterProps) {
  const t = getLocaleContent(locale);

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>
          © {new Date().getFullYear()} {t.brand}. {t.footer}
        </p>
      </div>
    </footer>
  );
}
