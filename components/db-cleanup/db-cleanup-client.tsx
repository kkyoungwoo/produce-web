"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import styles from "./db-cleanup.module.css";
import {
  ACCEPT,
  buildUpdatedFileName,
  dedupeWithinRowsKeepLast,
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

type DragTarget = "" | "new" | "existing";
type MetricTone = "neutral" | "good" | "minus" | "soft" | "plus" | "final";
type ChipTone = "neutral" | "success" | "dark";
type HeaderPanelAccent = "emerald" | "rose";

type ProcessResult = {
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
};

type HeaderSelectPanelProps = {
  title: string;
  description: string;
  headers: string[];
  selectedHeaders: string[];
  accent: HeaderPanelAccent;
  onToggle: (header: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
};

const FLOW_STEPS = [
  { title: "신규 업로드", description: "새로 확보한 DB" },
  { title: "1차 정리", description: "빈값 및 내부 중복 제거" },
  { title: "2차 비교", description: "기존 DB 중복 검증" },
  { title: "최종 저장", description: "신규 정리본 + 누적 DB" },
] as const;

const INFO_ITEMS = [
  { label: "비교 정규화", value: "공백 · 하이픈 · 괄호 · 특수문자 제거" },
  { label: "신규 내부 정리", value: "빈값 행 삭제 + 마지막 값 1개 유지" },
  { label: "누적 저장", value: "남은 신규 데이터만 기존 DB에 추가" },
] as const;

function formatDateTime(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function MetricCard({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: MetricTone }) {
  return (
    <div className={styles.metricCard} data-tone={tone}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      {sub ? <div className={styles.metricSub}>{sub}</div> : null}
    </div>
  );
}

function StatusChip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={styles.statusChip} data-tone={tone}>
      {children}
    </span>
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
        className={styles.uploadDropArea}
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
              <strong>파일을 드래그하거나 클릭해서 업로드</strong>
              <span>지원 형식: xlsx / xls / csv</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.uploadTitleGroup}>
              <span className={`${styles.uploadLabel} ${styles.uploadLabelSuccess}`}>업로드 완료</span>
              <h3 className={styles.uploadTitle} title={fileInfo.fileName}>{fileInfo.fileName}</h3>
              <p className={styles.uploadDescription}>
                {humanFileSize(fileInfo.fileSize)} · {fileInfo.totalRows.toLocaleString()}행 로드 완료
              </p>
            </div>

            <div className={styles.uploadedMeta}>
              <div className={styles.uploadedMetaItem}>
                <span>컬럼 수</span>
                <strong>{fileInfo.headers.length}개</strong>
              </div>
              <div className={styles.uploadedMetaItem}>
                <span>불러온 시각</span>
                <strong>{fileInfo.loadedAt}</strong>
              </div>
            </div>

            <div className={styles.uploadActionRow} onClick={(event) => event.stopPropagation()}>
              <button type="button" className={`${styles.inlineButton} ${styles.inlineButtonLight}`} onClick={() => inputRef.current?.click()}>
                파일 변경
              </button>
              <button type="button" className={`${styles.inlineButton} ${styles.inlineButtonDanger}`} onClick={onRemove}>
                제거
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
  onToggle,
  onSelectAll,
  onClearAll,
}: HeaderSelectPanelProps) {
  return (
    <section className={styles.selectPanel} data-accent={accent}>
      <div className={styles.sectionCardHead}>
        <div>
          <div className={styles.sectionEyebrow}>{accent === "emerald" ? "STEP 1" : "STEP 2"}</div>
          <h3 className={styles.sectionTitle}>{title}</h3>
          <p className={styles.sectionDescription}>{description}</p>
        </div>

        <div className={styles.pickedCounter}>
          <span>선택됨</span>
          <strong>{selectedHeaders.length}개</strong>
        </div>
      </div>

      <div className={styles.selectionToolbar}>
        <button type="button" className={styles.toolbarButton} onClick={onSelectAll}>전체 선택</button>
        <button type="button" className={styles.toolbarButton} onClick={onClearAll}>전체 해제</button>
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

export default function DbCleanupClient() {
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

  const bothFilesReady = Boolean(newFileInfo && existingFileInfo);
  const canProcess = bothFilesReady && newDuplicateHeaders.length > 0 && existingDuplicateHeaders.length > 0 && !isProcessing;

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
      setNewFileError(error instanceof Error ? error.message : "신규 데이터 파일을 읽는 중 오류가 발생했습니다.");
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
      setExistingFileError(error instanceof Error ? error.message : "기존 관리 파일을 읽는 중 오류가 발생했습니다.");
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

    setExistingDuplicateHeaders((prev) => (prev.includes(header) ? prev.filter((item) => item !== header) : [...prev, header]));
  };

  const validateSelections = () => {
    if (!newFileInfo || !existingFileInfo) {
      setGlobalError("신규 데이터 파일과 기존 관리 파일을 모두 등록해주세요.");
      return false;
    }

    if (newDuplicateHeaders.length === 0) {
      setGlobalError("신규 데이터 중복 제거 기준 컬럼을 1개 이상 선택해주세요.");
      return false;
    }

    if (existingDuplicateHeaders.length === 0) {
      setGlobalError("기존 데이터 비교 기준 컬럼을 1개 이상 선택해주세요.");
      return false;
    }

    return true;
  };

  const handleProcess = async () => {
    setGlobalError("");
    setResult(null);

    if (!validateSelections() || !newFileInfo || !existingFileInfo) return;

    setIsProcessing(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 140));

      const stepRemoveBlank = removeRowsWithBlankDuplicateKey(newFileInfo.rows, newDuplicateHeaders);
      const stepNewDedup = dedupeWithinRowsKeepLast(stepRemoveBlank.rows, newDuplicateHeaders);
      const stepExistingBlank = removeRowsWithBlankDuplicateKey(existingFileInfo.rows, existingDuplicateHeaders);
      const stepExistingDedup = dedupeWithinRowsKeepLast(stepExistingBlank.rows, existingDuplicateHeaders);
      const stepAgainstExisting = removeRowsDuplicatedAgainstExistingFlexible(
        stepNewDedup.rows,
        stepExistingDedup.rows,
        newDuplicateHeaders,
        existingDuplicateHeaders,
      );

      const finalNewRows = stepAgainstExisting.rows;
      const mergedHeaders = mergeHeaders(existingFileInfo.headers, newFileInfo.headers);
      const finalMergedRows = [...existingFileInfo.rows, ...finalNewRows];

      setResult({
        processedAt: formatDateTime(),
        selectedNewDuplicateHeaders: [...newDuplicateHeaders],
        selectedExistingDuplicateHeaders: [...existingDuplicateHeaders],
        finalNewRows,
        finalMergedRows,
        mergedHeaders,
        finalNewFileName: buildUpdatedFileName(newFileInfo.fileName, "신규정리"),
        finalMergedFileName: buildUpdatedFileName(existingFileInfo.fileName, "누적DB"),
        stats: {
          newOriginalCount: newFileInfo.rows.length,
          newInternalRemovedCount: stepRemoveBlank.removedCount + stepNewDedup.removedCount,
          newAfterInternalCount: stepNewDedup.finalCount,
          newRemovedAgainstExistingCount: stepAgainstExisting.removedCount,
          finalNewCount: finalNewRows.length,
          existingOriginalCount: existingFileInfo.rows.length,
          mergedFinalCount: finalMergedRows.length,
        },
      });
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.");
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
    if (!result || !result.mergedHeaders.length) return;

    saveWorkbook(
      result.mergedHeaders,
      result.finalMergedRows,
      result.finalMergedFileName,
      safeSheetName(removeExtension(result.finalMergedFileName)),
    );
  };

  const downloadBothFiles = () => {
    if (!result) return;
    downloadFinalNewFile();
    window.setTimeout(downloadFinalMergedFile, 220);
  };

  const progressText = useMemo(() => {
    if (isProcessing) return "신규 내부 중복과 빈값을 정리한 뒤 기존 DB와 비교 중입니다.";
    if (!newFileInfo && !existingFileInfo) return "신규 파일과 기존 관리 파일을 등록하면 바로 작업할 수 있습니다.";
    if (newFileInfo && !existingFileInfo) return "이제 기존 관리 파일만 등록하면 됩니다.";
    if (!newFileInfo && existingFileInfo) return "이제 신규 데이터 파일만 등록하면 됩니다.";
    if (canProcess) return "기준 컬럼 선택 완료. 최종 정리 실행 버튼을 누르세요.";
    return "신규 기준 컬럼과 기존 비교 컬럼을 각각 선택해주세요.";
  }, [isProcessing, newFileInfo, existingFileInfo, canProcess]);

  return (
    <div className={styles.root}>
      {isProcessing ? (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingModal}>
            <div className={styles.spinner} />
            <h3>최종 정리 실행 중</h3>
            <p>빈값 제거 → 신규 내부 중복 제거 → 기존 DB 비교 → 누적 DB 생성</p>
          </div>
        </div>
      ) : null}

      <section className={styles.heroSection}>
        <article className={`${styles.heroCard} ${styles.heroMain}`}>
          <div className={styles.eyebrow}>DB DUPLICATE REMOVER</div>
          <h1 className={styles.heroTitle}>
            중복은 걷어내고
            <br />
            쓸 수 있는 데이터만 남기는
            <br />
            누적형 DB 정리 도구
          </h1>
          <p className={styles.heroDescription}>
            신규 데이터 안에서 먼저 빈값과 중복을 정리하고, 기존 DB에 이미 있는 값은 한 번 더 걸러냅니다.
            최종적으로 살아남은 신규 데이터만 따로 저장하고, 그 데이터만 기존 DB에 누적합니다.
          </p>

          <div className={styles.flowRail}>
            {FLOW_STEPS.map((step, index) => (
              <div key={step.title} className={styles.flowRailItem}>
                <div className={styles.flowStep} data-final={index === FLOW_STEPS.length - 1}>
                  <b>{step.title}</b>
                  <span>{step.description}</span>
                </div>
                {index < FLOW_STEPS.length - 1 ? <i className={styles.flowConnector} /> : null}
              </div>
            ))}
          </div>
        </article>

        <aside className={`${styles.heroCard} ${styles.heroStatus}`}>
          <div className={styles.heroStatusTop}>
            <div className={styles.liveDot} />
            <strong>현재 상태</strong>
          </div>

          <p className={styles.heroStatusText}>{progressText}</p>

          <div className={styles.statusMetricGrid}>
            <MetricCard
              label="신규 파일"
              value={newFileInfo ? "등록됨" : "대기"}
              sub={newFileInfo ? `${newFileInfo.totalRows.toLocaleString()}행` : "업로드 필요"}
              tone={newFileInfo ? "good" : "neutral"}
            />
            <MetricCard
              label="기존 파일"
              value={existingFileInfo ? "등록됨" : "대기"}
              sub={existingFileInfo ? `${existingFileInfo.totalRows.toLocaleString()}행` : "업로드 필요"}
              tone={existingFileInfo ? "good" : "neutral"}
            />
          </div>

          <div className={styles.infoList}>
            {INFO_ITEMS.map((item) => (
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
          title="기존 관리 파일"
          description="중복 검증 기준이 되는 누적 DB 파일을 먼저 등록할 수 있습니다."
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
        />

        <UploadCard
          id="new-data-file"
          title="신규 데이터 파일"
          description="새로 확보한 DB 파일을 등록하세요. 첫 번째 시트 기준으로 불러옵니다."
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
        />
      </section>

      {newFileError || existingFileError ? (
        <section className={`${styles.messageCard} ${styles.messageCardError}`}>
          <div className={styles.messageTitle}>오류 안내</div>
          {newFileError ? <div className={styles.messageLine}>• {newFileError}</div> : null}
          {existingFileError ? <div className={styles.messageLine}>• {existingFileError}</div> : null}
          
        </section>
      ) : null}

      {bothFilesReady ? (
        <section className={`${styles.messageCard} ${styles.messageCardInfo}`}>
          <div className={styles.messageTitle}>작동 방식</div>
          <div className={styles.messageLine}>• 신규 기준 컬럼은 빈값 행 제거와 신규 데이터 내부 중복 제거에 사용됩니다.</div>
          <div className={styles.messageLine}>• 기존 기준 컬럼은 기존 DB에 이미 존재하는지 비교하는 검증용입니다.</div>
          <div className={styles.messageLine}>• 신규 파일과 기존 파일의 컬럼 구조가 달라도 각각 따로 선택해서 비교할 수 있습니다.</div>
          <div className={styles.messageLine}>• 선택한 기준 컬럼 중 하나라도 비어 있으면 해당 행은 자동으로 제외됩니다.</div>
        </section>
      ) : null}

      {bothFilesReady ? (
        <section className={styles.selectionStack}>
          <HeaderSelectPanel
            title="1차 신규 데이터 기준 컬럼"
            description="신규 데이터 내부에서 빈값과 중복을 먼저 정리할 컬럼입니다."
            headers={newFileInfo?.headers ?? []}
            selectedHeaders={newDuplicateHeaders}
            accent="emerald"
            onToggle={toggleNewDuplicateHeader}
            onSelectAll={() => setNewDuplicateHeaders([...(newFileInfo?.headers ?? [])])}
            onClearAll={() => setNewDuplicateHeaders([])}
          />

          <HeaderSelectPanel
            title="2차 기존 데이터 비교 기준 컬럼"
            description="정리된 신규 데이터가 기존 DB에 이미 있는지 비교할 컬럼입니다."
            headers={existingFileInfo?.headers ?? []}
            selectedHeaders={existingDuplicateHeaders}
            accent="rose"
            onToggle={toggleExistingDuplicateHeader}
            onSelectAll={() => setExistingDuplicateHeaders([...(existingFileInfo?.headers ?? [])])}
            onClearAll={() => setExistingDuplicateHeaders([])}
          />

          <div className={styles.actionBar}>
            <div className={styles.actionBarText}>
              <strong>최종 정리 준비</strong>
              <span>선택한 기준으로 신규 정리본과 누적 DB를 생성합니다.</span>
            </div>

            <div className={styles.actionBarButtons}>
              <button type="button" className={styles.mainButton} onClick={handleProcess} disabled={!canProcess}>
                {isProcessing ? "처리 중..." : "최종 정리 실행"}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={resetAll}>
                전체 초기화
              </button>
            </div>
          </div>

          {globalError ? (
            <section className={`${styles.messageCard} ${styles.messageCardError}`}>
              <div className={styles.messageTitle}>오류 안내</div>
              <div className={styles.messageLine}>• {globalError}</div>
            </section>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <>
          <section className={styles.resultSection}>
            <div className={styles.resultTop}>
              <div>
                <div className={`${styles.eyebrow} ${styles.eyebrowBlue}`}>FINAL RESULT</div>
                <h2 className={styles.resultTitle}>최종 정리 결과</h2>
                <p className={styles.resultTime}>{result.processedAt}</p>
              </div>

              <button type="button" className={styles.downloadAllButton} onClick={downloadBothFiles}>
                결과 파일 2개 모두 다운로드
              </button>
            </div>

            <div className={styles.criteriaWrap}>
              <div className={styles.criteriaCard}>
                <span>신규 기준 컬럼</span>
                <strong>{result.selectedNewDuplicateHeaders.join(" + ")}</strong>
              </div>
              <div className={styles.criteriaCard}>
                <span>기존 비교 기준 컬럼</span>
                <strong>{result.selectedExistingDuplicateHeaders.join(" + ")}</strong>
              </div>
            </div>

            <div className={styles.resultStatsGrid}>
              <MetricCard label="신규 원본 데이터" value={result.stats.newOriginalCount.toLocaleString()} tone="neutral" />
              <MetricCard label="신규 내부 정리 제거" value={`- ${result.stats.newInternalRemovedCount.toLocaleString()}`} tone="minus" />
              <MetricCard label="1차 정리 후 신규" value={result.stats.newAfterInternalCount.toLocaleString()} tone="soft" />
              <MetricCard label="기존 DB 중복 제거" value={`- ${result.stats.newRemovedAgainstExistingCount.toLocaleString()}`} tone="minus" />
              <MetricCard label="최종 신규 데이터" value={`+ ${result.stats.finalNewCount.toLocaleString()}`} tone="plus" />
              <MetricCard label="업데이트된 전체 DB" value={result.stats.mergedFinalCount.toLocaleString()} tone="final" />
            </div>
          </section>

          <section className={styles.downloadGrid}>
            <div className={`${styles.downloadCard} ${styles.downloadCardBright}`}>
              <div className={styles.downloadTopRow}>
                <span className={`${styles.downloadPill} ${styles.downloadPillBright}`}>결과 파일 1</span>
                <StatusChip tone="success">영업용 신규 정리본</StatusChip>
              </div>

              <h3 className={styles.downloadTitle}>{result.finalNewFileName}</h3>

              <div className={styles.downloadDescList}>
                <div>선택한 기준 컬럼의 빈값 행 제거 완료</div>
                <div>신규 데이터 내부 중복 제거 완료</div>
                <div>기존 DB에 이미 있는 데이터 제거 완료</div>
                <div>실제로 활용 가능한 신규 데이터만 포함</div>
              </div>

              <button type="button" className={`${styles.downloadButton} ${styles.downloadButtonDark}`} onClick={downloadFinalNewFile}>
                신규 데이터 정리본 다운로드
              </button>
            </div>

            <div className={`${styles.downloadCard} ${styles.downloadCardDark}`}>
              <div className={styles.downloadTopRow}>
                <span className={`${styles.downloadPill} ${styles.downloadPillDark}`}>결과 파일 2</span>
                <StatusChip tone="dark">누적 관리 DB</StatusChip>
              </div>

              <h3 className={styles.downloadTitle}>{result.finalMergedFileName}</h3>

              <div className={`${styles.downloadDescList} ${styles.downloadDescListDark}`}>
                <div>기존 데이터는 유지</div>
                <div>남은 신규 데이터만 누적 추가</div>
                <div>기존 헤더 + 신규 헤더 통합 저장</div>
                <div>다음 작업용 기준 DB로 재사용 가능</div>
              </div>

              <button type="button" className={`${styles.downloadButton} ${styles.downloadButtonLight}`} onClick={downloadFinalMergedFile}>
                누적 DB 다운로드
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
