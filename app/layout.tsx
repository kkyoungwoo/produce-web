import type { Metadata } from "next";

import { siteBaseMetadata } from "@/lib/i18n/seo";

import "./globals.css";

export const metadata: Metadata = siteBaseMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
