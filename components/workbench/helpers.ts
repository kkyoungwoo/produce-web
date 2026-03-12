import {
  COLUMN_LABEL_KR,
  REGION_NAME_MAP,
  SALS_STATUS_MAP,
  WORKNATIONAL_MAP,
} from "@/components/workbench/constants";
import type { CollectResponse } from "@/components/workbench/types";

export function toText(value: string | number | undefined) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function toApiDate(value: string) {
  return value.replace(/-/g, "");
}

export function toInputDate(value: string) {
  if (!value || value.length !== 8) return "";
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function dateBeforeDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export function normalizeCountry(value: string | number | undefined) {
  const text = toText(value);
  if (!text) return "援?? 誘몃텇瑜?;
  return WORKNATIONAL_MAP[text] ?? (/^\d+$/.test(text) ? "援?? 誘몃텇瑜? : text);
}

export function homestayRegionName(value: string | number | undefined) {
  const code = toText(value);
  if (!code) return "吏??誘몃텇瑜?;
  return REGION_NAME_MAP[code] ?? "吏??誘몃텇瑜?;
}

export function eduRegionName(value: string | number | undefined) {
  const text = toText(value);
  if (!text) return "吏??誘몃텇瑜?;
  return text.split(/\s+/)[0] || "吏??誘몃텇瑜?;
}

export function formatYmd(value: string | number | undefined) {
  const digits = toText(value).replace(/[^0-9]/g, "");
  if (digits.length !== 8) return toText(value);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function formatYmdHms(value: string | number | undefined) {
  const digits = toText(value).replace(/[^0-9]/g, "");
  if (digits.length !== 14) return toText(value);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)} ${digits.slice(8, 10)}:${digits.slice(10, 12)}:${digits.slice(12, 14)}`;
}

export function formatCellValue(
  key: string,
  value: string | number | undefined,
  row: Record<string, string | number>,
) {
  const text = toText(value);
  if (key === "worknational") return normalizeCountry(text);
  if (key === "nationalName") return normalizeCountry(text);
  if (key === "OPN_ATMY_GRP_CD") return homestayRegionName(text);
  if (key === "LCPMT_YMD" || key === "LCPMT_RTRCN_YMD") return formatYmd(text);
  if (key === "LAST_MDFCN_PNT" || key === "DAT_UPDT_PNT") return formatYmdHms(text);
  if (key === "SALS_STTS_CD") {
    if (row.SALS_STTS_NM) return toText(row.SALS_STTS_NM as string | number);
    return SALS_STATUS_MAP[text] ?? text;
  }
  return text;
}

export function getColumnLabel(key: string, custom: Record<string, string>) {
  return custom[key] ?? COLUMN_LABEL_KR[key] ?? key;
}

export function isInvalidServiceKeyError(data: CollectResponse, status: number) {
  const text = `${data.message ?? ""} ${data.upstream ?? ""}`.toLowerCase();

  if (status === 401 || status === 403) return true;

  return (
    text.includes("?깅줉?섏? ?딆? ?몄쬆??) ||
    text.includes("invalid service key") ||
    text.includes("service key is not registered") ||
    text.includes("?ㅻ쪟(-4)")
  );
}