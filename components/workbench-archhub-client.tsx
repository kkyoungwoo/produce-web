"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CHUNK_SIZE } from "@/components/workbench/constants";
import { getSampleRows } from "@/components/workbench/samples";
import { downloadFlatExcel, downloadGroupedExcel } from "@/components/workbench/excel";
import {
  dateBeforeDays,
  formatCellValue,
  getColumnLabel,
  isInvalidServiceKeyError,
  toApiDate,
  toInputDate,
  toText,
} from "@/components/workbench/helpers";
import { WORKBENCH_TEXT } from "@/components/workbench/text";
import type { CollectResponse, WorkbenchProps } from "@/components/workbench/types";

type RegionOption = {
  code: string;
  name: string;
  fullName?: string;
  dongCount?: number;
};

type LegalDongOption = {
  code: string;
  fullCode: string;
  name: string;
  label: string;
  sigunguCode: string;
  sigunguName: string;
  sigunguFullName: string;
  sidoCode: string;
  sidoName: string;
};

type RegionOptionsResponse = {
  ok: boolean;
  message?: string;
  options?: RegionOption[] | LegalDongOption[];
};

type ArchhubCollectResponse = CollectResponse & {
  endpointFamily?: "hs" | "arch";
  searchedTargetCount?: number;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  usedDateFallback?: boolean;
  fallbackDays?: number;
};

type ChunkRequest = {
  sigunguCode: string;
  sigunguFullName: string;
  legalDongCodes: string[];
  sigunguOrder: number;
  chunkOrder: number;
};

const ALL_FILTER = WORKBENCH_TEXT.allFilterLabel;
const REGION_FILTER_TITLE = "지역별 보기";
const ELEVATOR_OPTIONS = [
  { key: "passenger", label: "승용승강기만 있음" },
  { key: "emergency", label: "비상용 승강기만 있음" },
] as const;
const ALL_ELEVATOR_KEYS = ELEVATOR_OPTIONS.map((item) => item.key);
const DEFAULT_START_DAYS = 7;
const DEFAULT_END_DAYS = 1;
const LEGAL_DONG_CHUNK_SIZE = 12;

function hasPositive(value: string | number | undefined) {
  const num = Number.parseFloat(toText(value));
  return Number.isFinite(num) && num > 0;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeElevatorSelection(selected: string[]) {
  return Array.from(new Set(selected));
}

function matchesElevatorSelection(row: Record<string, string | number>, selected: string[]) {
  const active = normalizeElevatorSelection(selected);
  const hasPassenger = hasPositive(row.passengerElevators as string | number | undefined);
  const hasEmergency = hasPositive(row.emergencyElevators as string | number | undefined);

  if (active.length === 0) {
    return true;
  }

  if (active.length === ALL_ELEVATOR_KEYS.length) {
    return hasPassenger || hasEmergency;
  }

  if (active.includes("passenger")) {
    return hasPassenger && !hasEmergency;
  }

  if (active.includes("emergency")) {
    return !hasPassenger && hasEmergency;
  }

  return true;
}

async function fetchRegionOptions(
  body: { level: "sido" | "sigungu" | "bjdong"; sidoCode?: string; sigunguCodes?: string[] },
  signal?: AbortSignal,
) {
  const response = await fetch("/api/public-data/archhub-regions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
    signal,
  });
  const data = (await response.json()) as RegionOptionsResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.message ?? "지역 정보를 불러오지 못했습니다.");
  }

  return data.options ?? [];
}

function createChunkRequests(options: LegalDongOption[], selectedSigunguCodes: string[]) {
  const grouped = new Map<string, { sigunguFullName: string; codes: string[] }>();

  for (const option of options) {
    const current = grouped.get(option.sigunguCode) ?? { sigunguFullName: option.sigunguFullName, codes: [] };
    current.codes.push(option.fullCode);
    grouped.set(option.sigunguCode, current);
  }

  const requests: ChunkRequest[] = [];
  selectedSigunguCodes.forEach((sigunguCode, sigunguOrder) => {
    const group = grouped.get(sigunguCode);
    if (!group) return;
    chunkArray(group.codes, LEGAL_DONG_CHUNK_SIZE).forEach((legalDongCodes, chunkIndex) => {
      requests.push({
        sigunguCode,
        sigunguFullName: group.sigunguFullName,
        legalDongCodes,
        sigunguOrder,
        chunkOrder: chunkIndex,
      });
    });
  });

  return requests;
}

