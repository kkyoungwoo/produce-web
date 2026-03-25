import Link from "next/link";

import { notFoundCopyByLocale } from "@/content/ui-text/not-found";
import { defaultLocale } from "@/lib/i18n/config";

export default function NotFound() {
  const copy = notFoundCopyByLocale[defaultLocale];

  return (
    <main className="relative flex min-h-[calc(100vh-180px)] w-full items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_0%,rgba(86,143,255,0.2),transparent_28%),radial-gradient(circle_at_92%_12%,rgba(45,199,168,0.16),transparent_25%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)]" />

      <section className="w-full max-w-4xl rounded-3xl border border-blue-200 bg-white/95 p-6 shadow-[0_22px_54px_rgba(30,64,125,0.14)] sm:p-8">
        <p className="text-xs font-extrabold tracking-[0.16em] text-blue-600">{copy.codeLabel}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{copy.title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{copy.description}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/services"
            className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-base font-extrabold text-white shadow-[0_12px_28px_rgba(37,99,235,0.28)] transition hover:bg-blue-700"
          >
            {copy.primaryCta}
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-5 py-3 text-base font-extrabold text-blue-700 transition hover:bg-blue-100"
          >
            {copy.secondaryCta}
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-extrabold text-slate-800">{copy.tipsTitle}</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            {copy.tips.map((tip) => (
              <li key={tip}>• {tip}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
