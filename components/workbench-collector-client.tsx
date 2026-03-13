"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import WorkbenchArchhubClient from "@/components/workbench-archhub-client";
import { downloadFlatExcel, downloadGroupedExcel } from "@/components/workbench/excel";
import {
  CHUNK_SIZE,
  HIDDEN_META_KEYS,
  REGION_OPTIONS,
  REGION_OPTIONS_15154910,
  REGION_OPTIONS_15155139,
  SALES_STATUS_OPTIONS,
} from "@/components/workbench/constants";
import {
  dateBeforeDays,
  eduRegionName,
  formatCellValue,
  getColumnLabel,
  homestayRegionName,
  isInvalidServiceKeyError,
  normalizeCountry,
  toApiDate,
  toInputDate,
  toText,
} from "@/components/workbench/helpers";
import { getWorkbenchProductConfig } from "@/components/workbench/product-config";
import { getSampleRows } from "@/components/workbench/samples";
import { WORKBENCH_TEXT } from "@/components/workbench/text";
import type {
  CollectResponse,
  WorkbenchProps,
  WorkbenchStatMode,
} from "@/components/workbench/types";

const ALL_FILTER = WORKBENCH_TEXT.allFilterLabel;
const SALES_STATUS_PRODUCT_SLUGS = new Set(["api-15155139", "api-15154910"]);
const ALL_SALES_STATUS_CODES = SALES_STATUS_OPTIONS.map((item) => item.code);

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
  if (statMode.startsWith("region:")) return "지역별 엑셀 다운로드";
  if (statMode.startsWith("country:")) return "국가별 엑셀 다운로드";
  return "";
}

function mergeCollectRows(rows: Array<Record<string, string | number>>) {
  return Array.from(
    new Map(
      rows.map((row) => {
        const keyParts = [
          String(row.MNG_NO ?? ""),
          String(row.BPLC_NM ?? ""),
          String(row.LCPMT_YMD ?? ""),
          String(row.ROAD_NM_ADDR ?? row.LOTNO_ADDR ?? ""),
        ];
        const key = keyParts.some(Boolean) ? keyParts.join("|") : JSON.stringify(row);
        return [key, row] as const;
      }),
    ).values(),
  );
}

function normalizeSelectedSalesStatuses(selected: string[]) {
  return Array.from(new Set(selected));
}

