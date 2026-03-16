"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WorkbenchArchhubClient from "@/components/workbench-archhub-client";
import { downloadFlatExcel, downloadGroupedExcel } from "@/components/workbench/excel";
import {
  CHUNK_SIZE,
  FACTORY_EMPLOYEE_OPTIONS,
  FACTORY_REGION_OPTIONS,
  FACTORY_INDUSTRIAL_ESTATE_OPTIONS,
  HIDDEN_META_KEYS,
  REGION_OPTIONS,
  REGION_OPTIONS_15154910,
  REGION_OPTIONS_15155139,
  SALES_STATUS_OPTIONS,
} from "@/components/workbench/constants";
import {
  dateBeforeDays,
  eduRegionName,
  factoryRegionName,
  formatCellValue,
  getColumnLabel,
  homestayRegionName,
  matchFactoryEmployeeRange,
  normalizeCountry,
  toApiDate,
  toInputDate,
  toText,
} from "@/components/workbench/helpers";
import { getWorkbenchProductConfig } from "@/components/workbench/product-config";
import { WORKBENCH_TEXT } from "@/components/workbench/text";
import type { CollectResponse, WorkbenchProps, WorkbenchStatMode } from "@/components/workbench/types";

const FALLBACK_PREVIEW_SERVICE_KEY =
  "591089a0b764d1e7aedea398987e4560a22a0c3c82504cf0279781b0ff06668b";

const PREVIEW_SERVICE_KEY_MAP: Record<string, string> = {
  vip: FALLBACK_PREVIEW_SERVICE_KEY,
  gold: FALLBACK_PREVIEW_SERVICE_KEY,
  master: FALLBACK_PREVIEW_SERVICE_KEY,
};

const ALL_FILTER = WORKBENCH_TEXT.allFilterLabel;
const SALES_STATUS_PRODUCT_SLUGS = new Set(["api-15155139", "api-15154910"]);
const ALL_SALES_STATUS_CODES = SALES_STATUS_OPTIONS.map((item) => item.code);

const FACTORY_DEFAULT_FROM = dateBeforeDays(365);
const FACTORY_DEFAULT_TO = dateBeforeDays(0);
const FACTORY_FETCH_CONCURRENCY = 4;

function normalizePreviewKey(value?: string) {
  return String(value ?? "").trim().toLowerCase();
}

function resolvePreviewServiceKey(inputKey?: string) {
  const trimmed = String(inputKey ?? "").trim();
  if (!trimmed) return "";
  return PREVIEW_SERVICE_KEY_MAP[normalizePreviewKey(trimmed)] ?? trimmed;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`JSON 응답이 아닙니다. 응답 앞부분: ${text.slice(0, 200)}`);
  }
}

function getStatName(statMode: WorkbenchStatMode, row: Record<string, string | number>) {
  if (statMode === "country:worknational") {
    return normalizeCountry(row.worknational as string | number | undefined);
  }

  if (statMode === "country:nationalName") {
    return normalizeCountry(row.nationalName as string | number | undefined);
  }

  if (statMode === "region:homestay" || statMode === "region:food") {
    return homestayRegionName(
      row.OPN_ATMY_GRP_CD as string | number | undefined,
      row.ROAD_NM_ADDR as string | number | undefined,
      row.LOTNO_ADDR as string | number | undefined,
    );
  }

  if (statMode === "region:addr") {
    return eduRegionName(row.addr as string | number | undefined);
  }

  if (statMode === "region:factory") {
    return factoryRegionName(row.rnAdres as string | number | undefined);
  }

  return "";
}

function getDefaultFromDate(configFrom: string | undefined, configDays: number | undefined) {
  if (configFrom) return configFrom;
  if (typeof configDays === "number") return dateBeforeDays(configDays);
  return dateBeforeDays(3);
}

function getDefaultToDate(configTo: "today" | string | undefined) {
  if (!configTo || configTo === "today") return dateBeforeDays(0);
  return configTo;
}

function getGroupedDownloadLabel(statMode: WorkbenchStatMode) {
  if (statMode.startsWith("region:")) return WORKBENCH_TEXT.groupedRegionExcelLabel;
  if (statMode.startsWith("country:")) return WORKBENCH_TEXT.groupedCountryExcelLabel;
  return "";
}

function getCollectRowKey(row: Record<string, string | number>) {
  const keyParts = [
    String(row.MNG_NO ?? row.fctryManageNo ?? ""),
    String(row.BPLC_NM ?? row.cmpnyNm ?? ""),
    String(row.LCPMT_YMD ?? row.frstFctryRegistDe ?? ""),
    String(row.ROAD_NM_ADDR ?? row.rnAdres ?? row.LOTNO_ADDR ?? ""),
    String(row.irsttNm ?? ""),
  ];

  return keyParts.some(Boolean) ? keyParts.join("|") : JSON.stringify(row);
}

