import Link from "next/link";

import { defaultLocale } from "@/lib/i18n/config";

export default function NotFound() {
  return (
    <main className="not-found">
      <h1>404</h1>
      <p>요청하신 페이지를 찾을 수 없습니다.</p>
      <Link href={`/${defaultLocale}`}>홈으로 이동</Link>
    </main>
  );
}
