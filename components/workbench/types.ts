import type { ProductItem } from "@/lib/i18n/types";

export type WorkbenchLabels = {
  runLabel: string;
  resetLabel: string;
  resultBadge: string;
  resultTitle: string;
  excelLabel: string;
  successLabel: string;
  errorLabel: string;
  noDataLabel: string;
  sourceUrlLabel: string;
};

export type WorkbenchProps = {
  product: ProductItem;
  labels: WorkbenchLabels;
};

export type CollectResponse = {
  ok: boolean;
  rows?: Array<Record<string, string | number>>;
  totalCount?: number;
  sourceUrl?: string;
  message?: string;
  upstream?: string;
};

export type WorkbenchStatMode =
  | "none"
  | "country:worknational"
  | "country:nationalName"
  | "region:homestay"
  | "region:addr";

export type WorkbenchInputMode = "default" | "homestay";

export type WorkbenchProductConfig = {
  inputMode: WorkbenchInputMode;
  statMode: WorkbenchStatMode;
  hideInputKeys?: string[];
  forceDefaultDates?: boolean;
  forceBaseDateToYesterday?: boolean;
};