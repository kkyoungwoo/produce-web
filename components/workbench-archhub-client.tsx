"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CHUNK_SIZE } from "@/components/workbench/constants";
import { downloadFlatExcel, downloadGroupedExcel } from "@/components/workbench/excel";
import {
  dateBeforeDays,
  formatCellValue,
  getColumnLabel,
  toApiDate,
  toInputDate,
  toText,
} from "@/components/workbench/helpers";
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

const UI = {
  inputTitle: "입력 설정",
  serviceKeyLabel: "인증키(serviceKey)",
  serviceKeyPlaceholder: "vip / beta / gold / master 또는 실제 인증키 입력",
  serviceKeyHelp:
    "발급한 키를 입력하면 전체 조회가 가능합니다. 키가 없거나 확인되지 않으면 실제 데이터 샘플 최대 5건만 조회됩니다.",
  sidoLabel: "시도 선택",
  sigunguLabel: "시군구 선택",
  sigunguHint: "시도를 선택하면 시군구 목록이 표시됩니다.",
  elevatorLabel: "승강기 조건 선택",
  elevatorHint: "승강기 조건은 선택 사항입니다. 전체 해제 시 조건 없이 전체 데이터를 조회합니다.",
  permitFromLabel: "인허가일자 시작",
  permitToLabel: "인허가일자 종료",
  constructionFromLabel: "착공일자 시작",
  constructionToLabel: "착공일자 종료",
  constructionHint:
    "착공일 필터는 선택 사항입니다. 입력하지 않으면 조회된 전체 데이터를 그대로 표에 표시합니다.",
  resultBadge: "데이터 다운로드",
  resultTitle: "입력 결과 테이블",
  regionFilterTitle: "지역별 보기",
  allFilter: "전체",
  totalPrefix: "총",
  currentPrefix: "현재",
  countSuffix: "건",
  groupedExcelLabel: "지역별 엑셀 다운로드",
  allExcelLabel: "전체 엑셀 다운로드",
  filteredExcelLabel: "현재 필터 엑셀 다운로드",
  regionLoadFailed: "지역 정보를 불러오지 못했습니다.",
  noLegalDong: "선택한 지역에 해당하는 법정동 코드가 없습니다.",
  sidoRequired: "시도를 선택해 주세요.",
  sigunguRequired: "시군구를 1개 이상 선택해 주세요.",
  dateRangeInvalid: "시작일은 종료일보다 늦을 수 없습니다.",
  constructionDateRangeInvalid: "착공일 시작일은 종료일보다 늦을 수 없습니다.",
  regionUnclassified: "지역 미분류",
  preparing: "조회 준비 중입니다.",
  completed: "조회가 완료되었습니다.",
  cancelled: "조회가 취소되었습니다.",
  keepPage:
    "조회 중에는 이 페이지를 유지해 주세요. 시군구와 법정동 수에 따라 완료 시간이 달라질 수 있습니다.",
  progressFallback: "요청 상태를 확인하는 중입니다.",
  queryFailed: "조회에 실패했습니다.",
  archhubError: "건축HUB 조회 중 오류가 발생했습니다.",
  partialWarning: "일부 요청은 제외되었습니다.",
  dateExpanded: "기간 자동 확장 적용",
  endpointHs: "주택 API",
  endpointArch: "건축 API",
  noData: "조회는 정상적으로 완료되었습니다. 다만 현재 검색 조건에 맞는 데이터가 없습니다.",
  filteredEmpty:
    "조회된 데이터는 있지만 현재 지역/승강기/착공일 필터 조건에 맞는 행이 없습니다. 필터를 조정하거나 초기화해 주세요.",
} as const;

const ELEVATOR_OPTIONS = [
  { key: "passenger", label: "승용승강기만 있음" },
  { key: "emergency", label: "비상용 승강기만 있음" },
] as const;

