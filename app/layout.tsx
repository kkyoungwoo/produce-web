import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Produce Web',
  description: 'Migrated from Create React App to Next.js',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