function mergeCollectRows(rows: Array<Record<string, string | number>>) {
  return Array.from(
    new Map(
      rows.map((row) => {
        const key = getCollectRowKey(row);
        return [key, row] as const;
      }),
    ).values(),
  );
}

function appendUniqueCollectRows(
  target: Map<string, Record<string, string | number>>,
  rows: Array<Record<string, string | number>>,
) {
  for (const row of rows) {
    const key = getCollectRowKey(row);
    if (!target.has(key)) {
      target.set(key, row);
    }
  }
}

function normalizeSelectedSalesStatuses(selected: string[]) {
  return Array.from(new Set(selected));
}

function getProgressRegionName(
  regionOptions: ReadonlyArray<{ code: string; name: string }>,
  regionCode: string,
) {
  return regionOptions.find((item) => item.code === regionCode)?.name ?? regionCode;
}

function buildMessage(data: CollectResponse, totalRows: number, successLabel: string) {
  if (data.previewLimited) {
    return totalRows > 0
      ? `${data.message ?? WORKBENCH_TEXT.previewUsingDefaultKey} · 총 ${totalRows}${WORKBENCH_TEXT.countSuffix}`
      : data.message ?? WORKBENCH_TEXT.previewUsingDefaultKey;
  }

  return totalRows > 0
    ? `${successLabel}: ${WORKBENCH_TEXT.totalPrefix} ${data.totalCount ?? totalRows}${WORKBENCH_TEXT.countSuffix}`
    : data.message ?? "";
}

function normalizeDateDigits(value: string | number | undefined) {
  return toText(value).replace(/\D/g, "");
}

function matchFactoryRegDateRangeSafe(
  value: string | number | undefined,
  from: string,
  to: string,
) {
  if (!from && !to) return true;

  const current = normalizeDateDigits(value);
  const fromDigits = normalizeDateDigits(from);
  const toDigits = normalizeDateDigits(to);

  if (current.length !== 8) {
    return true;
  }

  if (fromDigits.length === 8 && current < fromDigits) {
    return false;
  }

  if (toDigits.length === 8 && current > toDigits) {
    return false;
  }

  return true;
}

function buildEmptyResultMessage(infoMessage: string, firstError: string) {
  if (infoMessage) return infoMessage;
  if (firstError) {
    return `조회는 완료되었지만 가져올 데이터가 없습니다. ${firstError}`;
  }
  return "조회는 정상적으로 완료되었습니다. 다만 현재 검색 조건에 맞는 데이터가 없습니다.";
}

export default function WorkbenchCollectorClient(props: WorkbenchProps) {
  return props.product.slug === "api-15136560" ? (
    <WorkbenchArchhubClient {...props} />
  ) : (
    <WorkbenchCollectorBody {...props} />
  );
}