const ALL_ELEVATOR_KEYS = ELEVATOR_OPTIONS.map((item) => item.key);
const DEFAULT_START_DAYS = 7;
const DEFAULT_END_DAYS = 1;
const LEGAL_DONG_CHUNK_SIZE = 12;

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`JSON 응답이 아닙니다. 응답 앞부분: ${text.slice(0, 200)}`);
  }
}

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

  if (active.length === 0) return true;
  if (active.length === ALL_ELEVATOR_KEYS.length) return hasPassenger || hasEmergency;
  if (active.includes("passenger")) return hasPassenger && !hasEmergency;
  if (active.includes("emergency")) return !hasPassenger && hasEmergency;
  return true;
}

function normalizeDateDigits(value: string | number | undefined) {
  return toText(value).replace(/\D/g, "").slice(0, 8);
}

function matchesDateRange(value: string | number | undefined, from?: string, to?: string) {
  const current = normalizeDateDigits(value);
  const fromDigits = normalizeDateDigits(from);
  const toDigits = normalizeDateDigits(to);

  if (!fromDigits && !toDigits) return true;
  if (!current || current.length !== 8) return false;
  if (fromDigits && current < fromDigits) return false;
  if (toDigits && current > toDigits) return false;
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

  const data = await parseJsonResponse<RegionOptionsResponse>(response);

  if (!response.ok || !data.ok) {
    throw new Error(data.message ?? UI.regionLoadFailed);
  }

  return data.options ?? [];
}

