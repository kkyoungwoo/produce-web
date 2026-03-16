import type { ProductItem } from "@/lib/i18n/types";

/**
 * Public data source references for development
 * 15086411: https://www.data.go.kr/data/15086411/openapi.do
 * 15120791: https://www.data.go.kr/data/15120791/openapi.do
 * 15155139: https://www.data.go.kr/data/15155139/openapi.do
 * 15154910: https://www.data.go.kr/data/15154910/openapi.do
 * 15044679(fileData): https://www.data.go.kr/data/15044679/fileData.do
 * API account guide: https://www.data.go.kr/iim/api/selectAPIAcountView.do
 */

export type CollectOptions = {
  serviceKey: string;
  startDate?: string;
  endDate?: string;
  constructionStartDate?: string;
  constructionEndDate?: string;
  conditions?: Record<string, string | number | undefined>;
  pageNo?: number;
  numOfRows?: number;
};

export type CollectorEndpointConfig = {
  productSlug: ProductItem["slug"];
  endpoint: string;
  defaultParams?: Record<string, string | number>;
  startDateKey?: string;
  endDateKey?: string;
  constructionStartDateKey?: string;
  constructionEndDateKey?: string;
};

export const collectorEndpointMap: Record<string, CollectorEndpointConfig> = {
  "api-15086411-collector": {
    productSlug: "api-15086411-collector",
    endpoint: "https://api.data.go.kr/placeholder/15086411",
    startDateKey: "startDate",
    endDateKey: "endDate",
  },
  "api-15120791-collector": {
    productSlug: "api-15120791-collector",
    endpoint: "https://api.data.go.kr/placeholder/15120791",
    startDateKey: "startDate",
    endDateKey: "endDate",
    defaultParams: { pageNo: 1 },
  },
  "api-15155139-collector": {
    productSlug: "api-15155139-collector",
    endpoint: "https://api.data.go.kr/placeholder/15155139",
    startDateKey: "baseDate",
  },
  "api-15154910-collector": {
    productSlug: "api-15154910-collector",
    endpoint: "https://api.data.go.kr/placeholder/15154910",
    startDateKey: "startDate",
    endDateKey: "endDate",
  },
  "filedata-15044679-collector": {
    productSlug: "filedata-15044679-collector",
    endpoint: "https://api.data.go.kr/placeholder/15044679-filedata",
    startDateKey: "baseDate",
  },
};

export function buildCollectorRequestUrl(productSlug: string, options: CollectOptions): string {
  const config = collectorEndpointMap[productSlug];
  if (!config) {
    throw new Error(`Unknown product slug: ${productSlug}`);
  }

  const params = new URLSearchParams();
  params.set("serviceKey", options.serviceKey);

  if (config.defaultParams) {
    Object.entries(config.defaultParams).forEach(([key, value]) => {
      params.set(key, String(value));
    });
  }

  if (config.startDateKey && options.startDate) {
    params.set(config.startDateKey, options.startDate);
  }

  if (config.endDateKey && options.endDate) {
    params.set(config.endDateKey, options.endDate);
  }

  if (config.constructionStartDateKey && options.constructionStartDate) {
    params.set(config.constructionStartDateKey, options.constructionStartDate);
  }

  if (config.constructionEndDateKey && options.constructionEndDate) {
    params.set(config.constructionEndDateKey, options.constructionEndDate);
  }

  if (options.pageNo) params.set("pageNo", String(options.pageNo));
  if (options.numOfRows) params.set("numOfRows", String(options.numOfRows));

  if (options.conditions) {
    Object.entries(options.conditions).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });
  }

  return `${config.endpoint}?${params.toString()}`;
}

export function normalizeCollectorRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = { ...row };
    Object.entries(normalized).forEach(([key, value]) => {
      if (typeof value === "string") {
        normalized[key] = value.trim();
      }
    });
    return normalized as T;
  });
}
