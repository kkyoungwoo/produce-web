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
  dedupeWithinRowsKeepLast,
  formatDateTime,
  humanFileSize,
  mergeHeaders,
  parseSpreadsheet,
  removeExtension,
  removeRowsDuplicatedAgainstExistingFlexible,
  removeRowsWithBlankDuplicateKey,
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

type ProcessResult = {
  mode: ProcessMode;
  processedAt: string;
  selectedNewDuplicateHeaders: string[];
  selectedExistingDuplicateHeaders: string[];
  finalNewRows: ParsedSpreadsheet["rows"];
  finalMergedRows: ParsedSpreadsheet["rows"];
  mergedHeaders: string[];
  finalNewFileName: string;
  finalMergedFileName: string;
  stats: {
    newOriginalCount: number;
    newInternalRemovedCount: number;
    newAfterInternalCount: number;
    newRemovedAgainstExistingCount: number;
    finalNewCount: number;
    existingOriginalCount: number;
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
  error: string;
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
  selectAllLabel: string;
  clearAllLabel: string;
  countSuffix: string;
  onToggle: (header: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
};

type DbCleanupClientProps = {
  labels: DbCleanupLabels;
};

function MetricCard({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: MetricTone }) {
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
  error,
  labels,
  countSuffix,
}: UploadCardProps) {
  return (
    <section className={styles.uploadCardWrap} data-drag={isDragOver} data-error={Boolean(error)}>
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
              <span className={`${styles.uploadLabel} ${styles.uploadLabelSuccess}`}>{labels.uploadedLabel}</span>
              <h3 className={styles.uploadTitle} title={fileInfo.fileName}>{fileInfo.fileName}</h3>
              <p className={styles.uploadDescription}>
                {humanFileSize(fileInfo.fileSize)} · {fileInfo.totalRows.toLocaleString()}{labels.rowsLoadedSuffix}
              </p>
            </div>

            <div className={styles.uploadedMeta}>
              <div className={styles.uploadedMetaItem}>
                <span>{labels.columnsLabel}</span>
                <strong>{fileInfo.headers.length.toLocaleString()}{countSuffix}</strong>
              </div>
              <div className={styles.uploadedMetaItem}>
                <span>{labels.loadedAtLabel}</span>
                <strong>{fileInfo.loadedAt}</strong>
              </div>
            </div>

            <div className={styles.uploadActionRow} onClick={(event) => event.stopPropagation()}>
              <button type="button" className={`${styles.inlineButton} ${styles.inlineButtonLight}`} onClick={() => inputRef.current?.click()}>
                {labels.changeFileLabel}
              </button>
              <button type="button" className={`${styles.inlineButton} ${styles.inlineButtonDanger}`} onClick={onRemove}>
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
  selectAllLabel,
  clearAllLabel,
  countSuffix,
  onToggle,
  onSelectAll,
  onClearAll,
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
          <strong>{selectedHeaders.length.toLocaleString()}{countSuffix}</strong>
        </div>
      </div>

      <div className={styles.selectionToolbar}>
        <button type="button" className={styles.toolbarButton} onClick={onSelectAll}>{selectAllLabel}</button>
        <button type="button" className={styles.toolbarButton} onClick={onClearAll}>{clearAllLabel}</button>
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
  const [dragTarget, setDragTarget] = useState<DragTarget>("");

  const compareMode = Boolean(newFileInfo && existingFileInfo);
  const singleMode = Boolean(newFileInfo && !existingFileInfo);
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
    newFileInfo
      && newDuplicateHeaders.length > 0
      && !isProcessing
      && (!existingFileInfo || (sharedHeaders.length > 0 && comparableExistingHeaders.length > 0)),
  );

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
    setDragTarget("");

    if (newFileInputRef.current) newFileInputRef.current.value = "";
    if (existingFileInputRef.current) existingFileInputRef.current.value = "";
  };

  const applyNewFile = async (file?: File) => {
    setNewFileError("");
    setGlobalError("");
    resetResult();
    if (!file) return;

    try {
      const parsed = await parseSpreadsheet(file);
      setNewFileInfo(parsed);
      setNewDuplicateHeaders([]);
    } catch (error) {
      setNewFileInfo(null);
      setNewFileError(error instanceof Error ? error.message : labels.errors.newFileReadFailed);
    }
  };

  const applyExistingFile = async (file?: File) => {
    setExistingFileError("");
    setGlobalError("");
    resetResult();
    if (!file) return;

    try {
      const parsed = await parseSpreadsheet(file);
      setExistingFileInfo(parsed);
      setExistingDuplicateHeaders([]);
    } catch (error) {
      setExistingFileInfo(null);
      setExistingFileError(error instanceof Error ? error.message : labels.errors.existingFileReadFailed);
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
    setNewDuplicateHeaders((prev) => (prev.includes(header) ? prev.filter((item) => item !== header) : [...prev, header]));
  };

  const toggleExistingDuplicateHeader = (header: string) => {
    setGlobalError("");
    resetResult();
    setExistingDuplicateHeaders((prev) => (prev.includes(header) ? prev.filter((item) => item !== header) : [...prev, header]));
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

    if (!existingFileInfo) {
      return true;
    }

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
      await new Promise((resolve) => setTimeout(resolve, 140));

      const stepRemoveBlank = removeRowsWithBlankDuplicateKey(newFileInfo.rows, newDuplicateHeaders);
      const stepNewDedup = dedupeWithinRowsKeepLast(stepRemoveBlank.rows, newDuplicateHeaders);

      if (!existingFileInfo) {
        const finalNewRows = stepNewDedup.rows;
        const fileNameBase = newFileInfo.fileName;

        setResult({
          mode: "single",
          processedAt: formatDateTime(),
          selectedNewDuplicateHeaders: [...newDuplicateHeaders],
          selectedExistingDuplicateHeaders: [],
          finalNewRows,
          finalMergedRows: finalNewRows,
          mergedHeaders: newFileInfo.headers,
          finalNewFileName: buildUpdatedFileName(fileNameBase, labels.result.fileSuffixes.first),
          finalMergedFileName: buildUpdatedFileName(fileNameBase, labels.result.fileSuffixes.second),
          stats: {
            newOriginalCount: newFileInfo.rows.length,
            newInternalRemovedCount: stepRemoveBlank.removedCount + stepNewDedup.removedCount,
            newAfterInternalCount: stepNewDedup.finalCount,
            newRemovedAgainstExistingCount: 0,
            finalNewCount: finalNewRows.length,
            existingOriginalCount: 0,
            mergedFinalCount: finalNewRows.length,
          },
        });
        return;
      }

      const stepCompareBlank = removeRowsWithBlankDuplicateKey(stepNewDedup.rows, comparableExistingHeaders);
      const stepCompareDedup = dedupeWithinRowsKeepLast(stepCompareBlank.rows, comparableExistingHeaders);
      const stepExistingBlank = removeRowsWithBlankDuplicateKey(existingFileInfo.rows, comparableExistingHeaders);
      const stepExistingDedup = dedupeWithinRowsKeepLast(stepExistingBlank.rows, comparableExistingHeaders);
      const stepAgainstExisting = removeRowsDuplicatedAgainstExistingFlexible(
        stepCompareDedup.rows,
        stepExistingDedup.rows,
        comparableExistingHeaders,
        comparableExistingHeaders,
      );

      const finalNewRows = stepAgainstExisting.rows;
      const mergedHeaders = mergeHeaders(existingFileInfo.headers, newFileInfo.headers);
      const finalMergedRows = [...existingFileInfo.rows, ...finalNewRows];
      const fileNameBase = existingFileInfo.fileName || newFileInfo.fileName;

      setResult({
        mode: "compare",
        processedAt: formatDateTime(),
        selectedNewDuplicateHeaders: [...newDuplicateHeaders],
        selectedExistingDuplicateHeaders: [...comparableExistingHeaders],
        finalNewRows,
        finalMergedRows,
        mergedHeaders,
        finalNewFileName: buildUpdatedFileName(fileNameBase, labels.result.fileSuffixes.first),
        finalMergedFileName: buildUpdatedFileName(fileNameBase, labels.result.fileSuffixes.second),
        stats: {
          newOriginalCount: newFileInfo.rows.length,
          newInternalRemovedCount: stepRemoveBlank.removedCount + stepNewDedup.removedCount,
          newAfterInternalCount: stepNewDedup.finalCount,
          newRemovedAgainstExistingCount: stepCompareBlank.removedCount + stepCompareDedup.removedCount + stepAgainstExisting.removedCount,
          finalNewCount: finalNewRows.length,
          existingOriginalCount: existingFileInfo.rows.length,
          mergedFinalCount: finalMergedRows.length,
        },
      });
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : labels.errors.processFailed);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadFinalNewFile = () => {
    if (!result || !newFileInfo?.headers.length) return;

    saveWorkbook(
      newFileInfo.headers,
      result.finalNewRows,
      result.finalNewFileName,
      safeSheetName(removeExtension(result.finalNewFileName)),
    );
  };

  const downloadFinalMergedFile = () => {
    if (!result || result.mode !== "compare" || !result.mergedHeaders.length) return;

    saveWorkbook(
      result.mergedHeaders,
      result.finalMergedRows,
      result.finalMergedFileName,
      safeSheetName(removeExtension(result.finalMergedFileName)),
    );
  };

  const downloadBothFiles = () => {
    if (!result || result.mode !== "compare") return;
    downloadFinalNewFile();
    window.setTimeout(downloadFinalMergedFile, 220);
  };

  const progressText = useMemo(() => {
    if (isProcessing) return labels.progress.processing;
    if (!newFileInfo && !existingFileInfo) return labels.progress.idle;
    if (!newFileInfo && existingFileInfo) return labels.progress.existingOnly;
    if (newFileInfo && !existingFileInfo) return labels.singleMode.progress;
    if (compareCompatibilityError) return compareCompatibilityError;
    if (canProcess) return labels.progress.ready;
    return labels.progress.selecting;
  }, [canProcess, compareCompatibilityError, existingFileInfo, isProcessing, labels.progress, labels.singleMode.progress, newFileInfo]);

  const infoLines = compareMode ? labels.messages.infoLines : singleMode ? labels.singleMode.infoLines : [];
  const actionDescription = compareMode ? labels.actionBar.description : labels.actionBar.singleDescription;

  return (
    <div className={styles.root}>
      {isProcessing ? (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingModal}>
            <div className={styles.spinner} />
            <h3>{labels.loading.title}</h3>
            <p>{labels.loading.description}</p>
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
              sub={existingFileInfo ? `${existingFileInfo.totalRows.toLocaleString()}${labels.statusMetrics.rowsSuffix}` : labels.statusMetrics.uploadNeeded}
              tone={existingFileInfo ? "good" : "neutral"}
            />
            <MetricCard
              label={labels.statusMetrics.newFile}
              value={newFileInfo ? labels.statusMetrics.ready : labels.statusMetrics.waiting}
              sub={newFileInfo ? `${newFileInfo.totalRows.toLocaleString()}${labels.statusMetrics.rowsSuffix}` : labels.statusMetrics.uploadNeeded}
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
          error={existingFileError}
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
          error={newFileError}
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
            <div key={line} className={styles.messageLine}>- {line}</div>
          ))}
        </section>
      ) : null}

      {newFileInfo ? (
        <section className={styles.selectionStack}>
          <HeaderSelectPanel
            title={labels.selection.newTitle}
            description={labels.selection.newDescription}
            headers={newFileInfo.headers}
            selectedHeaders={newDuplicateHeaders}
            accent="emerald"
            stepLabel={labels.selection.step1}
            pickedLabel={labels.selection.pickedLabel}
            selectAllLabel={labels.selection.selectAllLabel}
            clearAllLabel={labels.selection.clearAllLabel}
            countSuffix={labels.statusMetrics.countSuffix}
            onToggle={toggleNewDuplicateHeader}
            onSelectAll={() => setNewDuplicateHeaders([...newFileInfo.headers])}
            onClearAll={() => setNewDuplicateHeaders([])}
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
              selectAllLabel={labels.selection.selectAllLabel}
              clearAllLabel={labels.selection.clearAllLabel}
              countSuffix={labels.statusMetrics.countSuffix}
              onToggle={toggleExistingDuplicateHeader}
              onSelectAll={() => setExistingDuplicateHeaders([...sharedHeaders])}
              onClearAll={() => setExistingDuplicateHeaders([])}
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
              <h2 className={styles.resultTitle}>{labels.result.title}</h2>
              <p className={styles.resultTime}>{result.processedAt}</p>
            </div>

            {result.mode === "compare" ? (
              <button type="button" className={styles.downloadAllButton} onClick={downloadBothFiles}>
                {labels.result.downloadAllLabel}
              </button>
            ) : null}
          </div>

          <div className={styles.criteriaWrap}>
            <div className={styles.criteriaCard}>
              <span>{labels.result.newCriteriaLabel}</span>
              <strong>{result.selectedNewDuplicateHeaders.join(" + ")}</strong>
            </div>
            {result.mode === "compare" ? (
              <div className={styles.criteriaCard}>
                <span>{labels.result.existingCriteriaLabel}</span>
                <strong>{result.selectedExistingDuplicateHeaders.join(" + ")}</strong>
              </div>
            ) : null}
          </div>

          <div className={styles.resultStatsGrid}>
            <MetricCard label={labels.result.stats.newOriginal} value={result.stats.newOriginalCount.toLocaleString()} tone="neutral" />
            <MetricCard label={labels.result.stats.newRemoved} value={`- ${result.stats.newInternalRemovedCount.toLocaleString()}`} tone="minus" />
            <MetricCard label={labels.result.stats.newAfterFirstPass} value={result.stats.newAfterInternalCount.toLocaleString()} tone="soft" />
            {result.mode === "compare" ? <MetricCard label={labels.result.stats.existingRemoved} value={`- ${result.stats.newRemovedAgainstExistingCount.toLocaleString()}`} tone="minus" /> : null}
            <MetricCard label={labels.result.stats.finalNew} value={`+ ${result.stats.finalNewCount.toLocaleString()}`} tone="plus" />
            <MetricCard label={labels.result.stats.mergedTotal} value={result.stats.mergedFinalCount.toLocaleString()} tone="final" />
          </div>

          <div className={styles.resultDownloadPanel}>
            <div className={styles.resultDownloadCard}>
              <div className={styles.resultDownloadText}>
                <span className={styles.resultDownloadEyebrow}>{labels.result.cards.firstEyebrow}</span>
                <strong>{result.finalNewFileName}</strong>
                <p>{labels.result.cards.firstDescription}</p>
              </div>
              <button type="button" className={`${styles.downloadButton} ${styles.downloadButtonDark}`} onClick={downloadFinalNewFile}>
                {labels.result.cards.firstButton}
              </button>
            </div>

            {result.mode === "compare" ? (
              <div className={styles.resultDownloadCard}>
                <div className={styles.resultDownloadText}>
                  <span className={styles.resultDownloadEyebrow}>{labels.result.cards.secondEyebrow}</span>
                  <strong>{result.finalMergedFileName}</strong>
                  <p>{labels.result.cards.secondDescription}</p>
                </div>
                <button type="button" className={`${styles.downloadButton} ${styles.downloadButtonLight}`} onClick={downloadFinalMergedFile}>
                  {labels.result.cards.secondButton}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
