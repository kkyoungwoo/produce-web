import {
  ARCH_SIGUNGU_NAME_MAP,
  COLUMN_LABEL_KR,
  REGION_NAME_MAP,
  SALS_STATUS_MAP,
  WORKNATIONAL_MAP,
} from "@/components/workbench/constants";
import type { CollectResponse } from "@/components/workbench/types";

const COUNTRY_UNKNOWN = "국가 미분류";
const REGION_UNKNOWN = "지역 미분류";

const REGION_PREFIX_RULES = [
  { prefixes: ["서울", "서울특별시"], name: "서울특별시" },
  { prefixes: ["부산", "부산광역시"], name: "부산광역시" },
  { prefixes: ["대구", "대구광역시"], name: "대구광역시" },
  { prefixes: ["인천", "인천광역시"], name: "인천광역시" },
  { prefixes: ["광주", "광주광역시"], name: "광주광역시" },
  { prefixes: ["대전", "대전광역시"], name: "대전광역시" },
  { prefixes: ["울산", "울산광역시"], name: "울산광역시" },
  { prefixes: ["세종", "세종특별자치시"], name: "세종특별자치시" },
  { prefixes: ["경기", "경기도"], name: "경기도" },
  { prefixes: ["강원", "강원특별자치도"], name: "강원특별자치도" },
  { prefixes: ["충북", "충청북도"], name: "충청북도" },
  { prefixes: ["충남", "충청남도"], name: "충청남도" },
  { prefixes: ["전북", "전북특별자치도"], name: "전북특별자치도" },
  { prefixes: ["전남", "전라남도"], name: "전라남도" },
  { prefixes: ["경북", "경상북도"], name: "경상북도" },
  { prefixes: ["경남", "경상남도"], name: "경상남도" },
  { prefixes: ["제주", "제주특별자치도"], name: "제주특별자치도" },
] as const;

function normalizeProvinceName(value: string) {
  const text = value.trim();
  if (!text) return "";

  const matched = REGION_PREFIX_RULES.find((rule) => rule.prefixes.some((prefix) => text.startsWith(prefix)));
  return matched?.name ?? text;
}

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
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

export function normalizeCountry(value: string | number | undefined) {
  const text = toText(value);
  if (!text) return COUNTRY_UNKNOWN;
  return WORKNATIONAL_MAP[text] ?? (/^\d+$/.test(text) ? COUNTRY_UNKNOWN : text);
}

export function regionNameFromAddress(value: string | number | undefined) {
  const text = toText(value);
  if (!text) return REGION_UNKNOWN;

  const first = text.split(/\s+/).filter(Boolean)[0] ?? "";
  if (!first) return REGION_UNKNOWN;

  return normalizeProvinceName(first) || REGION_UNKNOWN;
}

export function homestayRegionName(
  value: string | number | undefined,
  roadAddr?: string | number | undefined,
  lotAddr?: string | number | undefined,
) {
  const code = toText(value);
  if (code && REGION_NAME_MAP[code]) return REGION_NAME_MAP[code];

  const roadRegion = regionNameFromAddress(roadAddr);
  if (roadRegion !== REGION_UNKNOWN) return roadRegion;

  const lotRegion = regionNameFromAddress(lotAddr);
  if (lotRegion !== REGION_UNKNOWN) return lotRegion;

  return REGION_UNKNOWN;
}

export function foodRegionNameFromAddress(value: string | number | undefined) {
  return regionNameFromAddress(value);
}

export function archRegionNameFromSigungu(value: string | number | undefined) {
  const code = toText(value);
  if (!code) return REGION_UNKNOWN;
  return ARCH_SIGUNGU_NAME_MAP[code] ?? REGION_UNKNOWN;
}

export function cityNameFromAddress(value: string | number | undefined) {
  const text = toText(value);
  if (!text) return REGION_UNKNOWN;

  const parts = text.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const second = parts[1] ?? "";

  if (!first) return REGION_UNKNOWN;

  const normalizedFirst = normalizeProvinceName(first);
  if (normalizedFirst !== first && second) {
    if (second.endsWith("시") || second.endsWith("군") || second.endsWith("구")) {
      return second;
    }
  }

  if (
    normalizedFirst.endsWith("특별시")
    || normalizedFirst.endsWith("광역시")
    || normalizedFirst.endsWith("특별자치시")
    || normalizedFirst.endsWith("특별자치도")
    || normalizedFirst.endsWith("도")
  ) {
    return normalizedFirst;
  }

  return first;
}

export function eduRegionName(value: string | number | undefined) {
  return cityNameFromAddress(value);
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

  if (key === "worknational" || key === "nationalName") return normalizeCountry(text);
  if (key === "OPN_ATMY_GRP_CD") {
    return homestayRegionName(
      text,
      row.ROAD_NM_ADDR as string | number | undefined,
      row.LOTNO_ADDR as string | number | undefined,
    );
  }
  if (key === "sigunguCd") return archRegionNameFromSigungu(text);
  if (key === "platPlc") return text;
  if (key === "LCPMT_YMD" || key === "LCPMT_RTRCN_YMD" || key === "crtnDay") return formatYmd(text);
  if (key === "LAST_MDFCN_PNT" || key === "DAT_UPDT_PNT") return formatYmdHms(text);

  if (key === "SALS_STTS_CD") {
    if (row.SALS_STTS_NM) return toText(row.SALS_STTS_NM as string | number);
    return SALS_STATUS_MAP[text] ?? text;
  }

  return text;
}

export function getColumnLabel(key: string, custom: Record<string, string>) {
  return custom[key] ?? COLUMN_LABEL_KR[key] ?? `컬럼(${key})`;
}

export function isInvalidServiceKeyError(data: CollectResponse, status: number) {
  const text = `${data.message ?? ""} ${data.upstream ?? ""}`.toLowerCase();

  if (status === 401 || status === 403) return true;

  return (
    text.includes("인증키")
    || text.includes("servicekey")
    || text.includes("service key")
    || text.includes("invalid service key")
    || text.includes("service key is not registered")
    || text.includes("error code(-4)")
    || text.includes("오류(-4)")
  );
}
