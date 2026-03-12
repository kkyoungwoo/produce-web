import type { WorkbenchProductConfig } from "@/components/workbench/types";

const DEFAULT_CONFIG: WorkbenchProductConfig = {
  inputMode: "default",
  statMode: "none",
};

const CONFIG_BY_SLUG: Record<string, WorkbenchProductConfig> = {
  "api-15086411": {
    inputMode: "default",
    statMode: "country:worknational",
  },
  "api-15134013": {
    inputMode: "default",
    statMode: "country:nationalName",
  },
  "api-15120791": {
    inputMode: "default",
    statMode: "region:addr",
  },
  "api-15155139": {
    inputMode: "homestay",
    statMode: "region:homestay",
    hideInputKeys: ["cond[BASE_DATE::EQ]", "cond[SALS_STTS_CD::EQ]", "cond[BPLC_NM::LIKE]"],
    forceDefaultDates: true,
    forceBaseDateToYesterday: true,
  },
};

export function getWorkbenchProductConfig(slug: string): WorkbenchProductConfig {
  return CONFIG_BY_SLUG[slug] ?? DEFAULT_CONFIG;
}