export default function WorkbenchArchhubClient({ product, labels }: WorkbenchProps) {
  const [serviceKey, setServiceKey] = useState(product.inputFields.find((field) => field.key === "serviceKey")?.example ?? "");
  const [startDate, setStartDate] = useState(dateBeforeDays(DEFAULT_START_DAYS));
  const [endDate, setEndDate] = useState(dateBeforeDays(DEFAULT_END_DAYS));
  const [sidoOptions, setSidoOptions] = useState<RegionOption[]>([]);
  const [sigunguOptions, setSigunguOptions] = useState<RegionOption[]>([]);
  const [selectedSidoCode, setSelectedSidoCode] = useState("");
  const [selectedSigunguCodes, setSelectedSigunguCodes] = useState<string[]>([]);
  const [selectedElevatorModes, setSelectedElevatorModes] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, string | number>>>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressTitle, setProgressTitle] = useState("");
  const [progressDetail, setProgressDetail] = useState("");
  const [hasQueried, setHasQueried] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>(ALL_FILTER);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const options = await fetchRegionOptions({ level: "sido" });
        if (!cancelled) setSidoOptions(options as RegionOption[]);
      } catch (error) {
        if (cancelled) return;
        setMessage(`${labels.errorLabel}: ${error instanceof Error ? error.message : "지역 정보를 불러오지 못했습니다."}`);
        setIsError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [labels.errorLabel]);

  useEffect(() => {
    if (!selectedSidoCode) {
      setSigunguOptions([]);
      setSelectedSigunguCodes([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const options = await fetchRegionOptions({ level: "sigungu", sidoCode: selectedSidoCode });
        if (cancelled) return;
        setSigunguOptions(options as RegionOption[]);
        setSelectedSigunguCodes([]);
      } catch (error) {
        if (cancelled) return;
        setMessage(`${labels.errorLabel}: ${error instanceof Error ? error.message : "법정동 목록을 불러오지 못했습니다."}`);
        setIsError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSidoCode, labels.errorLabel]);

  const labelMap = useMemo(() => {
    const output: Record<string, string> = {};
    for (const column of product.workbench?.columns ?? []) output[column.key] = column.label;
    return output;
  }, [product.workbench?.columns]);

  const columns = useMemo(() => {
    const rowKeys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const preferred = (product.workbench?.columns ?? []).map((column) => column.key).filter((key) => rowKeys.includes(key));
    return preferred.length > 0 ? preferred : rowKeys;
  }, [product.workbench?.columns, rows]);

  const regionBuckets = useMemo(() => {
    const groups = new Map<string, Array<Record<string, string | number>>>();
    for (const row of rows) {
      const name = toText(row.agency as string | number | undefined) || "지역 미분류";
      groups.set(name, [...(groups.get(name) ?? []), row]);
    }
    return Array.from(groups.entries()).map(([name, bucketRows]) => ({ name, rows: bucketRows }));
  }, [rows]);

  const regionStats = useMemo(() => {
    return [{ name: ALL_FILTER, count: rows.length }, ...regionBuckets.map((item) => ({ name: item.name, count: item.rows.length }))];
  }, [regionBuckets, rows.length]);

  const activeElevatorModes = normalizeElevatorSelection(selectedElevatorModes);

  const filteredRows = useMemo(() => {
    let output = rows;

    if (regionFilter !== ALL_FILTER) {
      output = output.filter((row) => toText(row.agency as string | number | undefined) === regionFilter);
    }

    output = output.filter((row) => matchesElevatorSelection(row, activeElevatorModes));
    return output;
  }, [activeElevatorModes, regionFilter, rows]);

  const visibleRows = filteredRows.slice(0, visibleCount);
  const hasRegionDownload = regionBuckets.length > 1;
  const hasFilteredDownload = filteredRows.length > 0 && filteredRows.length !== rows.length;

  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [filteredRows.length]);

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
        const step = Math.max(1, Math.ceil((to - from) / 12));
        return Math.min(to, prev + step);
      });
    }, 220);
  };

  const stopProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 400);
  };

  const mergeRows = (targets: Array<Record<string, string | number>>) => {
    const map = new Map<string, Record<string, string | number>>();
    for (const row of targets) {
      const key = [
        toText(row.permitNo as string | number | undefined),
        toText(row.siteLocation as string | number | undefined),
        toText(row.dongName as string | number | undefined),
        toText(row.buildingName as string | number | undefined),
      ].join("|");
      if (!map.has(key)) map.set(key, row);
    }
    return Array.from(map.values());
  };

  const onRun = async () => {
    setHasQueried(true);

    if (!serviceKey.trim()) {
      setRows(getSampleRows(product));
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${WORKBENCH_TEXT.sampleError}`);
      setRegionFilter(ALL_FILTER);
      setVisibleCount(CHUNK_SIZE);
      return;
    }

    if (!selectedSidoCode) {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: 시도를 선택해주세요.`);
      return;
    }

    if (selectedSigunguCodes.length === 0) {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: 시군구를 1개 이상 선택해주세요.`);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setIsError(false);
    setMessage("");
    setRows([]);
    setRegionFilter(ALL_FILTER);
    setVisibleCount(CHUNK_SIZE);

    try {
      const legalDongOptions = await fetchRegionOptions(
        { level: "bjdong", sigunguCodes: selectedSigunguCodes },
        controller.signal,
      ) as LegalDongOption[];

      if (legalDongOptions.length === 0) {
        setIsError(true);
        setMessage(`${labels.errorLabel}: 법정동 목록을 불러오지 못했습니다.`);
        return;
      }

      const chunkRequests = createChunkRequests(legalDongOptions, selectedSigunguCodes);
      const totalTargetCount = legalDongOptions.length;
      const totalChunkCount = chunkRequests.length;
      const totalSigunguCount = selectedSigunguCodes.length;

      const mergedRows: Array<Record<string, string | number>> = [];
      let completedTargetCount = 0;
      let firstError = "";
      let usedFallback = false;
      let endpointFamily: "hs" | "arch" | "" = "";

      setProgressTitle("조회 준비 중입니다.");
      setProgressDetail(`시군구 ${totalSigunguCount}개 · 법정동 ${totalTargetCount}개 · 요청 ${totalChunkCount}묶음을 순차 조회합니다.`);
      setProgress(2);

      for (let index = 0; index < chunkRequests.length; index += 1) {
        const chunk = chunkRequests[index];
        const from = Math.max(2, Math.round((completedTargetCount / totalTargetCount) * 98));
        const to = Math.min(98, Math.max(from + 1, Math.round(((completedTargetCount + chunk.legalDongCodes.length) / totalTargetCount) * 98)));

        setProgressTitle(`${chunk.sigunguFullName} 조회 중`);
        setProgressDetail(`시군구 ${chunk.sigunguOrder + 1}/${totalSigunguCount} · 요청 묶음 ${index + 1}/${totalChunkCount} · 완료 ${completedTargetCount}/${totalTargetCount}`);
        startProgressRange(from, to);

        const response = await fetch("/api/public-data/archhub-collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceKey: serviceKey.trim(),
            startDate,
            endDate,
            sigunguCodes: [chunk.sigunguCode],
            legalDongCodes: chunk.legalDongCodes,
          }),
          signal: controller.signal,
        });

        const data = (await response.json()) as ArchhubCollectResponse;

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
          usedFallback ||= Boolean(data.usedDateFallback);
          endpointFamily = data.endpointFamily ?? endpointFamily;
        }

        completedTargetCount += chunk.legalDongCodes.length;
        if (timerRef.current) clearInterval(timerRef.current);
        setProgress(Math.min(98, Math.round((completedTargetCount / totalTargetCount) * 98)));
        setProgressDetail(`시군구 ${chunk.sigunguOrder + 1}/${totalSigunguCount} · 요청 묶음 ${index + 1}/${totalChunkCount} · 완료 ${completedTargetCount}/${totalTargetCount}`);
      }

      const uniqueRows = mergeRows(mergedRows);
      if (uniqueRows.length === 0) {
        setRows([]);
        setIsError(true);
        setMessage(`${labels.errorLabel}: ${firstError || WORKBENCH_TEXT.queryFailed}`);
        return;
      }

      setRows(uniqueRows);
      setIsError(false);
      setMessage(
        `${labels.successLabel}: ${WORKBENCH_TEXT.totalPrefix} ${uniqueRows.length}${WORKBENCH_TEXT.countSuffix}`
        + `${usedFallback ? " (기간 자동 확장 적용)" : ""}`
        + `${firstError ? " / 일부 요청은 제외되었습니다." : ""}`
        + `${endpointFamily ? ` / ${endpointFamily === "hs" ? "주택 API" : "건축 API"}` : ""}`,
      );
      setProgressTitle("조회가 완료되었습니다.");
      setProgressDetail(`시군구 ${totalSigunguCount}개 · 법정동 ${completedTargetCount}/${totalTargetCount}개 조회 완료`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessage(`${labels.errorLabel}: 조회가 완료되었습니다.`);
      } else {
        setRows([]);
        setIsError(true);
        setMessage(`${labels.errorLabel}: ${error instanceof Error ? error.message : "건축HUB 조회 중 오류가 발생했습니다."}`);
      }
    } finally {
      stopProgress();
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const onReset = () => {
    abortRef.current?.abort();
    setServiceKey("");
    setStartDate(dateBeforeDays(DEFAULT_START_DAYS));
    setEndDate(dateBeforeDays(DEFAULT_END_DAYS));
    setSelectedSidoCode("");
    setSelectedSigunguCodes([]);
    setSelectedElevatorModes([]);
    setRows([]);
    setMessage("");
    setIsError(false);
    setProgress(0);
    setProgressTitle("");
    setProgressDetail("");
    setHasQueried(false);
    setRegionFilter(ALL_FILTER);
    setVisibleCount(CHUNK_SIZE);
    setIsLoading(false);
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
      suffix: "by-region",
      allRows: rows,
      groupedRows: regionBuckets,
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
      sheetName: "필터결과",
    });
  };

  const toggleElevatorMode = (key: string) => {
    setSelectedElevatorModes((prev) => (
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    ));
  };

  return (
    <>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <article className={`rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)] transition-[width,transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${hasQueried ? "w-full lg:w-1/2" : "w-full lg:w-full"}`}>
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{WORKBENCH_TEXT.inputTitle}</p>

          <div className="mt-3 grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
            <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
              <strong className="text-base font-bold text-slate-900">{WORKBENCH_TEXT.serviceKeyLabel}</strong>
              <input
                className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                value={serviceKey}
                onChange={(event) => setServiceKey(event.target.value)}
              />
            </label>

            <div className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
              <strong className="text-base font-bold text-slate-900">시도 선택</strong>
              <div className="flex flex-wrap gap-2">
                {sidoOptions.map((item) => {
                  const active = selectedSidoCode === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        setSelectedSidoCode(item.code);
                        setRows([]);
                        setMessage("");
                        setIsError(false);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"}`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-base font-bold text-slate-900">시군구 선택</strong>
                {sigunguOptions.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedSigunguCodes((prev) => (prev.length === sigunguOptions.length ? [] : sigunguOptions.map((item) => item.code)))}
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                  >
                    {selectedSigunguCodes.length === sigunguOptions.length ? WORKBENCH_TEXT.clearAllRegion : WORKBENCH_TEXT.selectAllRegion}
                  </button>
                ) : null}
              </div>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
                {sigunguOptions.length === 0 ? <p className="text-xs text-slate-500">시도를 선택하면 시군구 목록이 표시됩니다.</p> : null}
                {sigunguOptions.map((item) => {
                  const active = selectedSigunguCodes.includes(item.code);
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setSelectedSigunguCodes((prev) => (prev.includes(item.code) ? prev.filter((value) => value !== item.code) : [...prev, item.code]))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"}`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-base font-bold text-slate-900">승강기 조건 선택</strong>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedElevatorModes((prev) => (prev.length === ALL_ELEVATOR_KEYS.length ? [] : [...ALL_ELEVATOR_KEYS]))}
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                  >
                    {activeElevatorModes.length === ALL_ELEVATOR_KEYS.length ? WORKBENCH_TEXT.clearAllRegion : WORKBENCH_TEXT.selectAllRegion}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ELEVATOR_OPTIONS.map((item) => {
                  const active = activeElevatorModes.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleElevatorMode(item.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-6 text-slate-500">
                승강기 조건은 선택 사항입니다. 전체해제를 하면 승강기 조건 없이 전체 데이터를 조회합니다.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                <strong className="text-base font-bold text-slate-900">{WORKBENCH_TEXT.permitFromLabel}</strong>
                <input
                  type="date"
                  className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                  value={toInputDate(startDate)}
                  onChange={(event) => setStartDate(toApiDate(event.target.value))}
                />
              </label>
              <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                <strong className="text-base font-bold text-slate-900">{WORKBENCH_TEXT.permitToLabel}</strong>
                <input
                  type="date"
                  className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                  value={toInputDate(endDate)}
                  onChange={(event) => setEndDate(toApiDate(event.target.value))}
                />
              </label>
            </div>
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

          {isLoading ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-blue-700">
                <span>{progressTitle || "조회 준비 중"}</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-600">{progressDetail || "법정동 단위로 순차 조회하고 있습니다."}</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">조회 중에는 이 페이지를 유지해 주세요. 시군구와 법정동 수에 따라 완료 시간이 달라질 수 있습니다.</p>
            </div>
          ) : null}
        </article>

        <article aria-hidden={!hasQueried} className={`overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-[0_16px_36px_rgba(44,86,150,0.12)] transition-[width,opacity,padding,margin,border-color,box-shadow,background-color,height,max-height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${hasQueried ? "h-auto w-full p-4 opacity-100 lg:w-1/2" : "pointer-events-none h-0 max-h-0 w-0 border-0 bg-transparent p-0 opacity-0 shadow-none lg:w-0"}`}>
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{labels.resultBadge}</p>
          <h2 className="mt-1 text-xl font-bold text-slate-800">{labels.resultTitle}</h2>
          <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
            {hasRegionDownload ? (
              <button
                type="button"
                onClick={onDownloadGrouped}
                disabled={rows.length === 0}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                지역별 엑셀 다운로드
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDownloadAll}
              disabled={rows.length === 0}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              전체 엑셀 다운로드
            </button>
            {hasFilteredDownload ? (
              <button
                type="button"
                onClick={onDownloadFiltered}
                disabled={filteredRows.length === 0}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                현재 필터 엑셀 다운로드
              </button>
            ) : null}
          </div>
        </article>
      </div>

      {message ? <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p> : null}

      {rows.length > 0 ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-blue-700">{REGION_FILTER_TITLE}</p>
            <p className="text-xs font-semibold text-slate-600">{WORKBENCH_TEXT.totalPrefix} {rows.length}{WORKBENCH_TEXT.countSuffix} | {WORKBENCH_TEXT.currentPrefix} {filteredRows.length}{WORKBENCH_TEXT.countSuffix}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {regionStats.map((item) => {
              const active = regionFilter === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setRegionFilter(item.name)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700 hover:bg-blue-100"}`}
                >
                  {item.name} ({item.count})
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {filteredRows.length > 0 ? (
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
