"use client";

import {
  Fragment,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

import styles from "./db-cleanup.module.css";
import {
  ACCEPT,
  buildUpdatedFileName,
  formatDateTime,
  humanFileSize,
  mergeHeaders,
  parseSpreadsheet,
  removeExtension,
  safeSheetName,
  saveWorkbook,
  type ParsedSpreadsheet,
} from "@/lib/db-cleanup/duplicate-remover";
import type { LocaleContent } from "@/lib/i18n/types";

type DragTarget = "" | "new" | "existing";
type MetricTone = "neutral" | "good" | "minus" | "soft" | "plus" | "final";
type HeaderPanelAccent = "emerald" | "rose";
type DbCleanupLabels = LocaleContent["dbCleanup"];
type ProcessMode = "single" | "compare";
type Row = ParsedSpreadsheet["rows"][number];

type LoadingStage =
  | "idle"
  | "reading-new"
  | "reading-existing"
  | "single-step1"
  | "compare-existing-step"
  | "compare-new-step1"
  | "compare-cross-check"
  | "compare-merge"
  | "done";

type ProcessResult = {
  mode: ProcessMode;
  processedAt: string;
  selectedNewDuplicateHeaders: string[];
  selectedExistingDuplicateHeaders: string[];
  appendableNewRows: Row[];
  cleanedExistingRows: Row[];
  finalMergedRows: Row[];
  appendableNewHeaders: string[];
  mergedHeaders: string[];
  appendableNewFileName: string;
  finalMergedFileName: string;
  stats: {
    newOriginalCount: number;
    existingOriginalCount: number;
    existingRemovedInStepCount: number;
    existingStepCount: number;
    newRemovedInStep1Count: number;
    newStep1Count: number;
    removedAgainstExistingCount: number;
    newRemovedInCompareHeaderStepCount: number;
    newCompareHeaderStepCount: number;
    removedInFinalMergeSafetyCount: number;
    finalNewCount: number;
    mergedFinalCount: number;
  };
};

type UploadCardProps = {
  id: string;
  title: string;
  description: string;
  fileInfo: ParsedSpreadsheet | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  isDragOver: boolean;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => Promise<void> | void;
  onRemove: () => void;
  labels: DbCleanupLabels["upload"];
  countSuffix: string;
};

type HeaderSelectPanelProps = {
  title: string;
  description: string;
  headers: string[];
  selectedHeaders: string[];
  accent: HeaderPanelAccent;
  stepLabel: string;
  pickedLabel: string;
  countSuffix: string;
  onToggle: (header: string) => void;
};

type DbCleanupClientProps = {
  labels: DbCleanupLabels;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

function looksLikePhoneishValue(value: string) {
  const compact = value.trim();
  if (!compact) return false;

  const digits = compact.replace(/\D/g, "");
  if (digits.length < 7) return false;

  return /^[\d\s()+-]+$/.test(compact);
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) return "";

  const raw = String(value);
  const trimmed = normalizeWhitespace(raw);
  if (!trimmed) return "";

  if (looksLikePhoneishValue(trimmed)) {
    return trimmed.replace(/\D/g, "");
  }

  return trimmed.toLowerCase();
}

function buildSingleHeaderKey(row: Row, header: string) {
  return normalizeCellValue(row?.[header]);
}

function dedupeRowsBySelectedHeadersKeepFirst(rows: Row[], headers: string[]) {
  if (headers.length === 0) {
    return {
      rows: [...rows],
      removedCount: 0,
      finalCount: rows.length,
    };
  }

  const parent = rows.map((_, index) => index);

  const find = (x: number): number => {
    let current = x;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };

  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);

    if (rootA === rootB) return;

    if (rootA < rootB) {
      parent[rootB] = rootA;
    } else {
      parent[rootA] = rootB;
    }
  };

  for (const header of headers) {
    const firstIndexByKey = new Map<string, number>();

    rows.forEach((row, index) => {
      const key = buildSingleHeaderKey(row, header);
      if (!key) return;

      const firstIndex = firstIndexByKey.get(key);
      if (firstIndex === undefined) {
        firstIndexByKey.set(key, index);
        return;
      }

      union(firstIndex, index);
    });
  }

  const keepIndexes = new Map<number, number>();

  rows.forEach((_, index) => {
    const root = find(index);
    const saved = keepIndexes.get(root);

    if (saved === undefined || index < saved) {
      keepIndexes.set(root, index);
    }
  });

  const finalKeepIndexSet = new Set<number>([...keepIndexes.values()]);
  const finalRows = rows.filter((_, index) => finalKeepIndexSet.has(index));

  return {
    rows: finalRows,
    removedCount: rows.length - finalRows.length,
    finalCount: finalRows.length,
  };
}