function createChunkRequests(options: LegalDongOption[], selectedSigunguCodes: string[]) {
  const grouped = new Map<string, { sigunguFullName: string; codes: string[] }>();

  for (const option of options) {
    const current = grouped.get(option.sigunguCode) ?? {
      sigunguFullName: option.sigunguFullName,
      codes: [],
    };
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

function mergeRows(targets: Array<Record<string, string | number>>) {
  const map = new Map<string, Record<string, string | number>>();

  for (const row of targets) {
    const key = [
      String(toText(row.permitNo as string | number | undefined)),
      String(toText(row.siteLocation as string | number | undefined)),
      String(toText(row.dongName as string | number | undefined)),
      String(toText(row.buildingName as string | number | undefined)),
    ].join("|");

    if (!map.has(key)) map.set(key, row);
  }

  return Array.from(map.values());
}

export default function WorkbenchArchhubClient({ product, labels }: WorkbenchProps) {
  const [serviceKey, setServiceKey] = useState("");
  const [startDate, setStartDate] = useState(dateBeforeDays(DEFAULT_START_DAYS));
  const [endDate, setEndDate] = useState(dateBeforeDays(DEFAULT_END_DAYS));
  const [constructionStartDate, setConstructionStartDate] = useState("");
  const [constructionEndDate, setConstructionEndDate] = useState("");
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
  const [regionFilter, setRegionFilter] = useState<string>(UI.allFilter);
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
        setMessage(`${labels.errorLabel}: ${error instanceof Error ? error.message : UI.regionLoadFailed}`);
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
        setMessage(`${labels.errorLabel}: ${error instanceof Error ? error.message : UI.regionLoadFailed}`);
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
    const preferred = (product.workbench?.columns ?? [])
      .map((column) => column.key)
      .filter((key) => rowKeys.includes(key));
    return preferred.length > 0 ? preferred : rowKeys;
  }, [product.workbench?.columns, rows]);

  const regionBuckets = useMemo(() => {
    const groups = new Map<string, Array<Record<string, string | number>>>();

    for (const row of rows) {
      const name = toText(row.agency as string | number | undefined) || UI.regionUnclassified;
      groups.set(name, [...(groups.get(name) ?? []), row]);
    }

    return Array.from(groups.entries()).map(([name, bucketRows]) => ({ name, rows: bucketRows }));
  }, [rows]);

  const regionStats = useMemo(
    () => [
      { name: UI.allFilter, count: rows.length },
      ...regionBuckets.map((item) => ({ name: item.name, count: item.rows.length })),
    ],
    [regionBuckets, rows.length],
  );

  const activeElevatorModes = normalizeElevatorSelection(selectedElevatorModes);

  const filteredRows = useMemo(() => {
    let output = rows;

    if (regionFilter !== UI.allFilter) {
      output = output.filter((row) => toText(row.agency as string | number | undefined) === regionFilter);
    }

    output = output.filter((row) => matchesElevatorSelection(row, activeElevatorModes));

    if (constructionStartDate || constructionEndDate) {
      output = output.filter((row) =>
        matchesDateRange(
          row.constructionActualDate as string | number | undefined,
          constructionStartDate,
          constructionEndDate,
        ),
      );
    }

    return output;
  }, [activeElevatorModes, constructionEndDate, constructionStartDate, regionFilter, rows]);

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
        setVisibleCount((prev) =>
          prev >= filteredRows.length ? prev : Math.min(prev + CHUNK_SIZE, filteredRows.length),
        );
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

  const onRun = async () => {
    setHasQueried(true);

    if (!selectedSidoCode) {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${UI.sidoRequired}`);
      return;
    }

    if (selectedSigunguCodes.length === 0) {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${UI.sigunguRequired}`);
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${UI.dateRangeInvalid}`);
      return;
    }

    if (constructionStartDate && constructionEndDate && constructionStartDate > constructionEndDate) {
      setRows([]);
      setIsError(true);
      setMessage(`${labels.errorLabel}: ${UI.constructionDateRangeInvalid}`);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setIsError(false);
    setMessage("");
    setRows([]);
    setRegionFilter(UI.allFilter);
    setVisibleCount(CHUNK_SIZE);

    try {
      const legalDongOptions = (await fetchRegionOptions(
        { level: "bjdong", sigunguCodes: selectedSigunguCodes },
        controller.signal,
      )) as LegalDongOption[];

      if (legalDongOptions.length === 0) {
        setIsError(true);
        setMessage(`${labels.errorLabel}: ${UI.noLegalDong}`);
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
      let infoMessage = "";
      let previewLimited = false;

      setProgressTitle(UI.preparing);
      setProgressDetail(
        `시군구 ${totalSigunguCount}/${totalSigunguCount} · 요청 묶음 0/${totalChunkCount} · 완료 0/${totalTargetCount}`,
      );
      setProgress(2);

      for (let index = 0; index < chunkRequests.length; index += 1) {
        const chunk = chunkRequests[index];
        const from = Math.max(2, Math.round((completedTargetCount / totalTargetCount) * 98));
        const to = Math.min(
          98,
          Math.max(from + 1, Math.round(((completedTargetCount + chunk.legalDongCodes.length) / totalTargetCount) * 98)),
        );

        setProgressTitle(`${chunk.sigunguFullName} 조회 중`);
        setProgressDetail(
          `시군구 ${chunk.sigunguOrder + 1}/${totalSigunguCount} · 요청 묶음 ${index + 1}/${totalChunkCount} · 완료 ${completedTargetCount}/${totalTargetCount}`,
        );
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

        const data = await parseJsonResponse<ArchhubCollectResponse>(response);

        if (!response.ok || !data.ok) {
          if (!firstError) firstError = data.message ?? UI.queryFailed;
        } else {
          if (data.message) infoMessage = data.message;
          if (data.previewLimited) previewLimited = true;
          mergedRows.push(...(data.rows ?? []));
          usedFallback ||= Boolean(data.usedDateFallback);
          endpointFamily = data.endpointFamily ?? endpointFamily;
        }

        completedTargetCount += chunk.legalDongCodes.length;

        if (timerRef.current) clearInterval(timerRef.current);
        setProgress(Math.min(98, Math.round((completedTargetCount / totalTargetCount) * 98)));
        setProgressDetail(
          `시군구 ${chunk.sigunguOrder + 1}/${totalSigunguCount} · 요청 묶음 ${index + 1}/${totalChunkCount} · 완료 ${completedTargetCount}/${totalTargetCount}`,
        );

        if (previewLimited && mergeRows(mergedRows).length >= 5) {
          break;
        }
      }

      const uniqueRows = mergeRows(mergedRows).slice(0, previewLimited ? 5 : undefined);

      if (uniqueRows.length === 0) {
        setRows([]);
        setIsError(false);
        setMessage(infoMessage || UI.noData);
        return;
      }

      setRows(uniqueRows);
      setIsError(false);

      const constructionFilteredCount =
        constructionStartDate || constructionEndDate
          ? uniqueRows.filter((row) =>
              matchesDateRange(
                row.constructionActualDate as string | number | undefined,
                constructionStartDate,
                constructionEndDate,
              ),
            ).length
          : uniqueRows.length;

      const summaryParts = [
        infoMessage || `${labels.successLabel}: ${UI.totalPrefix} ${uniqueRows.length}${UI.countSuffix}`,
      ];

      if (constructionStartDate || constructionEndDate) {
        summaryParts.push(`착공일 필터 ${constructionFilteredCount}${UI.countSuffix}`);
      }

      if (usedFallback) summaryParts.push(UI.dateExpanded);
      if (firstError) summaryParts.push(UI.partialWarning);
      if (endpointFamily === "hs") summaryParts.push(UI.endpointHs);
      if (endpointFamily === "arch") summaryParts.push(UI.endpointArch);
      setMessage(summaryParts.join(" / "));

      setProgressTitle(UI.completed);
      setProgressDetail(
        `시군구 ${totalSigunguCount}/${totalSigunguCount} · 요청 묶음 ${Math.min(
          chunkRequests.length,
          totalChunkCount,
        )}/${totalChunkCount} · 완료 ${completedTargetCount}/${totalTargetCount}`,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessage(`${labels.errorLabel}: ${UI.cancelled}`);
      } else {
        setRows([]);
        setIsError(true);
        setMessage(`${labels.errorLabel}: ${error instanceof Error ? error.message : UI.archhubError}`);
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
    setConstructionStartDate("");
    setConstructionEndDate("");
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
    setRegionFilter(UI.allFilter);
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
    setSelectedElevatorModes((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  return (
    <>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <article
          className={`rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)] transition-[width,transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            hasQueried ? "w-full lg:w-1/2" : "w-full lg:w-full"
          }`}
        >
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{UI.inputTitle}</p>

          <div className="mt-3 grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
            <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
              <strong className="text-base font-bold text-slate-900">{UI.serviceKeyLabel}</strong>
              <input
                className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                value={serviceKey}
                placeholder={UI.serviceKeyPlaceholder}
                onChange={(event) => setServiceKey(event.target.value)}
              />
              <p className="rounded-lg border-l-4 border-blue-500 bg-blue-50 px-3 py-2 text-xs leading-6 text-blue-700">
                {UI.serviceKeyHelp}
              </p>
            </label>

            <div className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
              <strong className="text-base font-bold text-slate-900">{UI.sidoLabel}</strong>
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
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-base font-bold text-slate-900">{UI.sigunguLabel}</strong>
                {sigunguOptions.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSigunguCodes((prev) =>
                        prev.length === sigunguOptions.length ? [] : sigunguOptions.map((item) => item.code),
                      )
                    }
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                  >
                    {selectedSigunguCodes.length === sigunguOptions.length ? "전체 해제" : "전체 선택"}
                  </button>
                ) : null}
              </div>

              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
                {sigunguOptions.length === 0 ? <p className="text-xs text-slate-500">{UI.sigunguHint}</p> : null}
                {sigunguOptions.map((item) => {
                  const active = selectedSigunguCodes.includes(item.code);
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() =>
                        setSelectedSigunguCodes((prev) =>
                          prev.includes(item.code)
                            ? prev.filter((value) => value !== item.code)
                            : [...prev, item.code],
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-base font-bold text-slate-900">{UI.elevatorLabel}</strong>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedElevatorModes((prev) =>
                      prev.length === ALL_ELEVATOR_KEYS.length ? [] : [...ALL_ELEVATOR_KEYS],
                    )
                  }
                  className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                >
                  {activeElevatorModes.length === ALL_ELEVATOR_KEYS.length ? "전체 해제" : "전체 선택"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {ELEVATOR_OPTIONS.map((item) => {
                  const active = activeElevatorModes.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleElevatorMode(item.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs leading-6 text-slate-500">{UI.elevatorHint}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                <strong className="text-base font-bold text-slate-900">{UI.permitFromLabel}</strong>
                <input
                  type="date"
                  className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                  value={toInputDate(startDate)}
                  onChange={(event) => setStartDate(toApiDate(event.target.value))}
                />
              </label>

              <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                <strong className="text-base font-bold text-slate-900">{UI.permitToLabel}</strong>
                <input
                  type="date"
                  className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                  value={toInputDate(endDate)}
                  onChange={(event) => setEndDate(toApiDate(event.target.value))}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                <strong className="text-base font-bold text-slate-900">{UI.constructionFromLabel}</strong>
                <input
                  type="date"
                  className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                  value={toInputDate(constructionStartDate)}
                  onChange={(event) => setConstructionStartDate(toApiDate(event.target.value))}
                />
              </label>

              <label className="grid gap-2 rounded-xl border border-blue-200 bg-slate-50 p-4 text-sm text-slate-700">
                <strong className="text-base font-bold text-slate-900">{UI.constructionToLabel}</strong>
                <input
                  type="date"
                  className="w-full rounded-lg border border-blue-300 bg-white px-4 py-3 text-sm text-slate-800"
                  value={toInputDate(constructionEndDate)}
                  onChange={(event) => setConstructionEndDate(toApiDate(event.target.value))}
                />
              </label>
            </div>

            <p className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-700">
              {UI.constructionHint}
            </p>
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
          <p className="text-xs font-extrabold tracking-[0.14em] text-blue-600">{UI.resultBadge}</p>
          <h2 className="mt-1 text-xl font-bold text-slate-800">{UI.resultTitle}</h2>

          <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
            {hasRegionDownload ? (
              <button
                type="button"
                onClick={onDownloadGrouped}
                disabled={rows.length === 0}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {UI.groupedExcelLabel}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onDownloadAll}
              disabled={rows.length === 0}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {UI.allExcelLabel}
            </button>

            {hasFilteredDownload ? (
              <button
                type="button"
                onClick={onDownloadFiltered}
                disabled={filteredRows.length === 0}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {UI.filteredExcelLabel}
              </button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-blue-700">
                <span>{progressTitle || UI.preparing}</span>
                <span>{progress}%</span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="mt-3 text-xs leading-6 text-slate-600">{progressDetail || UI.progressFallback}</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">{UI.keepPage}</p>
            </div>
          ) : null}
        </article>
      </div>

      {message ? (
        <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {message}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-blue-700">{UI.regionFilterTitle}</p>
            <p className="text-xs font-semibold text-slate-600">
              {UI.totalPrefix} {rows.length}
              {UI.countSuffix} | {UI.currentPrefix} {filteredRows.length}
              {UI.countSuffix}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {regionStats.map((item) => {
              const active = regionFilter === item.name;

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setRegionFilter(item.name)}
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

      {rows.length > 0 ? (
        <article className="mt-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_36px_rgba(44,86,150,0.12)]">
          {filteredRows.length > 0 ? (
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
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {UI.filteredEmpty}
            </div>
          )}
        </article>
      ) : null}
    </>
  );
}
