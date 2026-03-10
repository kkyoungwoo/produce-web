import type { Locale } from "@/lib/i18n/config";
import { content } from "@/lib/i18n/translations";

type FooterProps = {
  locale: Locale;
};

export default function Footer({ locale }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>
          © {new Date().getFullYear()} {content[locale].brand}. {content[locale].footer}
        </p>
      </div>
    </footer>
  );
}