function WorkbenchCollectorBody({ product, labels }: WorkbenchProps) {
  const config = useMemo(() => getWorkbenchProductConfig(product.slug), [product.slug]);
  const supportsSalesStatusFilter = SALES_STATUS_PRODUCT_SLUGS.has(product.slug);

  const defaultInputs = useMemo(
    () =>
      Object.fromEntries(
        product.inputFields.map((field) => [field.key, field.key === "serviceKey" ? "" : field.example]),
      ) as Record<string, string>,
    [product],
  );

  const regionOptions = useMemo(
    () =>
      product.slug === "api-15155139"
        ? REGION_OPTIONS_15155139
        : product.slug === "api-15154910"
          ? REGION_OPTIONS_15154910
          : REGION_OPTIONS,
    [product.slug],
  );

  const factoryRegionOptions = FACTORY_REGION_OPTIONS;

  const [params, setParams] = useState<Record<string, string>>(defaultInputs);
  const [rows, setRows] = useState<Array<Record<string, string | number>>>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const [progress, setProgress] = useState(0);
  const [progressTitle, setProgressTitle] = useState("");
  const [progressDetail, setProgressDetail] = useState("");
  const [hasQueried, setHasQueried] = useState(false);
  const [statFilter, setStatFilter] = useState<string>(ALL_FILTER);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedSalesStatuses, setSelectedSalesStatuses] = useState<string[]>([]);
  const [selectedFactoryRegion, setSelectedFactoryRegion] = useState("");
  const [selectedEmployeeRange, setSelectedEmployeeRange] = useState("all");
  const [factoryDateFrom, setFactoryDateFrom] = useState(FACTORY_DEFAULT_FROM);
  const [factoryDateTo, setFactoryDateTo] = useState(FACTORY_DEFAULT_TO);

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const factoryIndustrialEstateOptions = useMemo(() => {
    if (!selectedFactoryRegion) return [];
    return FACTORY_INDUSTRIAL_ESTATE_OPTIONS[selectedFactoryRegion] ?? [];
  }, [selectedFactoryRegion]);

  const selectedFactoryIndustrialEstates = useMemo(
    () => factoryIndustrialEstateOptions.map((item) => item.name),
    [factoryIndustrialEstateOptions],
  );

  useEffect(() => {
    if (config.inputMode !== "homestay") {
      setSelectedRegions([]);
      return;
    }
    setSelectedRegions([]);
  }, [config.inputMode, regionOptions]);

  useEffect(() => {
    setSelectedSalesStatuses([]);
  }, [supportsSalesStatusFilter, product.slug]);

  useEffect(() => {
    if (config.inputMode !== "factory") return;
    setSelectedFactoryRegion("");
    setSelectedEmployeeRange("all");
    setFactoryDateFrom(FACTORY_DEFAULT_FROM);
    setFactoryDateTo(FACTORY_DEFAULT_TO);
  }, [config.inputMode, product.slug]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const labelMap = useMemo(
    () =>
      Object.fromEntries((product.workbench?.columns ?? []).map((column) => [column.key, column.label])) as Record<
        string,
        string
      >,
    [product.workbench?.columns],
  );

  const visibleInputFields = useMemo(() => {
    const hidden = new Set(config.hideInputKeys ?? []);
    return product.inputFields.filter((field) => !hidden.has(field.key));
  }, [config.hideInputKeys, product.inputFields]);

  const statBuckets = useMemo(() => {
    if (config.statMode === "none") {
      return [] as Array<{ name: string; rows: Array<Record<string, string | number>> }>;
    }

    const groups = new Map<string, Array<Record<string, string | number>>>();

    for (const row of rows) {
      const name = getStatName(config.statMode, row);
      if (!name) continue;
      groups.set(name, [...(groups.get(name) ?? []), row]);
    }

    return Array.from(groups.entries()).map(([name, bucketRows]) => ({
      name,
      rows: bucketRows,
    }));
  }, [config.statMode, rows]);

  const statItems = useMemo(
    () =>
      config.statMode === "none"
        ? []
        : [{ name: ALL_FILTER, count: rows.length }, ...statBuckets.map((bucket) => ({ name: bucket.name, count: bucket.rows.length }))],
    [config.statMode, rows.length, statBuckets],
  );

  const activeSalesStatuses = normalizeSelectedSalesStatuses(selectedSalesStatuses);

  const filteredRows = useMemo(() => {
    let output = rows;

    if (config.statMode !== "none" && statFilter !== ALL_FILTER) {
      output = output.filter((row) => getStatName(config.statMode, row) === statFilter);
    }

    if (
      supportsSalesStatusFilter &&
      activeSalesStatuses.length > 0 &&
      activeSalesStatuses.length < ALL_SALES_STATUS_CODES.length
    ) {
      output = output.filter((row) =>
        activeSalesStatuses.includes(toText(row.SALS_STTS_CD as string | number | undefined)),
      );
    }

    if (config.inputMode === "factory") {
      output = output.filter((row) =>
        matchFactoryEmployeeRange(selectedEmployeeRange, row.allEmplyCo as string | number | undefined),
      );

      if (factoryDateFrom || factoryDateTo) {
        output = output.filter((row) =>
          matchFactoryRegDateRangeSafe(
            row.frstFctryRegistDe as string | number | undefined,
            factoryDateFrom,
            factoryDateTo,
          ),
        );
      }
    }

    return output;
  }, [
    activeSalesStatuses,
    config.inputMode,
    config.statMode,
    factoryDateFrom,
    factoryDateTo,
    rows,
    selectedEmployeeRange,
    statFilter,
    supportsSalesStatusFilter,
  ]);

  const columns = useMemo(() => {
    const rowKeys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).filter(
      (key) => !HIDDEN_META_KEYS.has(key),
    );

    const preferred = (product.workbench?.columns ?? [])
      .map((column) => column.key)
      .filter((key) => rowKeys.includes(key));

    return preferred.length > 0 ? preferred : rowKeys;
  }, [product.workbench?.columns, rows]);

  const groupedDownloadLabel = getGroupedDownloadLabel(config.statMode);
  const hasGroupedDownload = groupedDownloadLabel.length > 0 && statBuckets.length > 1;
  const hasFilteredDownload = filteredRows.length > 0 && filteredRows.length !== rows.length;
  const visibleRows = filteredRows.slice(0, visibleCount);

  useEffect(() => {
    if (!config.forceDefaultDates) return;

    setParams((prev) => ({
      ...prev,
      "cond[LCPMT_YMD::GTE]":
        prev["cond[LCPMT_YMD::GTE]"] ||
        getDefaultFromDate(config.permitDateDefaultFrom, config.permitDateDefaultDaysFrom),
      "cond[LCPMT_YMD::LT]":
        prev["cond[LCPMT_YMD::LT]"] || getDefaultToDate(config.permitDateDefaultTo),
      ...(config.forceBaseDateToYesterday ? { "cond[BASE_DATE::EQ]": dateBeforeDays(1) } : {}),
    }));
  }, [
    config.forceBaseDateToYesterday,
    config.forceDefaultDates,
    config.permitDateDefaultDaysFrom,
    config.permitDateDefaultFrom,
    config.permitDateDefaultTo,
  ]);

  useEffect(() => {
    if (config.inputMode !== "homestay") return;
    setParams((prev) => ({
      ...prev,
      "cond[OPN_ATMY_GRP_CD::EQ]": selectedRegions.length > 0 ? selectedRegions.join(",") : "",
    }));
  }, [config.inputMode, selectedRegions]);

  useEffect(() => {
    if (config.inputMode !== "factory") return;

    const key = config.factoryRegionParamKey ?? "irsttNm";
    setParams((prev) => ({
      ...prev,
      [key]: selectedFactoryIndustrialEstates[0] ?? "",
    }));
  }, [config.factoryRegionParamKey, config.inputMode, selectedFactoryIndustrialEstates]);

  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [filteredRows.length]);

  useEffect(() => {
    setStatFilter(ALL_FILTER);
  }, [product.slug]);

  useEffect(() => {
    const target = loadMoreRef.current;
    const root = tableScrollRef.current;
    if (!target || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;

        setVisibleCount((prev) =>
          prev >= filteredRows.length ? prev : Math.min(prev + CHUNK_SIZE, filteredRows.length),
        );
      },
      {
        root,
        rootMargin: "120px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredRows.length]);

  const startProgressRange = (from: number, to: number) => {
    if (timerRef.current) clearInterval(timerRef.current);

    setProgress((prev) => Math.max(prev, from));

    timerRef.current = setInterval(() => {
      setProgress((prev) =>
        prev >= to ? prev : Math.min(to, prev + Math.max(1, Math.ceil((to - from) / 18))),
      );
    }, 220);
  };

  const stopProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    window.setTimeout(() => setProgress(0), 400);
  };

  const requestCollect = async (requestParams: Record<string, string>) => {
    const rawServiceKey = String(requestParams.serviceKey ?? "").trim();

    const resolvedParams: Record<string, string> = {
      ...requestParams,
      serviceKey: rawServiceKey ? resolvePreviewServiceKey(rawServiceKey) : "",
    };

    const response = await fetch("/api/public-data/collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: product.apiRuntime?.endpoint,
        params: resolvedParams,
        serviceKeyEnvVar: product.apiCredential?.envVarName,
        serviceKeyQueryKey: product.apiCredential?.queryKey,
        forcedQuery: product.apiRuntime?.forcedQuery,
        historyEndpoint: product.apiRuntime?.historyEndpoint,
        historySwitchParamKey: product.apiRuntime?.historySwitchParamKey,
      }),
    });

    return {
      response,
      data: await parseJsonResponse<CollectResponse>(response),
    };
  };

  const onRun = async () => {
    setHasQueried(true);

    if (!(product.apiRuntime?.endpoint ?? "")) {
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${WORKBENCH_TEXT.endpointMissing}`);
      return;
    }

    if (config.inputMode === "homestay" && selectedRegions.length === 0) {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${WORKBENCH_TEXT.regionRequired}`);
      return;
    }

    if (config.inputMode === "factory" && !selectedFactoryRegion) {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: 시도를 선택해 주세요.`);
      return;
    }

    if (config.inputMode === "factory" && selectedFactoryIndustrialEstates.length === 0) {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: 선택한 시도에 연결된 산업단지가 없습니다.`);
      return;
    }

    const requestParams: Record<string, string> = { ...params };

    if (config.inputMode === "homestay") {
      requestParams["cond[LCPMT_YMD::GTE]"] ||= getDefaultFromDate(
        config.permitDateDefaultFrom,
        config.permitDateDefaultDaysFrom,
      );
      requestParams["cond[LCPMT_YMD::LT]"] ||= getDefaultToDate(config.permitDateDefaultTo);

      if (
        requestParams["cond[LCPMT_YMD::GTE]"] &&
        requestParams["cond[LCPMT_YMD::LT]"] &&
        requestParams["cond[LCPMT_YMD::GTE]"] > requestParams["cond[LCPMT_YMD::LT]"]
      ) {
        setRows([]);
        setIsError(true);
        setMessage(`${labels.errorLabel}: 시작일은 종료일보다 늦을 수 없습니다.`);
        return;
      }

      if (config.forceBaseDateToYesterday) {
        requestParams["cond[BASE_DATE::EQ]"] = dateBeforeDays(1);
      }

      delete requestParams["cond[BPLC_NM::LIKE]"];

      if (supportsSalesStatusFilter && activeSalesStatuses.length === 1) {
        requestParams["cond[SALS_STTS_CD::EQ]"] = activeSalesStatuses[0];
      } else {
        delete requestParams["cond[SALS_STTS_CD::EQ]"];
      }
    }

    if (config.inputMode === "factory") {
      if (factoryDateFrom && factoryDateTo && factoryDateFrom > factoryDateTo) {
        setRows([]);
        setIsError(true);
        setMessage(`${labels.errorLabel}: 시작일은 종료일보다 늦을 수 없습니다.`);
        return;
      }

      requestParams.pageNo ||= "1";
      requestParams.numOfRows ||= "200";
      requestParams.type ||= "json";
      delete requestParams.adres;
      delete requestParams[config.factoryRegionParamKey ?? "irsttNm"];
    }

    setIsLoading(true);
    setIsError(false);
    setMessage("");
    setProgressTitle(WORKBENCH_TEXT.progressPreparing);
    setProgressDetail(WORKBENCH_TEXT.progressDefaultDetail);

    try {
      if (config.inputMode === "homestay" && selectedRegions.length > 0) {
        const mergedRows: Array<Record<string, string | number>> = [];
        let firstError = "";
        let infoMessage = "";
        let previewLimited = false;

        for (let index = 0; index < selectedRegions.length; index += 1) {
          const regionCode = selectedRegions[index];
          const regionName = getProgressRegionName(regionOptions, regionCode);
          const rangeStart = Math.max(3, Math.round((index / selectedRegions.length) * 96));
          const rangeEnd = Math.min(
            96,
            Math.max(rangeStart + 4, Math.round(((index + 1) / selectedRegions.length) * 96) - 1),
          );

          setProgressTitle(`${regionName} 조회 중`);
          setProgressDetail(
            `지역 ${index + 1}/${selectedRegions.length} 요청 진행 중 · 완료 ${index}/${selectedRegions.length}`,
          );
          startProgressRange(rangeStart, rangeEnd);

          const { response, data } = await requestCollect({
            ...requestParams,
            "cond[OPN_ATMY_GRP_CD::EQ]": regionCode,
          });

          if (!response.ok || !data.ok) {
            if (!firstError) firstError = data.message ?? WORKBENCH_TEXT.queryFailed;
          } else {
            if (data.message) infoMessage = data.message;
            if (data.previewLimited) previewLimited = true;
            mergedRows.push(...(data.rows ?? []));
          }

          if (timerRef.current) clearInterval(timerRef.current);
          setProgress(Math.min(96, Math.round(((index + 1) / selectedRegions.length) * 96)));
          setProgressDetail(
            `지역 ${index + 1}/${selectedRegions.length} 요청 완료 · 완료 ${index + 1}/${selectedRegions.length}`,
          );

          if (previewLimited && mergeCollectRows(mergedRows).length >= 5) break;
        }

        const nextRows = mergeCollectRows(mergedRows).slice(0, previewLimited ? 5 : undefined);

        if (nextRows.length === 0) {
          setRows([]);
          setIsError(false);
          setMessage(buildEmptyResultMessage(infoMessage, firstError));
          return;
        }

        setRows(nextRows);
        setIsError(false);
        setMessage(
          infoMessage ||
            `${labels.successLabel}: ${WORKBENCH_TEXT.totalPrefix} ${nextRows.length}${WORKBENCH_TEXT.countSuffix}`,
        );
      } else if (config.inputMode === "factory") {
        const uniqueRowMap = new Map<string, Record<string, string | number>>();
        let firstError = "";
        let infoMessage = "";
        let previewLimited = false;
        let completed = 0;
        const total = selectedFactoryIndustrialEstates.length;

        for (let start = 0; start < total; start += FACTORY_FETCH_CONCURRENCY) {
          const batch = selectedFactoryIndustrialEstates.slice(start, start + FACTORY_FETCH_CONCURRENCY);
          const rangeStart = Math.max(3, Math.round((start / total) * 96));
          const rangeEnd = Math.min(
            96,
            Math.max(rangeStart + 3, Math.round(((start + batch.length) / total) * 96) - 1),
          );

          setProgressTitle(`${selectedFactoryRegion} 조회 중`);
          setProgressDetail(
            `${selectedFactoryRegion} 산업단지 ${start + 1}-${Math.min(start + batch.length, total)}/${total} 요청 중`,
          );
          startProgressRange(rangeStart, rangeEnd);

          const results = await Promise.all(
            batch.map(async (estateName) => {
              const result = await requestCollect({
                ...requestParams,
                [config.factoryRegionParamKey ?? "irsttNm"]: estateName,
              });

              return {
                estateName,
                ...result,
              };
            }),
          );

          for (const result of results) {
            completed += 1;

            if (!result.response.ok || !result.data.ok) {
              if (!firstError) {
                firstError = result.data.message ?? `${result.estateName}: ${WORKBENCH_TEXT.queryFailed}`;
              }
            } else {
              if (result.data.message) infoMessage = result.data.message;
              if (result.data.previewLimited) previewLimited = true;
              appendUniqueCollectRows(uniqueRowMap, result.data.rows ?? []);
            }

            if (timerRef.current) clearInterval(timerRef.current);
            setProgress(Math.min(96, Math.round((completed / total) * 96)));
            setProgressDetail(`${selectedFactoryRegion} 산업단지 ${completed}/${total} 완료`);
          }

          if (previewLimited && uniqueRowMap.size >= 5) {
            break;
          }
        }

        const nextRows = Array.from(uniqueRowMap.values()).slice(0, previewLimited ? 5 : undefined);

        if (nextRows.length === 0) {
          setRows([]);
          setIsError(false);
          setMessage(buildEmptyResultMessage(infoMessage, firstError));
          return;
        }

        setRows(nextRows);
        setIsError(false);
        setMessage(
          infoMessage ||
            `${labels.successLabel}: ${WORKBENCH_TEXT.totalPrefix} ${nextRows.length}${WORKBENCH_TEXT.countSuffix}`,
        );
      } else {
        setProgressTitle(WORKBENCH_TEXT.progressWaiting);
        setProgressDetail(WORKBENCH_TEXT.progressSingleRequestDetail);
        startProgressRange(3, 96);

        const { response, data } = await requestCollect(requestParams);

        if (!response.ok || !data.ok) {
          setRows([]);
          setIsError(true);
          setMessage(`${labels.errorLabel}: ${data.message ?? WORKBENCH_TEXT.queryFailed}`);
          return;
        }

        const nextRows = data.rows ?? [];
        setRows(nextRows);
        setIsError(false);

        if (nextRows.length === 0) {
          setMessage(data.message ?? "조회는 정상적으로 완료되었습니다. 다만 현재 검색 조건에 맞는 데이터가 없습니다.");
        } else {
          setMessage(buildMessage(data, nextRows.length, labels.successLabel));
        }
      }
    } catch (error) {
      setRows([]);
      setIsError(true);
      setMessage(
        `${labels.errorLabel}: ${error instanceof Error ? error.message : WORKBENCH_TEXT.networkFailed}`,
      );
    } finally {
      stopProgress();
      setIsLoading(false);
    }
  };

  const onReset = () => {
    const empty: Record<string, string> = {};

    for (const field of product.inputFields) {
      empty[field.key] = "";
    }

    if (config.forceDefaultDates) {
      empty["cond[LCPMT_YMD::GTE]"] = getDefaultFromDate(
        config.permitDateDefaultFrom,
        config.permitDateDefaultDaysFrom,
      );
      empty["cond[LCPMT_YMD::LT]"] = getDefaultToDate(config.permitDateDefaultTo);

      if (config.forceBaseDateToYesterday) {
        empty["cond[BASE_DATE::EQ]"] = dateBeforeDays(1);
      }
    }

    setParams(empty);

    if (config.inputMode === "homestay") {
      setSelectedRegions([]);
    }

    if (config.inputMode === "factory") {
      setSelectedFactoryRegion("");
      setSelectedEmployeeRange("all");
      setFactoryDateFrom(FACTORY_DEFAULT_FROM);
      setFactoryDateTo(FACTORY_DEFAULT_TO);
    }

    setSelectedSalesStatuses([]);
    setRows([]);
    setMessage("");
    setIsError(false);
    setProgress(0);
    setProgressTitle("");
    setProgressDetail("");
    setVisibleCount(CHUNK_SIZE);
    setHasQueried(false);
    setStatFilter(ALL_FILTER);
  };

  const onDownloadAll = () =>
    downloadFlatExcel({
      productSlug: product.slug,
      suffix: "all",
      rows,
      columns,
      labelMap,
      sheetName: "전체",
    });

  const onDownloadGrouped = () =>
    downloadGroupedExcel({
      productSlug: product.slug,
      suffix: config.statMode.startsWith("country:") ? "by-country" : "by-region",
      allRows: rows,
      groupedRows: statBuckets,
      columns,
      labelMap,
    });

  const onDownloadFiltered = () =>
    downloadFlatExcel({
      productSlug: product.slug,
      suffix: "filtered",
      rows: filteredRows,
      columns,
      labelMap,
      sheetName: "필터 결과",
    });

  const toggleSalesStatus = (code: string) =>
    setSelectedSalesStatuses((prev) => {
      const current = normalizeSelectedSalesStatuses(prev);
      return current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code].sort();
    });

  return (
    <>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <article
          className={`rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)] transition-[width,transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            hasQueried ? "w-full lg:w-1/2" : "w-full lg:w-full"
          }`}
        >
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">
            {WORKBENCH_TEXT.inputTitle}
          </p>

          <div
            className={`mt-3 grid gap-3 pr-1 ${
              config.inputMode === "homestay" ? "max-h-[60vh] overflow-y-auto" : "max-h-none overflow-visible"
            }`}
          >
            {config.inputMode === "homestay" ? (
              <>
                <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <strong className="text-base font-bold text-slate-900">
                    {WORKBENCH_TEXT.serviceKeyLabel}
                  </strong>
                  <input
                    className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                    placeholder="vip / gold / master 또는 실제 인증키 입력"
                    value={params.serviceKey ?? ""}
                    onChange={(event) =>
                      setParams((prev) => ({ ...prev, serviceKey: event.target.value }))
                    }
                  />
                  <p className="text-xs leading-6 text-slate-500">
                    {WORKBENCH_TEXT.serviceKeyHelp}
                  </p>
                </label>

                <div className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-base font-bold text-slate-900">
                      {WORKBENCH_TEXT.regionSelectLabel}
                    </strong>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedRegions((prev) =>
                          prev.length === regionOptions.length ? [] : regionOptions.map((item) => item.code),
                        )
                      }
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                    >
                      {selectedRegions.length === regionOptions.length
                        ? WORKBENCH_TEXT.clearAllLabel
                        : WORKBENCH_TEXT.selectAllLabel}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {regionOptions.map((item) => {
                      const active = selectedRegions.includes(item.code);

                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() =>
                            setSelectedRegions((prev) =>
                              prev.includes(item.code)
                                ? prev.filter((value) => value !== item.code)
                                : [...prev, item.code],
                            )
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                            active
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-blue-200 bg-white text-blue-700"
                          }`}
                        >
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {supportsSalesStatusFilter ? (
                  <div className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-base font-bold text-slate-900">
                        {WORKBENCH_TEXT.salesStatusLabel}
                      </strong>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedSalesStatuses((prev) =>
                            prev.length === ALL_SALES_STATUS_CODES.length ? [] : [...ALL_SALES_STATUS_CODES],
                          )
                        }
                        className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                      >
                        {selectedSalesStatuses.length === ALL_SALES_STATUS_CODES.length
                          ? WORKBENCH_TEXT.clearAllLabel
                          : WORKBENCH_TEXT.selectAllLabel}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {SALES_STATUS_OPTIONS.map((item) => {
                        const active = activeSalesStatuses.includes(item.code);

                        return (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => toggleSalesStatus(item.code)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                              active
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-blue-200 bg-white text-blue-700"
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-xs leading-6 text-slate-500">
                      {WORKBENCH_TEXT.salesStatusHint}
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <strong className="text-base font-bold text-slate-900">
                      {WORKBENCH_TEXT.permitFromLabel}
                    </strong>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                      value={toInputDate(params["cond[LCPMT_YMD::GTE]"] ?? "")}
                      onChange={(event) =>
                        setParams((prev) => ({
                          ...prev,
                          "cond[LCPMT_YMD::GTE]": toApiDate(event.target.value),
                        }))
                      }
                    />
                  </label>

                  <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <strong className="text-base font-bold text-slate-900">
                      {WORKBENCH_TEXT.permitToLabel}
                    </strong>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                      value={toInputDate(params["cond[LCPMT_YMD::LT]"] ?? "")}
                      onChange={(event) =>
                        setParams((prev) => ({
                          ...prev,
                          "cond[LCPMT_YMD::LT]": toApiDate(event.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
              </>
            ) : config.inputMode === "factory" ? (
              <>
                <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <strong className="text-base font-bold text-slate-900">
                    {WORKBENCH_TEXT.serviceKeyLabel}
                  </strong>
                  <input
                    className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                    placeholder="vip / gold / master 또는 실제 인증키 입력"
                    value={params.serviceKey ?? ""}
                    onChange={(event) =>
                      setParams((prev) => ({ ...prev, serviceKey: event.target.value }))
                    }
                  />
                  <p className="text-xs leading-6 text-slate-500">
                    {WORKBENCH_TEXT.serviceKeyHelp}
                  </p>
                </label>

                <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <strong className="text-base font-bold text-slate-900">시도</strong>
                  <select
                    className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                    value={selectedFactoryRegion}
                    onChange={(event) => {
                      setSelectedFactoryRegion(event.target.value);
                    }}
                  >
                    <option value="">시도를 선택해 주세요</option>
                    {factoryRegionOptions.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <strong className="text-base font-bold text-slate-900">고용인원</strong>
                  <select
                    className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                    value={selectedEmployeeRange}
                    onChange={(event) => setSelectedEmployeeRange(event.target.value)}
                  >
                    {FACTORY_EMPLOYEE_OPTIONS.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-base font-bold text-slate-900">공장 등록일자 시작</strong>
                      <button
                        type="button"
                        onClick={() => {
                          setFactoryDateFrom("");
                          setFactoryDateTo("");
                        }}
                        className="inline-flex min-h-[32px] items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        초기화
                      </button>
                    </div>

                    <input
                      type="date"
                      className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                      value={toInputDate(factoryDateFrom)}
                      onChange={(event) => setFactoryDateFrom(toApiDate(event.target.value))}
                    />
                  </label>

                  <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <strong className="text-base font-bold text-slate-900">공장 등록일자 종료</strong>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                      value={toInputDate(factoryDateTo)}
                      onChange={(event) => setFactoryDateTo(toApiDate(event.target.value))}
                    />
                  </label>
                </div>
              </>
            ) : (
              visibleInputFields.map((field) => (
                <label
                  key={field.key}
                  className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700"
                >
                  <strong className="text-base font-bold text-slate-900">{field.label}</strong>
                  <input
                    className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                    placeholder={
                      field.key === "serviceKey" ? "vip / gold / master 또는 실제 인증키 입력" : undefined
                    }
                    value={params[field.key] ?? ""}
                    onChange={(event) =>
                      setParams((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                  />
                  {field.key === "serviceKey" ? (
                    <p className="text-xs leading-6 text-slate-500">
                      {WORKBENCH_TEXT.serviceKeyHelp}
                    </p>
                  ) : null}
                </label>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRun}
              disabled={isLoading}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white"
            >
              {isLoading ? `${labels.runLabel} ${progress}%` : labels.runLabel}
            </button>

            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700"
            >
              {labels.resetLabel}
            </button>
          </div>
        </article>

        <article
          aria-hidden={!hasQueried}
          className={`overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-[0_16px_36px_rgba(44,86,150,0.12)] transition-[width,opacity,padding,margin,border-color,box-shadow,background-color,height,max-height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            hasQueried
              ? "h-auto w-full p-4 opacity-100 lg:w-1/2"
              : "pointer-events-none h-0 max-h-0 w-0 border-0 bg-transparent p-0 opacity-0 shadow-none lg:w-0"
          }`}
        >
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">
            {labels.resultBadge}
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-800">{labels.resultTitle}</h2>

          <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
            {hasGroupedDownload ? (
              <button
                type="button"
                onClick={onDownloadGrouped}
                disabled={rows.length === 0}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {groupedDownloadLabel}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onDownloadAll}
              disabled={rows.length === 0}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {WORKBENCH_TEXT.allExcelLabel}
            </button>

            {hasFilteredDownload ? (
              <button
                type="button"
                onClick={onDownloadFiltered}
                disabled={filteredRows.length === 0}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {WORKBENCH_TEXT.filteredExcelLabel}
              </button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-blue-700">
                <span>{progressTitle || WORKBENCH_TEXT.progressPreparing}</span>
                <span>{progress}%</span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="mt-3 text-xs leading-6 text-slate-600">
                {progressDetail || WORKBENCH_TEXT.progressDefaultDetail}
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                {WORKBENCH_TEXT.progressKeepPage}
              </p>
            </div>
          ) : null}
        </article>
      </div>

      {message ? (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      ) : null}

      {config.statMode !== "none" && hasQueried && rows.length > 0 ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-blue-700">
              {config.statMode.startsWith("country")
                ? WORKBENCH_TEXT.statCountry
                : WORKBENCH_TEXT.statRegion}
            </p>
            <p className="text-xs font-semibold text-slate-600">
              {WORKBENCH_TEXT.totalPrefix} {rows.length}
              {WORKBENCH_TEXT.countSuffix} | {WORKBENCH_TEXT.currentPrefix} {filteredRows.length}
              {WORKBENCH_TEXT.countSuffix}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {statItems.map((item) => {
              const active = statFilter === item.name;

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setStatFilter(item.name)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-blue-200 bg-white text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {item.name} ({item.count})
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasQueried && filteredRows.length > 0 ? (
        <article className="mt-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)]">
          <div
            ref={tableScrollRef}
            className="max-h-[60vh] overflow-auto rounded-xl border border-blue-200 bg-white"
          >
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-blue-50 text-slate-700">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="whitespace-nowrap px-3 py-2 font-bold">
                      {getColumnLabel(column, labelMap)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className="border-t border-blue-100 text-slate-600">
                    {columns.map((column) => (
                      <td key={`${rowIndex}-${column}`} className="whitespace-nowrap px-3 py-2 align-top">
                        {formatCellValue(column, row[column] as string | number | undefined, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div ref={loadMoreRef} className="h-8" />
          </div>
        </article>
      ) : null}
    </>
  );
}
