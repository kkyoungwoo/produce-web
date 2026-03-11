import type { ProductItem, ProductWorkbenchColumn, ProductWorkbenchRow } from "@/lib/i18n/types";

const DEFAULT_COLUMNS: ProductWorkbenchColumn[] = [
  { key: "id", label: "번호" },
  { key: "name", label: "업체명" },
  { key: "region", label: "지역" },
  { key: "status", label: "상태" },
  { key: "baseDate", label: "기준일" },
];

const DEFAULT_REGIONS = ["서울", "경기", "부산", "대전", "광주"];
const DEFAULT_STATUSES = ["수집 완료", "검증 중", "적재 완료", "대기", "수집 완료"];

export function getWorkbenchBaseDate(product: ProductItem): string {
  const dateField = product.workbench?.primaryDateKey ?? "baseDate";
  const matched = product.inputFields.find((field) => field.key === dateField);
  const fallback = product.inputFields.find((field) => field.key === "startDate");

  return matched?.example ?? fallback?.example ?? "2026-03-11";
}

function buildDefaultRows(baseDate: string, count = 6): ProductWorkbenchRow[] {
  return Array.from({ length: count }).map((_, index) => ({
    id: index + 1,
    name: `샘플 업체 ${index + 1}`,
    region: DEFAULT_REGIONS[index % DEFAULT_REGIONS.length],
    status: DEFAULT_STATUSES[index % DEFAULT_STATUSES.length],
    baseDate,
  }));
}

export function getWorkbenchColumns(product: ProductItem): ProductWorkbenchColumn[] {
  const configured = product.workbench?.columns ?? [];
  return configured.length > 0 ? configured : DEFAULT_COLUMNS;
}

export function getWorkbenchRows(product: ProductItem, baseDate: string): ProductWorkbenchRow[] {
  const configured = product.workbench?.rows ?? [];
  if (configured.length > 0) return configured;
  return buildDefaultRows(baseDate);
}

export function getApiKeyInputGuide(product: ProductItem) {
  return product.apiCredential ?? {
    envVarName: "DATA_GO_KR_SERVICE_KEY",
    queryKey: "serviceKey",
    placeholder: "YOUR_DATA_GO_KR_SERVICE_KEY",
  };
}