export default function WorkbenchCollectorClient({ product, labels }: WorkbenchProps) {
  if (product.slug === "api-15136560") {
    return <WorkbenchArchhubClient product={product} labels={labels} />;
  }

  const config = useMemo(() => getWorkbenchProductConfig(product.slug), [product.slug]);
  const supportsSalesStatusFilter = SALES_STATUS_PRODUCT_SLUGS.has(product.slug);

  const defaultInputs = useMemo(() => {
    const output: Record<string, string> = {};
    for (const field of product.inputFields) output[field.key] = field.example;
    return output;
  }, [product]);

  const regionOptions = useMemo(() => {
    if (product.slug === "api-15155139") return REGION_OPTIONS_15155139;
    if (product.slug === "api-15154910") return REGION_OPTIONS_15154910;
    return REGION_OPTIONS;
  }, [product.slug]);

  const [params, setParams] = useState<Record<string, string>>(defaultInputs);
  const [rows, setRows] = useState<Array<Record<string, string | number>>>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const [progress, setProgress] = useState(0);
  const [hasQueried, setHasQueried] = useState(false);
  const [statFilter, setStatFilter] = useState<string>(ALL_FILTER);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedSalesStatuses, setSelectedSalesStatuses] = useState<string[]>([]);

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const labelMap = useMemo(() => {
    const output: Record<string, string> = {};
    for (const column of product.workbench?.columns ?? []) output[column.key] = column.label;
    return output;
  }, [product.workbench?.columns]);

  const visibleInputFields = useMemo(() => {
    const hidden = new Set(config.hideInputKeys ?? []);
    return product.inputFields.filter((field) => !hidden.has(field.key));
  }, [config.hideInputKeys, product.inputFields]);

  const statBuckets = useMemo(() => {
    if (config.statMode === "none") return [] as Array<{ name: string; rows: Array<Record<string, string | number>> }>;

    const groups = new Map<string, Array<Record<string, string | number>>>();
    for (const row of rows) {
      const name = getStatName(config.statMode, row);
      if (!name) continue;
      groups.set(name, [...(groups.get(name) ?? []), row]);
    }

    return Array.from(groups.entries()).map(([name, bucketRows]) => ({ name, rows: bucketRows }));
  }, [config.statMode, rows]);

  const statItems = useMemo(() => {
    if (config.statMode === "none") return [];
    return [
      { name: ALL_FILTER, count: rows.length },
      ...statBuckets.map((bucket) => ({ name: bucket.name, count: bucket.rows.length })),
    ];
  }, [config.statMode, rows.length, statBuckets]);

  const activeSalesStatuses = normalizeSelectedSalesStatuses(selectedSalesStatuses);

  const filteredRows = useMemo(() => {
    let output = rows;

    if (config.statMode !== "none" && statFilter !== ALL_FILTER) {
      output = output.filter((row) => getStatName(config.statMode, row) === statFilter);
    }

    if (supportsSalesStatusFilter && activeSalesStatuses.length > 0 && activeSalesStatuses.length < ALL_SALES_STATUS_CODES.length) {
      output = output.filter((row) => activeSalesStatuses.includes(toText(row.SALS_STTS_CD as string | number | undefined)));
    }

    return output;
  }, [activeSalesStatuses, config.statMode, rows, statFilter, supportsSalesStatusFilter]);

  const columns = useMemo(() => {
    const rowKeys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).filter((key) => !HIDDEN_META_KEYS.has(key));
    const preferred = (product.workbench?.columns ?? []).map((column) => column.key).filter((key) => rowKeys.includes(key));
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
      "cond[LCPMT_YMD::GTE]": prev["cond[LCPMT_YMD::GTE]"] || getDefaultFromDate(config.permitDateDefaultFrom, config.permitDateDefaultDaysFrom),
      "cond[LCPMT_YMD::LT]": prev["cond[LCPMT_YMD::LT]"] || getDefaultToDate(config.permitDateDefaultTo),
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
        setVisibleCount((prev) => (prev >= filteredRows.length ? prev : Math.min(prev + CHUNK_SIZE, filteredRows.length)));
      },
      { root, rootMargin: "120px 0px", threshold: 0.1 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredRows.length]);

  const startProgressRange = (from: number, to: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress((prev) => Math.max(prev, from));
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= to) return prev;
        const step = Math.max(1, Math.ceil((to - from) / 18));
        return Math.min(to, prev + step);
      });
    }, 250);
  };

  const stopProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 300);
  };

  const requestCollect = async (requestParams: Record<string, string>) => {
    const response = await fetch("/api/public-data/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: product.apiRuntime?.endpoint,
        params: requestParams,
        serviceKeyEnvVar: product.apiCredential?.envVarName,
        serviceKeyQueryKey: product.apiCredential?.queryKey,
        forcedQuery: product.apiRuntime?.forcedQuery,
        historyEndpoint: product.apiRuntime?.historyEndpoint,
        historySwitchParamKey: product.apiRuntime?.historySwitchParamKey,
      }),
    });

    return {
      response,
      data: (await response.json()) as CollectResponse,
    };
  };

  const onRun = async () => {
    setHasQueried(true);

    const endpoint = product.apiRuntime?.endpoint ?? "";
    if (!endpoint) {
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${WORKBENCH_TEXT.endpointMissing}`);
      return;
    }

    if (config.inputMode === "homestay" && selectedRegions.length === 0) {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: 지역을 1개 이상 선택해 주세요.`);
      return;
    }

    const requestParams = { ...params };
    if (config.inputMode === "homestay") {
      requestParams["cond[LCPMT_YMD::GTE]"] ||= getDefaultFromDate(config.permitDateDefaultFrom, config.permitDateDefaultDaysFrom);
      requestParams["cond[LCPMT_YMD::LT]"] ||= getDefaultToDate(config.permitDateDefaultTo);
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

    setIsLoading(true);
    setIsError(false);
    setMessage("");

    try {
      if (config.inputMode === "homestay" && selectedRegions.length > 0) {
        const mergedRows: Array<Record<string, string | number>> = [];
        let firstError = "";

        for (let index = 0; index < selectedRegions.length; index += 1) {
          const regionCode = selectedRegions[index];
          const rangeStart = Math.max(3, Math.round((index / selectedRegions.length) * 96));
          const rangeEnd = Math.min(96, Math.max(rangeStart + 4, Math.round(((index + 1) / selectedRegions.length) * 96) - 1));
          startProgressRange(rangeStart, rangeEnd);

          const batchParams = {
            ...requestParams,
            "cond[OPN_ATMY_GRP_CD::EQ]": regionCode,
          };

          const { response, data } = await requestCollect(batchParams);

          if (!response.ok || !data.ok) {
            if (isInvalidServiceKeyError(data, response.status)) {
              setRows(getSampleRows(product));
              setIsError(true);
              setMessage(`${labels.errorLabel}: ${WORKBENCH_TEXT.sampleError}`);
              return;
            }
            if (!firstError) firstError = data.message ?? WORKBENCH_TEXT.queryFailed;
          } else {
            mergedRows.push(...(data.rows ?? []));
          }

          if (timerRef.current) clearInterval(timerRef.current);
          setProgress(Math.min(96, Math.round(((index + 1) / selectedRegions.length) * 96)));
        }

        const nextRows = mergeCollectRows(mergedRows);
        if (nextRows.length === 0) {
          setRows([]);
          setIsError(true);
          setMessage(`${labels.errorLabel}: ${firstError || WORKBENCH_TEXT.queryFailed}`);
          return;
        }

        setRows(nextRows);
        setIsError(false);
        setMessage(
          `${labels.successLabel}: ${WORKBENCH_TEXT.totalPrefix} ${nextRows.length}${WORKBENCH_TEXT.countSuffix}`
          + `${firstError ? " / 일부 지역 조회는 제외되었습니다." : ""}`,
        );
      } else {
        startProgressRange(3, 96);
        const { response, data } = await requestCollect(requestParams);

        if (!response.ok || !data.ok) {
          if (isInvalidServiceKeyError(data, response.status)) {
            setRows(getSampleRows(product));
            setIsError(true);
            setMessage(`${labels.errorLabel}: ${WORKBENCH_TEXT.sampleError}`);
            return;
          }
          setRows([]);
          setIsError(true);
          setMessage(`${labels.errorLabel}: ${data.message ?? WORKBENCH_TEXT.queryFailed}`);
          return;
        }

        const nextRows = data.rows ?? [];
        setRows(nextRows);
        setIsError(false);
        setMessage(`${labels.successLabel}: ${WORKBENCH_TEXT.totalPrefix} ${data.totalCount ?? nextRows.length}${WORKBENCH_TEXT.countSuffix}`);
      }
    } catch {
      setRows(getSampleRows(product));
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${WORKBENCH_TEXT.sampleError}`);
    } finally {
      stopProgress();
      setIsLoading(false);
    }
  };

  const onReset = () => {
    const empty: Record<string, string> = {};
    for (const field of product.inputFields) empty[field.key] = "";
    if (config.forceDefaultDates) {
      empty["cond[LCPMT_YMD::GTE]"] = getDefaultFromDate(config.permitDateDefaultFrom, config.permitDateDefaultDaysFrom);
      empty["cond[LCPMT_YMD::LT]"] = getDefaultToDate(config.permitDateDefaultTo);
      if (config.forceBaseDateToYesterday) empty["cond[BASE_DATE::EQ]"] = dateBeforeDays(1);
    }

    setParams(empty);
    if (config.inputMode === "homestay") {
      setSelectedRegions([]);
    }
    setSelectedSalesStatuses([]);
    setRows([]);
    setMessage("");
    setIsError(false);
    setProgress(0);
    setVisibleCount(CHUNK_SIZE);
    setHasQueried(false);
    setStatFilter(ALL_FILTER);
  };

  const onDownloadAll = () => {
    downloadFlatExcel({
      productSlug: product.slug,
      suffix: "all",
      rows,
      columns,
      labelMap,
      sheetName: "전체",
    });
  };

  const onDownloadGrouped = () => {
    downloadGroupedExcel({
      productSlug: product.slug,
      suffix: config.statMode.startsWith("country:") ? "by-country" : "by-region",
      allRows: rows,
      groupedRows: statBuckets,
      columns,
      labelMap,
    });
  };

  const onDownloadFiltered = () => {
    downloadFlatExcel({
      productSlug: product.slug,
      suffix: "filtered",
      rows: filteredRows,
      columns,
      labelMap,
      sheetName: "현재필터",
    });
  };

  const toggleSalesStatus = (code: string) => {
    setSelectedSalesStatuses((prev) => {
      const current = normalizeSelectedSalesStatuses(prev);
      if (current.includes(code)) {
        return current.filter((item) => item !== code);
      }
      return [...current, code].sort();
    });
  };

  return (
    <>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <article className={`rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)] transition-[width,transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${hasQueried ? "w-full lg:w-1/2" : "w-full lg:w-full"}`}> 
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{WORKBENCH_TEXT.inputTitle}</p>

          <div className={`mt-3 grid gap-3 pr-1 ${config.inputMode === "homestay" ? "max-h-[60vh] overflow-y-auto" : "max-h-none overflow-visible"}`}>
            {config.inputMode === "homestay" ? (
              <>
                <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <strong className="text-base font-bold text-slate-900">{WORKBENCH_TEXT.serviceKeyLabel}</strong>
                  <input
                    className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                    value={params.serviceKey ?? ""}
                    onChange={(event) => setParams((prev) => ({ ...prev, serviceKey: event.target.value }))}
                  />
                </label>

                <div className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <strong className="text-base font-bold text-slate-900">{WORKBENCH_TEXT.regionSelectLabel}</strong>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRegions((prev) => (prev.length === regionOptions.length ? [] : regionOptions.map((item) => item.code)))}
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                    >
                      {selectedRegions.length === regionOptions.length ? WORKBENCH_TEXT.clearAllRegion : WORKBENCH_TEXT.selectAllRegion}
                    </button>

                    {regionOptions.map((item) => {
                      const active = selectedRegions.includes(item.code);
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => setSelectedRegions((prev) => (prev.includes(item.code) ? prev.filter((value) => value !== item.code) : [...prev, item.code]))}
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"}`}
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
                      <strong className="text-base font-bold text-slate-900">영업상태 선택</strong>
                      <button
                        type="button"
                        onClick={() => setSelectedSalesStatuses((prev) => (prev.length === ALL_SALES_STATUS_CODES.length ? [] : [...ALL_SALES_STATUS_CODES]))}
                        className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                      >
                        {selectedSalesStatuses.length === ALL_SALES_STATUS_CODES.length ? WORKBENCH_TEXT.clearAllRegion : WORKBENCH_TEXT.selectAllRegion}
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
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"}`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs leading-6 text-slate-500">
                      영업상태 1개만 선택하면 API 요청에도 반영되고, 여러 개를 선택하면 조회 후 결과 테이블에서 필터링할 수 있습니다.
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <strong className="text-base font-bold text-slate-900">{WORKBENCH_TEXT.permitFromLabel}</strong>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                      value={toInputDate(params["cond[LCPMT_YMD::GTE]"] ?? "")}
                      onChange={(event) => setParams((prev) => ({ ...prev, "cond[LCPMT_YMD::GTE]": toApiDate(event.target.value) }))}
                    />
                  </label>

                  <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <strong className="text-base font-bold text-slate-900">{WORKBENCH_TEXT.permitToLabel}</strong>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                      value={toInputDate(params["cond[LCPMT_YMD::LT]"] ?? "")}
                      onChange={(event) => setParams((prev) => ({ ...prev, "cond[LCPMT_YMD::LT]": toApiDate(event.target.value) }))}
                    />
                  </label>
                </div>
              </>
            ) : (
              visibleInputFields.map((field) => (
                <label key={field.key} className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <strong className="text-base font-bold text-slate-900">{field.label}</strong>
                  <input
                    className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                    value={params[field.key] ?? ""}
                    onChange={(event) => setParams((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  />
                </label>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onRun} disabled={isLoading} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white">
              {isLoading ? `${labels.runLabel} ${progress}%` : labels.runLabel}
            </button>
            <button type="button" onClick={onReset} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
              {labels.resetLabel}
            </button>
          </div>
        </article>

        <article aria-hidden={!hasQueried} className={`overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-[0_16px_36px_rgba(44,86,150,0.12)] transition-[width,opacity,padding,margin,border-color,box-shadow,background-color,height,max-height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${hasQueried ? "h-auto w-full p-4 opacity-100 lg:w-1/2" : "pointer-events-none h-0 max-h-0 w-0 border-0 bg-transparent p-0 opacity-0 shadow-none lg:w-0"}`}>
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{labels.resultBadge}</p>
          <h2 className="mt-1 text-xl font-bold text-slate-800">{labels.resultTitle}</h2>
          <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
            {hasGroupedDownload ? (
              <button type="button" onClick={onDownloadGrouped} disabled={rows.length === 0} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {groupedDownloadLabel}
              </button>
            ) : null}
            <button type="button" onClick={onDownloadAll} disabled={rows.length === 0} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              전체 엑셀 다운로드
            </button>
            {hasFilteredDownload ? (
              <button type="button" onClick={onDownloadFiltered} disabled={filteredRows.length === 0} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                현재 필터 엑셀 다운로드
              </button>
            ) : null}
          </div>
        </article>
      </div>

      {message ? <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p> : null}

      {config.statMode !== "none" && hasQueried && rows.length > 0 ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-blue-700">{config.statMode.startsWith("country") ? WORKBENCH_TEXT.statCountry : WORKBENCH_TEXT.statRegion}</p>
            <p className="text-xs font-semibold text-slate-600">{WORKBENCH_TEXT.totalPrefix} {rows.length}{WORKBENCH_TEXT.countSuffix} | {WORKBENCH_TEXT.currentPrefix} {filteredRows.length}{WORKBENCH_TEXT.countSuffix}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {statItems.map((item) => {
              const active = statFilter === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setStatFilter(item.name)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700 hover:bg-blue-100"}`}
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
          <div ref={tableScrollRef} className="max-h-[60vh] overflow-auto rounded-xl border border-blue-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-blue-50 text-slate-700">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="whitespace-nowrap px-3 py-2 font-bold">{getColumnLabel(column, labelMap)}</th>
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
