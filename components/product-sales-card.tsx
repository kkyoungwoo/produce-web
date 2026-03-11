import Link from "next/link";

import type { ProductItem } from "@/lib/i18n/types";

type ProductSalesCardProps = {
  locale: string;
  item: ProductItem;
  detailLabel: string;
  mode?: "compact" | "rich";
  labels?: {
    collect: string;
    input: string;
    doc: string;
    guide: string;
    account: string;
  };
};

export default function ProductSalesCard({
  locale,
  item,
  detailLabel,
  mode = "compact",
  labels = {
    collect: "Collect",
    input: "Input",
    doc: "Doc",
    guide: "Guide",
    account: "API Account",
  },
}: ProductSalesCardProps) {
  const isCompact = mode === "compact";

  return (
    <Link
      href={`/${locale}/services/${item.slug}`}
      className="group grid cursor-pointer gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)] transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_20px_40px_rgba(42,84,146,0.16)] active:scale-[0.99]"
      data-clickable="true"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">{item.status}</p>
        <p className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{item.priceLabel}</p>
      </div>

      <h3 className={`font-bold text-slate-900 ${isCompact ? "truncate text-base leading-6" : "text-lg leading-snug"}`}>{item.title}</h3>
      <p className={`text-slate-600 ${isCompact ? "truncate text-sm leading-6" : "text-sm leading-7"}`}>{item.summary}</p>
      <p className="truncate text-xs text-slate-500">Data ID {item.portalDataId}</p>

      {mode === "rich" ? (
        <>
          <div className="grid gap-1 text-xs text-slate-600">
            <span>{labels.collect}: {item.collectFocus}</span>
            <span>{labels.input}: {item.inputFields.map((field) => field.key).join(", ")}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              className="inline-flex min-h-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
              href={item.apiDocUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {labels.doc}
            </a>
            {item.apiGuideUrl ? (
              <a
                className="inline-flex min-h-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
                href={item.apiGuideUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {labels.guide}
              </a>
            ) : null}
            <a
              className="inline-flex min-h-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
              href={item.accountGuideUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {labels.account}
            </a>
          </div>
        </>
      ) : null}

      <div className="inline-flex min-h-9 w-fit items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
        {detailLabel}
      </div>
    </Link>
  );
}