function removeNewRowsConnectedToExistingByHeaders(
  newRows: Row[],
  existingRows: Row[],
  headers: string[],
) {
  if (headers.length === 0) {
    return {
      rows: [...newRows],
      removedCount: 0,
      finalCount: newRows.length,
    };
  }

  const combinedRows = [...existingRows, ...newRows];
  const existingCount = existingRows.length;

  if (combinedRows.length === 0) {
    return {
      rows: [],
      removedCount: 0,
      finalCount: 0,
    };
  }

  const parent = combinedRows.map((_, index) => index);

  const find = (x: number): number => {
    let current = x;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };

  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);

    if (rootA === rootB) return;

    if (rootA < rootB) {
      parent[rootB] = rootA;
    } else {
      parent[rootA] = rootB;
    }
  };

  for (const header of headers) {
    const firstIndexByKey = new Map<string, number>();

    combinedRows.forEach((row, index) => {
      const key = buildSingleHeaderKey(row, header);
      if (!key) return;

      const firstIndex = firstIndexByKey.get(key);
      if (firstIndex === undefined) {
        firstIndexByKey.set(key, index);
        return;
      }

      union(firstIndex, index);
    });
  }

  const rootsHavingExisting = new Set<number>();

  for (let index = 0; index < existingCount; index += 1) {
    rootsHavingExisting.add(find(index));
  }

  const finalRows: Row[] = [];

  for (let index = 0; index < newRows.length; index += 1) {
    const combinedIndex = existingCount + index;
    const root = find(combinedIndex);

    if (!rootsHavingExisting.has(root)) {
      finalRows.push(newRows[index]);
    }
  }

  return {
    rows: finalRows,
    removedCount: newRows.length - finalRows.length,
    finalCount: finalRows.length,
  };
}

function downloadRows(headers: string[], rows: Row[], fileName: string) {
  saveWorkbook(headers, rows, fileName, safeSheetName(removeExtension(fileName)));
}

function MetricCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: MetricTone;
}) {
  return (
    <div className={styles.metricCard} data-tone={tone}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      {sub ? <div className={styles.metricSub}>{sub}</div> : null}
    </div>
  );
}

function ThumbnailIcon({ success = false }: { success?: boolean }) {
  return (
    <div className={styles.thumbnailIcon} data-success={success}>
      <div className={styles.thumbnailPaper}>
        <span className={styles.thumbnailBar} />
        <span className={styles.thumbnailBarWide} />
        <span className={styles.thumbnailBarSoft} />
      </div>
      <span className={`${styles.thumbnailDot} ${styles.dotA}`} />
      <span className={`${styles.thumbnailDot} ${styles.dotB}`} />
      <span className={`${styles.thumbnailDot} ${styles.dotC}`} />
      <span className={`${styles.thumbnailDot} ${styles.dotD}`} />
      {success ? <span className={styles.thumbnailCheck}>OK</span> : null}
    </div>
  );
}

