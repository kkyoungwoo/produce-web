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
  previewLimited?: boolean;
  authStatus?: "full" | "default-preview" | "fallback-preview" | "missing-preview";
  previewCount?: number;
  endpointFamily?: "hs" | "arch";
  searchedTargetCount?: number;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  usedDateFallback?: boolean;
  fallbackDays?: number;
};

export type WorkbenchStatMode =
  | "none"
  | "country:worknational"
  | "country:nationalName"
  | "region:homestay"
  | "region:food"
  | "region:city"
  | "region:addr"
  | "region:arch"
  | "region:factory";

export type WorkbenchInputMode = "default" | "homestay" | "archhub" | "factory";

export type WorkbenchProductConfig = {
  inputMode: WorkbenchInputMode;
  statMode: WorkbenchStatMode;
  hideInputKeys?: string[];
  forceDefaultDates?: boolean;
  forceBaseDateToYesterday?: boolean;
  permitDateDefaultDaysFrom?: number;
  permitDateDefaultFrom?: string;
  permitDateDefaultTo?: "today" | string;
  factoryRegionParamKey?: string;
  factoryRegionStepMode?: "sido-industrial-estate";
};
