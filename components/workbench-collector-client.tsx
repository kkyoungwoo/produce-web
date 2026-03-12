"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import {
  CHUNK_SIZE,
  HIDDEN_META_KEYS,
  REGION_OPTIONS,
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
} from "@/components/workbench/helpers";
import { getWorkbenchProductConfig } from "@/components/workbench/product-config";
import { getSampleRows } from "@/components/workbench/samples";
import { WORKBENCH_TEXT } from "@/components/workbench/text";
import type {
  CollectResponse,
  WorkbenchProps,
  WorkbenchStatMode,
} from "@/components/workbench/types";

function getStatName(statMode: WorkbenchStatMode, row: Record<string, string | number>) {
  if (statMode === "country:worknational") {
    return normalizeCountry(row.worknational as string | number | undefined);
  }
  if (statMode === "country:nationalName") {
    return normalizeCountry(row.nationalName as string | number | undefined);
  }
  if (statMode === "region:homestay") {
    return homestayRegionName(row.OPN_ATMY_GRP_CD as string | number | undefined);
  }
  if (statMode === "region:addr") {
    return eduRegionName(row.addr as string | number | undefined);
  }
  return "";
}

export default function WorkbenchCollectorClient({ product, labels }: WorkbenchProps) {
  const config = useMemo(() => getWorkbenchProductConfig(product.slug), [product.slug]);

  const defaultInputs = useMemo(() => {
    const out: Record<string, string> = {};
    for (const field of product.inputFields) out[field.key] = field.example;
    return out;
  }, [product]);

  const [params, setParams] = useState<Record<string, string>>(defaultInputs);
  const [rows, setRows] = useState<Array<Record<string, string | number>>>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const [progress, setProgress] = useState(0);
  const [hasQueried, setHasQueried] = useState(false);
  const [statFilter, setStatFilter] = useState("전체");

  const [selectedRegions, setSelectedRegions] = useState<string[]>(
    config.inputMode === "homestay" ? REGION_OPTIONS.map((v) => v.code) : [],
  );

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const downloadSeqRef = useRef(0);

  const labelMap = useMemo(() => {
    const out: Record<string, string> = {};
    for (const col of product.workbench?.columns ?? []) out[col.key] = col.label;
    return out;
  }, [product]);

  const visibleInputFields = useMemo(() => {
    const hidden = new Set(config.hideInputKeys ?? []);
    return product.inputFields.filter((field) => !hidden.has(field.key));
  }, [config.hideInputKeys, product.inputFields]);

  const statItems = useMemo(() => {
    if (config.statMode === "none") return [];
    const counts = new Map<string, number>();
    for (const row of rows) {
      const name = getStatName(config.statMode, row);
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [
      { name: "전체", count: rows.length },
      ...Array.from(counts.entries()).map(([name, count]) => ({ name, count })),
    ];
  }, [config.statMode, rows]);

  const filteredRows = useMemo(() => {
    if (config.statMode === "none" || statFilter === "전체") return rows;
    return rows.filter((row) => getStatName(config.statMode, row) === statFilter);
  }, [config.statMode, rows, statFilter]);

  const columns = useMemo(
    () =>
      Array.from(new Set(filteredRows.flatMap((row) => Object.keys(row)))).filter(
        (key) => !HIDDEN_META_KEYS.has(key),
      ),
    [filteredRows],
  );
  const visibleRows = filteredRows.slice(0, visibleCount);

  useEffect(() => {
    if (!config.forceDefaultDates) return;
    setParams((prev) => ({
      ...prev,
      "cond[LCPMT_YMD::GTE]": prev["cond[LCPMT_YMD::GTE]"] || dateBeforeDays(3),
      "cond[LCPMT_YMD::LT]": prev["cond[LCPMT_YMD::LT]"] || dateBeforeDays(0),
      ...(config.forceBaseDateToYesterday ? { "cond[BASE_DATE::EQ]": dateBeforeDays(1) } : {}),
    }));
  }, [config.forceBaseDateToYesterday, config.forceDefaultDates]);

  useEffect(() => {
    if (config.inputMode !== "homestay") return;
    setParams((prev) => ({
      ...prev,
      "cond[OPN_ATMY_GRP_CD::EQ]":
        selectedRegions.length === REGION_OPTIONS.length ? "" : selectedRegions.join(","),
    }));
  }, [config.inputMode, selectedRegions]);

  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [filteredRows.length]);

  useEffect(() => {
    setStatFilter("전체");
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
      { root, rootMargin: "120px 0px", threshold: 0.1 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredRows.length]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(3);
    timerRef.current = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? 95 : prev + 3));
    }, 250);
  };

  const stopProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 300);
  };

  const onRun = async () => {
    setHasQueried(true);

    const endpoint = product.apiRuntime?.endpoint ?? "";
    if (!endpoint) {
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${WORKBENCH_TEXT.endpointMissing}`);
      return;
    }

    const requestParams = { ...params };
    if (config.inputMode === "homestay") {
      requestParams["cond[LCPMT_YMD::GTE]"] ||= dateBeforeDays(3);
      requestParams["cond[LCPMT_YMD::LT]"] ||= dateBeforeDays(0);
      requestParams["cond[BASE_DATE::EQ]"] = dateBeforeDays(1);
      delete requestParams["cond[BPLC_NM::LIKE]"];
      delete requestParams["cond[SALS_STTS_CD::EQ]"];
    }

    setIsLoading(true);
    setIsError(false);
    setMessage("");
    startProgress();

    try {
      const response = await fetch("/api/public-data/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          params: requestParams,
          serviceKeyEnvVar: product.apiCredential?.envVarName,
          serviceKeyQueryKey: product.apiCredential?.queryKey,
          forcedQuery: product.apiRuntime?.forcedQuery,
          historyEndpoint: product.apiRuntime?.historyEndpoint,
          historySwitchParamKey: product.apiRuntime?.historySwitchParamKey,
        }),
      });

      const data = (await response.json()) as CollectResponse;

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
    } catch {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${WORKBENCH_TEXT.networkFailed}`);
    } finally {
      stopProgress();
      setIsLoading(false);
    }
  };

  const onReset = () => {
    const empty: Record<string, string> = {};
    for (const field of product.inputFields) empty[field.key] = "";
    if (config.forceDefaultDates) {
      empty["cond[LCPMT_YMD::GTE]"] = dateBeforeDays(3);
      empty["cond[LCPMT_YMD::LT]"] = dateBeforeDays(0);
      if (config.forceBaseDateToYesterday) empty["cond[BASE_DATE::EQ]"] = dateBeforeDays(1);
    }

    setParams(empty);
    setRows([]);
    setMessage("");
    setIsError(false);
    setProgress(0);
    setVisibleCount(CHUNK_SIZE);
    setHasQueried(false);
    setStatFilter("전체");
  };

  const onDownload = () => {
    if (filteredRows.length === 0) return;

    const excelRows = filteredRows.map((row, idx) => {
      const out: Record<string, string | number> = { "순번": idx + 1 };
      for (const [key, value] of Object.entries(row)) {
        if (HIDDEN_META_KEYS.has(key)) continue;
        out[getColumnLabel(key, labelMap)] = formatCellValue(key, value as string | number | undefined, row);
      }
      return out;
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "results");

    const now = new Date();
    const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}${String(now.getMilliseconds()).padStart(3, "0")}`;
    downloadSeqRef.current += 1;
    XLSX.writeFile(
      wb,
      `${datePart}_${product.slug}_${timePart}_${downloadSeqRef.current}.xlsx`,
    );
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
                    onChange={(e) => setParams((prev) => ({ ...prev, serviceKey: e.target.value }))}
                  />
                </label>

                <div className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <strong className="text-base font-bold text-slate-900">{WORKBENCH_TEXT.regionSelectLabel}</strong>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedRegions((prev) =>
                          prev.length === REGION_OPTIONS.length ? [] : REGION_OPTIONS.map((item) => item.code),
                        )
                      }
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                    >
                      {selectedRegions.length === REGION_OPTIONS.length
                        ? WORKBENCH_TEXT.clearAllRegion
                        : WORKBENCH_TEXT.selectAllRegion}
                    </button>

                    {REGION_OPTIONS.map((item) => {
                      const active = selectedRegions.includes(item.code);
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() =>
                            setSelectedRegions((prev) =>
                              prev.includes(item.code)
                                ? prev.filter((v) => v !== item.code)
                                : [...prev, item.code],
                            )
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"}`}
                        >
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <strong className="text-base font-bold text-slate-900">{WORKBENCH_TEXT.permitFromLabel}</strong>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                      value={toInputDate(params["cond[LCPMT_YMD::GTE]"] ?? "")}
                      onChange={(e) => setParams((prev) => ({ ...prev, "cond[LCPMT_YMD::GTE]": toApiDate(e.target.value) }))}
                    />
                  </label>

                  <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <strong className="text-base font-bold text-slate-900">{WORKBENCH_TEXT.permitToLabel}</strong>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                      value={toInputDate(params["cond[LCPMT_YMD::LT]"] ?? "")}
                      onChange={(e) => setParams((prev) => ({ ...prev, "cond[LCPMT_YMD::LT]": toApiDate(e.target.value) }))}
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                {visibleInputFields.map((field) => (
                  <label key={field.key} className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <strong className="text-base font-bold text-slate-900">{field.label}</strong>
                    <input
                      className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                      value={params[field.key] ?? ""}
                      onChange={(e) => setParams((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    />
                  </label>
                ))}
              </>
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
          <button type="button" onClick={onDownload} disabled={filteredRows.length === 0} className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {labels.excelLabel}
          </button>
        </article>
      </div>

      {message ? <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p> : null}

      {config.statMode !== "none" && hasQueried && rows.length > 0 ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-blue-700">{config.statMode.startsWith("country") ? WORKBENCH_TEXT.statCountry : WORKBENCH_TEXT.statRegion}</p>
            <p className="text-xs font-semibold text-slate-600">{WORKBENCH_TEXT.totalPrefix} {rows.length}{WORKBENCH_TEXT.countSuffix} · {WORKBENCH_TEXT.currentPrefix} {filteredRows.length}{WORKBENCH_TEXT.countSuffix}</p>
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