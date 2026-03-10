import type { Metadata } from "next";
import Link from "next/link";

import { locales } from "@/lib/i18n/config";
import { content } from "@/lib/i18n/translations";
import { siteBaseMetadata } from "@/lib/i18n/seo";

import "./globals.css";

export const metadata: Metadata = siteBaseMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="root-language-entry">
          <div className="container">
            <p className="entry-label">Choose Language</p>
            <div className="entry-links">
              {locales.map((locale) => (
                <Link key={locale} href={`/${locale}`}>
                  {content[locale].localeName}
                </Link>
              ))}
            </div>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
