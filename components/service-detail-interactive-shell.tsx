"use client";

import dynamic from "next/dynamic";

import type { LocaleContent, ProductItem } from "@/lib/i18n/types";

type Props = {
  locale?: string;
  products: ProductItem[];
  initialSlug: string;
  t: LocaleContent;
  kakaoChatUrl: string;
};

const ServiceDetailInteractive = dynamic(() => import("@/components/service-detail-interactive"), {
  ssr: false,
});

export default function ServiceDetailInteractiveShell(props: Props) {
  return <ServiceDetailInteractive {...props} />;
}