function UploadCard({
  id,
  title,
  description,
  fileInfo,
  inputRef,
  onFileChange,
  isDragOver,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
  labels,
  countSuffix,
}: UploadCardProps) {
  return (
    <section className={styles.uploadCardWrap} data-drag={isDragOver}>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className={styles.hiddenFileInput}
        onChange={onFileChange}
      />

      <div
        className={`${styles.uploadDropArea} ${styles.interactiveSurface}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <ThumbnailIcon success={Boolean(fileInfo)} />

        {!fileInfo ? (
          <>
            <div className={styles.uploadTitleGroup}>
              <span className={styles.uploadLabel}>{title}</span>
              <h3 className={styles.uploadTitle}>{title}</h3>
              <p className={styles.uploadDescription}>{description}</p>
            </div>

            <div className={styles.uploadHintBox}>
              <strong>{labels.dropHintTitle}</strong>
              <span>{labels.dropHintDescription}</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.uploadTitleGroup}>
              <span className={`${styles.uploadLabel} ${styles.uploadLabelSuccess}`}>
                {labels.uploadedLabel}
              </span>
              <h3 className={styles.uploadTitle} title={fileInfo.fileName}>
                {fileInfo.fileName}
              </h3>
              <p className={styles.uploadDescription}>
                {humanFileSize(fileInfo.fileSize)} · {fileInfo.totalRows.toLocaleString()}
                {labels.rowsLoadedSuffix}
              </p>
            </div>

            <div className={styles.uploadedMeta}>
              <div className={styles.uploadedMetaItem}>
                <span>{labels.columnsLabel}</span>
                <strong>
                  {fileInfo.headers.length.toLocaleString()}
                  {countSuffix}
                </strong>
              </div>
              <div className={styles.uploadedMetaItem}>
                <span>{labels.loadedAtLabel}</span>
                <strong>{fileInfo.loadedAt}</strong>
              </div>
            </div>

            <div className={styles.uploadActionRow} onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className={`${styles.inlineButton} ${styles.inlineButtonLight}`}
                onClick={() => inputRef.current?.click()}
              >
                {labels.changeFileLabel}
              </button>
              <button
                type="button"
                className={`${styles.inlineButton} ${styles.inlineButtonDanger}`}
                onClick={onRemove}
              >
                {labels.removeLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function HeaderSelectPanel({
  title,
  description,
  headers,
  selectedHeaders,
  accent,
  stepLabel,
  pickedLabel,
  countSuffix,
  onToggle,
}: HeaderSelectPanelProps) {
  return (
    <section className={`${styles.selectPanel} ${styles.interactiveSurface}`} data-accent={accent}>
      <div className={styles.sectionCardHead}>
        <div>
          <div className={styles.sectionEyebrow}>{stepLabel}</div>
          <h3 className={styles.sectionTitle}>{title}</h3>
          <p className={styles.sectionDescription}>{description}</p>
        </div>

        <div className={styles.pickedCounter}>
          <span>{pickedLabel}</span>
          <strong>
            {selectedHeaders.length.toLocaleString()}
            {countSuffix}
          </strong>
        </div>
      </div>

      <div className={styles.tokenGrid}>
        {headers.map((header) => {
          const checked = selectedHeaders.includes(header);

          return (
            <label key={`${title}-${header}`} className={styles.tokenOption} data-checked={checked}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(header)} />
              <span>{header}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function getLoadingText(labels: DbCleanupLabels, stage: LoadingStage) {
  switch (stage) {
    case "reading-new":
      return {
        title: "신규 파일 불러오는 중",
        description: "신규 파일 시트와 컬럼 구조를 읽고 있습니다.",
      };
    case "reading-existing":
      return {
        title: "기존 파일 불러오는 중",
        description: "기존 파일 시트와 컬럼 구조를 읽고 있습니다.",
      };
    case "single-step1":
      return {
        title: labels.loading.title,
        description: "신규 파일을 선택한 컬럼 기준으로 중복 그룹을 계산하고 있습니다.",
      };
    case "compare-existing-step":
      return {
        title: labels.loading.title,
        description: "기존 DB를 선택한 비교 컬럼 기준으로 정리하고 있습니다.",
      };
    case "compare-new-step1":
      return {
        title: labels.loading.title,
        description: "신규 파일을 1차 기준으로 정리한 뒤 기존 DB와 연결 중복까지 검사하고 있습니다.",
      };
    case "compare-cross-check":
      return {
        title: labels.loading.title,
        description: "신규 정리본을 비교 기준 컬럼으로 다시 정리하고 있습니다.",
      };
    case "compare-merge":
      return {
        title: labels.loading.title,
        description: "기존 정리본과 신규 추가 대상을 합치고 최종 안전 검사를 진행하고 있습니다.",
      };
    case "done":
      return {
        title: "정리 완료",
        description: "다운로드할 결과 파일이 준비되었습니다.",
      };
    default:
      return {
        title: labels.loading.title,
        description: labels.loading.description,
      };
  }
}

export default function DbCleanupClient({ labels }: DbCleanupClientProps) {
  const newFileInputRef = useRef<HTMLInputElement | null>(null);
  const existingFileInputRef = useRef<HTMLInputElement | null>(null);

  const [newFileInfo, setNewFileInfo] = useState<ParsedSpreadsheet | null>(null);
  const [existingFileInfo, setExistingFileInfo] = useState<ParsedSpreadsheet | null>(null);
  const [newDuplicateHeaders, setNewDuplicateHeaders] = useState<string[]>([]);
  const [existingDuplicateHeaders, setExistingDuplicateHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [newFileError, setNewFileError] = useState("");
  const [existingFileError, setExistingFileError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("idle");
  const [dragTarget, setDragTarget] = useState<DragTarget>("");

  const compareMode = Boolean(newFileInfo && existingFileInfo);
  const singleMode = Boolean(newFileInfo && !existingFileInfo);

  const selectableNewHeaders = useMemo(() => {
    return newFileInfo ? [...newFileInfo.headers] : [];
  }, [newFileInfo]);

  const sharedHeaders = useMemo(() => {
    if (!newFileInfo || !existingFileInfo) return [] as string[];
    const existingHeaderSet = new Set(existingFileInfo.headers);
    return newFileInfo.headers.filter((header) => existingHeaderSet.has(header));
  }, [existingFileInfo, newFileInfo]);

  const comparableExistingHeaders = useMemo(
    () => existingDuplicateHeaders.filter((header) => sharedHeaders.includes(header)),
    [existingDuplicateHeaders, sharedHeaders],
  );

  const compareCompatibilityError = useMemo(() => {
    if (!compareMode) return "";
    if (sharedHeaders.length === 0) return labels.errors.headersMustMatch;
    return "";
  }, [compareMode, labels.errors.headersMustMatch, sharedHeaders.length]);

  const canProcess = Boolean(
    newFileInfo &&
      newDuplicateHeaders.length > 0 &&
      !isProcessing &&
      (!existingFileInfo || (sharedHeaders.length > 0 && comparableExistingHeaders.length > 0)),
  );

  const loadingCopy = getLoadingText(labels, loadingStage);

  const tick = async (stage: LoadingStage) => {
    setLoadingStage(stage);
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  };

  const resetResult = () => setResult(null);

  const clearNewFile = () => {
    setNewFileInfo(null);
    setNewDuplicateHeaders([]);
    setNewFileError("");
    setGlobalError("");
    resetResult();
    if (newFileInputRef.current) newFileInputRef.current.value = "";
  };

  const clearExistingFile = () => {
    setExistingFileInfo(null);
    setExistingDuplicateHeaders([]);
    setExistingFileError("");
    setGlobalError("");
    resetResult();
    if (existingFileInputRef.current) existingFileInputRef.current.value = "";
  };

  const resetAll = () => {
    setNewFileInfo(null);
    setExistingFileInfo(null);
    setNewDuplicateHeaders([]);
    setExistingDuplicateHeaders([]);
    setResult(null);
    setGlobalError("");
    setNewFileError("");
    setExistingFileError("");
    setIsProcessing(false);
    setLoadingStage("idle");
    setDragTarget("");

    if (newFileInputRef.current) newFileInputRef.current.value = "";
    if (existingFileInputRef.current) existingFileInputRef.current.value = "";
  };

  const applyNewFile = async (file?: File) => {
    setNewFileError("");
    setGlobalError("");
    resetResult();
    if (!file) return;

    setIsProcessing(true);
    try {
      await tick("reading-new");
      const parsed = await parseSpreadsheet(file);
      setNewFileInfo(parsed);
      setNewDuplicateHeaders([]);
    } catch (error) {
      setNewFileInfo(null);
      setNewFileError(error instanceof Error ? error.message : labels.errors.newFileReadFailed);
    } finally {
      setIsProcessing(false);
      setLoadingStage("idle");
    }
  };

  const applyExistingFile = async (file?: File) => {
    setExistingFileError("");
    setGlobalError("");
    resetResult();
    if (!file) return;

    setIsProcessing(true);
    try {
      await tick("reading-existing");
      const parsed = await parseSpreadsheet(file);
      setExistingFileInfo(parsed);
      setExistingDuplicateHeaders([]);
    } catch (error) {
      setExistingFileInfo(null);
      setExistingFileError(
        error instanceof Error ? error.message : labels.errors.existingFileReadFailed,
      );
    } finally {
      setIsProcessing(false);
      setLoadingStage("idle");
    }
  };

  const handleNewFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await applyNewFile(event.target.files?.[0]);
  };

  const handleExistingFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await applyExistingFile(event.target.files?.[0]);
  };

  const createDragHandlers = (type: Extract<DragTarget, "new" | "existing">) => ({
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragTarget(type);
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (dragTarget !== type) setDragTarget(type);
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const relatedTarget = event.relatedTarget;
      if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
        setDragTarget((prev) => (prev === type ? "" : prev));
      }
    },
    onDrop: async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragTarget("");

      const file = event.dataTransfer?.files?.[0];
      if (!file) return;

      if (type === "new") {
        await applyNewFile(file);
      } else {
        await applyExistingFile(file);
      }
    },
  });

  const newDragHandlers = createDragHandlers("new");
  const existingDragHandlers = createDragHandlers("existing");

  const toggleNewDuplicateHeader = (header: string) => {
    setGlobalError("");
    resetResult();
    setNewDuplicateHeaders((prev) =>
      prev.includes(header) ? prev.filter((item) => item !== header) : [...prev, header],
    );
  };

  const toggleExistingDuplicateHeader = (header: string) => {
    setGlobalError("");
    resetResult();
    setExistingDuplicateHeaders((prev) =>
      prev.includes(header) ? prev.filter((item) => item !== header) : [...prev, header],
    );
  };

  const validateSelections = () => {
    if (!newFileInfo) {
      setGlobalError(labels.errors.newFileRequired);
      return false;
    }

    if (newDuplicateHeaders.length === 0) {
      setGlobalError(labels.errors.newHeadersRequired);
      return false;
    }

    if (!existingFileInfo) return true;

    if (sharedHeaders.length === 0) {
      setGlobalError(labels.errors.headersMustMatch);
      return false;
    }

    if (comparableExistingHeaders.length === 0) {
      setGlobalError(labels.errors.existingHeadersRequired);
      return false;
    }

    return true;
  };

  const handleProcess = async () => {
    setGlobalError("");
    setResult(null);

    if (!validateSelections() || !newFileInfo) return;

    setIsProcessing(true);

    try {
      if (!existingFileInfo) {
        await tick("single-step1");

        const newStep1Dedup = dedupeRowsBySelectedHeadersKeepFirst(
          newFileInfo.rows,
          newDuplicateHeaders,
        );
        const finalRows = newStep1Dedup.rows;
        const fileNameBase = newFileInfo.fileName;

        await tick("done");

        setResult({
          mode: "single",
          processedAt: formatDateTime(),
          selectedNewDuplicateHeaders: [...newDuplicateHeaders],
          selectedExistingDuplicateHeaders: [],
          appendableNewRows: finalRows,
          cleanedExistingRows: [],
          finalMergedRows: finalRows,
          appendableNewHeaders: newFileInfo.headers,
          mergedHeaders: newFileInfo.headers,
          appendableNewFileName: buildUpdatedFileName(fileNameBase, "신규정리결과"),
          finalMergedFileName: buildUpdatedFileName(fileNameBase, "최종정리결과"),
          stats: {
            newOriginalCount: newFileInfo.rows.length,
            existingOriginalCount: 0,
            existingRemovedInStepCount: 0,
            existingStepCount: 0,
            newRemovedInStep1Count: newStep1Dedup.removedCount,
            newStep1Count: finalRows.length,
            removedAgainstExistingCount: 0,
            newRemovedInCompareHeaderStepCount: 0,
            newCompareHeaderStepCount: finalRows.length,
            removedInFinalMergeSafetyCount: 0,
            finalNewCount: finalRows.length,
            mergedFinalCount: finalRows.length,
          },
        });

        return;
      }

      await tick("compare-existing-step");
      const existingStepDedup = dedupeRowsBySelectedHeadersKeepFirst(
        existingFileInfo.rows,
        comparableExistingHeaders,
      );
      const cleanedExistingRows = existingStepDedup.rows;

      await tick("compare-new-step1");
      const newStep1Dedup = dedupeRowsBySelectedHeadersKeepFirst(
        newFileInfo.rows,
        newDuplicateHeaders,
      );
      const newStep1Rows = newStep1Dedup.rows;

      const filteredAgainstExisting = removeNewRowsConnectedToExistingByHeaders(
        newStep1Rows,
        existingFileInfo.rows,
        comparableExistingHeaders,
      );

      await tick("compare-cross-check");

      const newCompareHeaderDedup = dedupeRowsBySelectedHeadersKeepFirst(
        filteredAgainstExisting.rows,
        comparableExistingHeaders,
      );
      const comparePreparedNewRows = newCompareHeaderDedup.rows;

      await tick("compare-merge");

      const mergedHeaders = mergeHeaders(existingFileInfo.headers, newFileInfo.headers);
      const mergedBeforeFinalSafety = [...cleanedExistingRows, ...comparePreparedNewRows];

      const mergedFinalSafetyDedup = dedupeRowsBySelectedHeadersKeepFirst(
        mergedBeforeFinalSafety,
        comparableExistingHeaders,
      );
      const finalMergedRows = mergedFinalSafetyDedup.rows;

      const finalMergedRowSet = new Set<Row>(finalMergedRows);
      const appendableNewRows = comparePreparedNewRows.filter((row) => finalMergedRowSet.has(row));

      const fileNameBase = existingFileInfo.fileName || newFileInfo.fileName;

      await tick("done");

      setResult({
        mode: "compare",
        processedAt: formatDateTime(),
        selectedNewDuplicateHeaders: [...newDuplicateHeaders],
        selectedExistingDuplicateHeaders: [...comparableExistingHeaders],
        appendableNewRows,
        cleanedExistingRows,
        finalMergedRows,
        appendableNewHeaders: newFileInfo.headers,
        mergedHeaders,
        appendableNewFileName: buildUpdatedFileName(fileNameBase, "신규추가대상"),
        finalMergedFileName: buildUpdatedFileName(fileNameBase, "최종전체DB"),
        stats: {
          newOriginalCount: newFileInfo.rows.length,
          existingOriginalCount: existingFileInfo.rows.length,
          existingRemovedInStepCount: existingStepDedup.removedCount,
          existingStepCount: cleanedExistingRows.length,
          newRemovedInStep1Count: newStep1Dedup.removedCount,
          newStep1Count: newStep1Rows.length,
          removedAgainstExistingCount: filteredAgainstExisting.removedCount,
          newRemovedInCompareHeaderStepCount: newCompareHeaderDedup.removedCount,
          newCompareHeaderStepCount: comparePreparedNewRows.length,
          removedInFinalMergeSafetyCount:
            mergedBeforeFinalSafety.length - mergedFinalSafetyDedup.rows.length,
          finalNewCount: appendableNewRows.length,
          mergedFinalCount: finalMergedRows.length,
        },
      });
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : labels.errors.processFailed);
    } finally {
      setIsProcessing(false);
      setLoadingStage("idle");
    }
  };

  const downloadAppendableNewFile = () => {
    if (!result) return;
    downloadRows(
      result.appendableNewHeaders,
      result.appendableNewRows,
      result.appendableNewFileName,
    );
  };

  const downloadFinalMergedFile = () => {
    if (!result) return;
    downloadRows(result.mergedHeaders, result.finalMergedRows, result.finalMergedFileName);
  };

  const downloadBothFiles = () => {
    if (!result || result.mode !== "compare") return;
    downloadAppendableNewFile();
    window.setTimeout(downloadFinalMergedFile, 220);
  };

  const progressText = useMemo(() => {
    if (isProcessing) return loadingCopy.description;
    if (!newFileInfo && !existingFileInfo) return labels.progress.idle;
    if (!newFileInfo && existingFileInfo) return labels.progress.existingOnly;
    if (newFileInfo && !existingFileInfo) return labels.singleMode.progress;
    if (compareCompatibilityError) return compareCompatibilityError;
    if (canProcess) return labels.progress.ready;
    return labels.progress.selecting;
  }, [
    canProcess,
    compareCompatibilityError,
    existingFileInfo,
    isProcessing,
    labels.progress.existingOnly,
    labels.progress.idle,
    labels.progress.ready,
    labels.progress.selecting,
    labels.singleMode.progress,
    loadingCopy.description,
    newFileInfo,
  ]);

  const infoLines = compareMode
    ? labels.messages.infoLines
    : singleMode
      ? labels.singleMode.infoLines
      : [];
  const actionDescription = compareMode
    ? labels.actionBar.description
    : labels.actionBar.singleDescription;

  return (
    <div className={styles.root}>
      {isProcessing ? (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingModal}>
            <div className={styles.spinner} />
            <h3>{loadingCopy.title}</h3>
            <p>{loadingCopy.description}</p>
          </div>
        </div>
      ) : null}

      <section className={styles.heroSection}>
        <article className={`${styles.heroCard} ${styles.heroMain} ${styles.interactiveSurface}`}>
          <div className={styles.eyebrow}>{labels.eyebrow}</div>
          <h1 className={styles.heroTitle}>
            {labels.heroTitleLines.map((line, index) => (
              <Fragment key={`${line}-${index}`}>
                {line}
                {index < labels.heroTitleLines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </h1>
          <p className={styles.heroDescription}>{labels.heroDescription}</p>

          <div className={styles.flowRail}>
            {labels.flowSteps.map((step, index) => (
              <div key={`${step.title}-${index}`} className={styles.flowRailItem}>
                <div className={styles.flowStep} data-final={index === labels.flowSteps.length - 1}>
                  <b>{step.title}</b>
                  <span>{step.description}</span>
                </div>
                {index < labels.flowSteps.length - 1 ? <i className={styles.flowConnector} /> : null}
              </div>
            ))}
          </div>
        </article>

        <aside className={`${styles.heroCard} ${styles.heroStatus} ${styles.interactiveSurface}`}>
          <div className={styles.heroStatusTop}>
            <div className={styles.liveDot} />
            <strong>{labels.currentStatusTitle}</strong>
          </div>

          <p className={styles.heroStatusText}>{progressText}</p>

          <div className={styles.statusMetricGrid}>
            <MetricCard
              label={labels.statusMetrics.existingFile}
              value={existingFileInfo ? labels.statusMetrics.ready : labels.statusMetrics.waiting}
              sub={
                existingFileInfo
                  ? `${existingFileInfo.totalRows.toLocaleString()}${labels.statusMetrics.rowsSuffix}`
                  : labels.statusMetrics.uploadNeeded
              }
              tone={existingFileInfo ? "good" : "neutral"}
            />
            <MetricCard
              label={labels.statusMetrics.newFile}
              value={newFileInfo ? labels.statusMetrics.ready : labels.statusMetrics.waiting}
              sub={
                newFileInfo
                  ? `${newFileInfo.totalRows.toLocaleString()}${labels.statusMetrics.rowsSuffix}`
                  : labels.statusMetrics.uploadNeeded
              }
              tone={newFileInfo ? "good" : "neutral"}
            />
          </div>

          <div className={styles.infoList}>
            {labels.infoItems.map((item) => (
              <div key={item.label} className={styles.infoItem}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className={styles.uploadGrid}>
        <UploadCard
          id="existing-db-file"
          title={labels.upload.existingTitle}
          description={labels.upload.existingDescription}
          fileInfo={existingFileInfo}
          inputRef={existingFileInputRef}
          onFileChange={handleExistingFileChange}
          isDragOver={dragTarget === "existing"}
          onDragEnter={existingDragHandlers.onDragEnter}
          onDragOver={existingDragHandlers.onDragOver}
          onDragLeave={existingDragHandlers.onDragLeave}
          onDrop={existingDragHandlers.onDrop}
          onRemove={clearExistingFile}
          labels={labels.upload}
          countSuffix={labels.statusMetrics.countSuffix}
        />

        <UploadCard
          id="new-data-file"
          title={labels.upload.newTitle}
          description={labels.upload.newDescription}
          fileInfo={newFileInfo}
          inputRef={newFileInputRef}
          onFileChange={handleNewFileChange}
          isDragOver={dragTarget === "new"}
          onDragEnter={newDragHandlers.onDragEnter}
          onDragOver={newDragHandlers.onDragOver}
          onDragLeave={newDragHandlers.onDragLeave}
          onDrop={newDragHandlers.onDrop}
          onRemove={clearNewFile}
          labels={labels.upload}
          countSuffix={labels.statusMetrics.countSuffix}
        />
      </section>

      {newFileError || existingFileError ? (
        <section className={`${styles.messageCard} ${styles.messageCardError}`}>
          <div className={styles.messageTitle}>{labels.messages.errorTitle}</div>
          {existingFileError ? <div className={styles.messageLine}>- {existingFileError}</div> : null}
          {newFileError ? <div className={styles.messageLine}>- {newFileError}</div> : null}
        </section>
      ) : null}

      {compareCompatibilityError ? (
        <section className={`${styles.messageCard} ${styles.messageCardError}`}>
          <div className={styles.messageTitle}>{labels.messages.errorTitle}</div>
          <div className={styles.messageLine}>- {compareCompatibilityError}</div>
        </section>
      ) : null}

      {infoLines.length > 0 ? (
        <section className={`${styles.messageCard} ${styles.messageCardInfo} ${styles.interactiveSurface}`}>
          <div className={styles.messageTitle}>{labels.messages.infoTitle}</div>
          {infoLines.map((line) => (
            <div key={line} className={styles.messageLine}>
              - {line}
            </div>
          ))}
        </section>
      ) : null}

      {newFileInfo ? (
        <section className={styles.selectionStack}>
          <HeaderSelectPanel
            title={labels.selection.newTitle}
            description={labels.selection.newDescription}
            headers={selectableNewHeaders}
            selectedHeaders={newDuplicateHeaders}
            accent="emerald"
            stepLabel={labels.selection.step1}
            pickedLabel={labels.selection.pickedLabel}
            countSuffix={labels.statusMetrics.countSuffix}
            onToggle={toggleNewDuplicateHeader}
          />

          {existingFileInfo ? (
            <HeaderSelectPanel
              title={labels.selection.existingTitle}
              description={labels.selection.existingDescription}
              headers={sharedHeaders}
              selectedHeaders={comparableExistingHeaders}
              accent="rose"
              stepLabel={labels.selection.step2}
              pickedLabel={labels.selection.pickedLabel}
              countSuffix={labels.statusMetrics.countSuffix}
              onToggle={toggleExistingDuplicateHeader}
            />
          ) : null}

          <div className={`${styles.actionBar} ${styles.interactiveSurface}`}>
            <div className={styles.actionBarText}>
              <strong>{labels.actionBar.title}</strong>
              <span>{actionDescription}</span>
            </div>

            <div className={styles.actionBarButtons}>
              <button type="button" className={styles.mainButton} onClick={handleProcess} disabled={!canProcess}>
                {isProcessing ? labels.actionBar.runningLabel : labels.actionBar.runLabel}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={resetAll}>
                {labels.actionBar.resetLabel}
              </button>
            </div>
          </div>

          {globalError ? (
            <section className={`${styles.messageCard} ${styles.messageCardError}`}>
              <div className={styles.messageTitle}>{labels.messages.errorTitle}</div>
              <div className={styles.messageLine}>- {globalError}</div>
            </section>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section className={`${styles.resultSection} ${styles.interactiveSurface}`}>
          <div className={styles.resultTop}>
            <div>
              <div className={`${styles.eyebrow} ${styles.eyebrowBlue}`}>{labels.result.eyebrow}</div>
              <h2 className={styles.resultTitle}>중복 정리 완료</h2>
              <p className={styles.resultTime}>{result.processedAt}</p>
            </div>

            {result.mode === "compare" ? (
              <button type="button" className={styles.downloadAllButton} onClick={downloadBothFiles}>
                결과 파일 2개 모두 다운로드
              </button>
            ) : null}
          </div>

          <div className={styles.criteriaWrap}>
            <div className={styles.criteriaCard}>
              <span>신규 중복 제거 기준</span>
              <strong>{result.selectedNewDuplicateHeaders.join(" / ")}</strong>
            </div>

            {result.mode === "compare" ? (
              <div className={styles.criteriaCard}>
                <span>기존 DB 중복 제거 및 비교 기준</span>
                <strong>{result.selectedExistingDuplicateHeaders.join(" / ")}</strong>
              </div>
            ) : null}
          </div>

          {result.mode === "single" ? (
            <div className={styles.resultStatsGridSingle}>
              <MetricCard
                label="신규 원본 데이터"
                value={result.stats.newOriginalCount.toLocaleString()}
                tone="neutral"
              />
              <MetricCard
                label="내부 중복 제거"
                value={`- ${result.stats.newRemovedInStep1Count.toLocaleString()}`}
                tone="minus"
              />
              <MetricCard
                label="최종 정리 결과"
                value={result.stats.finalNewCount.toLocaleString()}
                tone="final"
              />
            </div>
          ) : null}

          <div className={styles.resultDownloadPanel}>
            <div className={styles.resultDownloadCard}>
              <div className={styles.resultDownloadBody}>
                <div className={styles.resultDownloadText}>
                  <span className={styles.resultDownloadEyebrow}>
                    {result.mode === "compare" ? "추가할 신규 데이터 파일" : "정리 완료 파일"}
                  </span>
                  <strong>{result.appendableNewFileName}</strong>

                  <div className={styles.downloadMetaList}>
                    {result.mode === "compare" ? (
                      <>
                        <div className={styles.downloadMetaItem}>
                          <span>신규 원본</span>
                          <strong>{result.stats.newOriginalCount.toLocaleString()}건</strong>
                        </div>
                        <div className={styles.downloadMetaItem}>
                          <span>중복 제거</span>
                          <strong>
                            -{" "}
                            {(
                              result.stats.newRemovedInStep1Count +
                              result.stats.removedAgainstExistingCount +
                              result.stats.newRemovedInCompareHeaderStepCount
                            ).toLocaleString()}
                            건
                          </strong>
                        </div>
                        <div className={styles.downloadMetaItem}>
                          <span>최종 추가 대상</span>
                          <strong>{result.stats.finalNewCount.toLocaleString()}건</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={styles.downloadMetaItem}>
                          <span>신규 원본</span>
                          <strong>{result.stats.newOriginalCount.toLocaleString()}건</strong>
                        </div>
                        <div className={styles.downloadMetaItem}>
                          <span>중복 제거</span>
                          <strong>- {result.stats.newRemovedInStep1Count.toLocaleString()}건</strong>
                        </div>
                        <div className={styles.downloadMetaItem}>
                          <span>최종 정리</span>
                          <strong>{result.stats.finalNewCount.toLocaleString()}건</strong>
                        </div>
                      </>
                    )}
                  </div>

                  <p>
                    {result.mode === "compare"
                      ? "기존 DB에 실제로 추가되는 신규 데이터만 담았습니다."
                      : "선택한 기준으로 중복을 제거한 최종 정리 파일입니다."}
                  </p>
                </div>
              </div>

              <div className={styles.resultDownloadAction}>
                <button
                  type="button"
                  className={`${styles.downloadButton} ${styles.downloadButtonDark}`}
                  onClick={downloadAppendableNewFile}
                >
                  {result.mode === "compare"
                    ? `신규 추가 대상 다운로드 (${result.stats.finalNewCount.toLocaleString()}건)`
                    : `정리 결과 다운로드 (${result.stats.finalNewCount.toLocaleString()}건)`}
                </button>
              </div>
            </div>

            {result.mode === "compare" ? (
              <div className={styles.resultDownloadCard} data-featured="true">
                <div className={styles.resultDownloadBody}>
                  <div className={styles.resultDownloadText}>
                    <span className={styles.resultDownloadEyebrow}>최종 전체 DB 파일</span>
                    <strong>{result.finalMergedFileName}</strong>

                    <div className={styles.downloadMetaList}>
                      <div className={styles.downloadMetaItem}>
                        <span>기존 원본</span>
                        <strong>{result.stats.existingOriginalCount.toLocaleString()}건</strong>
                      </div>
                      <div className={styles.downloadMetaItem}>
                        <span>기존 중복 제거</span>
                        <strong>- {result.stats.existingRemovedInStepCount.toLocaleString()}건</strong>
                      </div>
                      <div className={styles.downloadMetaItem}>
                        <span>기존 정리본</span>
                        <strong>{result.stats.existingStepCount.toLocaleString()}건</strong>
                      </div>
                      <div className={styles.downloadMetaItem}>
                        <span>신규 추가</span>
                        <strong>+ {result.stats.finalNewCount.toLocaleString()}건</strong>
                      </div>
                      <div className={styles.downloadMetaItem} data-strong="true">
                        <span>최종 전체 DB</span>
                        <strong>{result.stats.mergedFinalCount.toLocaleString()}건</strong>
                      </div>
                    </div>

                    <p>
                      {result.stats.existingStepCount.toLocaleString()}건 기존 정리본 +{" "}
                      {result.stats.finalNewCount.toLocaleString()}건 신규 추가 ={" "}
                      {result.stats.mergedFinalCount.toLocaleString()}건 최종 DB
                    </p>
                  </div>
                </div>

                <div className={styles.resultDownloadAction}>
                  <button
                    type="button"
                    className={`${styles.downloadButton} ${styles.downloadButtonLight}`}
                    onClick={downloadFinalMergedFile}
                  >
                    최종 전체 DB 다운로드 ({result.stats.mergedFinalCount.toLocaleString()}건)
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
