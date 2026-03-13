import * as XLSX from "xlsx";

export const ACCEPT = ".xlsx,.xls,.csv";
const CSV_ENCODINGS = ["utf-8", "euc-kr", "cp949"] as const;
const DUPLICATE_KEY_SEPARATOR = "||__DB_DUPLICATE_KEY__||";

type SpreadsheetCell = string | number | boolean | Date | null | undefined;
export type SpreadsheetRow = Record<string, SpreadsheetCell>;

export type ParsedSpreadsheet = {
  file: File;
  fileName: string;
  headers: string[];
  rows: SpreadsheetRow[];
  totalRows: number;
  fileSize: number;
  loadedAt: string;
};

export type BlankRemovedRowsResult = {
  rows: SpreadsheetRow[];
  removedCount: number;
  originalCount: number;
  finalCount: number;
};

export type DedupedRowsResult = {
  rows: SpreadsheetRow[];
  removedCount: number;
  originalCount: number;
  finalCount: number;
};

export type ExistingComparisonResult = {
  rows: SpreadsheetRow[];
  removedCount: number;
  sourceCount: number;
  finalCount: number;
};

export function formatDateTime(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function normalizeHeader(value: SpreadsheetCell) {
  return String(value ?? "").replace(/\uFEFF/g, "").trim();
}

export function normalizeCell(value: SpreadsheetCell) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  return String(value).trim();
}

export function normalizeForDuplicate(value: SpreadsheetCell) {
  const base = normalizeCell(value);
  if (!base) return "";

  return base
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\r?\n|\r|\t/g, "")
    .replace(/\s+/g, "")
    .replace(/[\-_~\u2010-\u2015]/g, "")
    .replace(/[()[\]{}<>【】「」『』〈〉《》]/g, "")
    .replace(/[.,/\\|'"`~!@#$%^&*+=?:;]+/g, "")
    .replace(/[^0-9a-z\u3131-\u318E\uAC00-\uD7A3]/g, "");
}

export function arrayRowToObject(headers: string[], row: SpreadsheetCell[]) {
  const out: SpreadsheetRow = {};

  headers.forEach((header, index) => {
    out[header] = row[index] ?? "";
  });

  return out;
}

export function removeExtension(fileName = "") {
  return String(fileName).replace(/\.[^.]+$/, "");
}

export function buildUpdatedFileName(fileName = "파일.xlsx", suffix = "수정됨") {
  const base = removeExtension(fileName);
  return `${base}_${suffix}.xlsx`;
}

export function safeSheetName(name = "Sheet1") {
  return String(name).replace(/[\\/?*:[\]]/g, "").slice(0, 31) || "Sheet1";
}

export function humanFileSize(bytes = 0) {
  if (!bytes || Number.isNaN(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uniqueHeaders(headers: string[] = []) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function mergeHeaders(existingHeaders: string[] = [], newHeaders: string[] = []) {
  return uniqueHeaders([...existingHeaders, ...newHeaders]);
}

async function readTextWithEncoding(file: File, encoding: string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽는 중 오류가 발생했습니다."));
    reader.readAsText(file, encoding);
  });
}

export async function readCsvWithFallback(file: File) {
  let lastError: unknown = null;

  for (const encoding of CSV_ENCODINGS) {
    try {
      const text = await readTextWithEncoding(file, encoding);

      return XLSX.read(text, {
        type: "string",
        codepage: encoding === "utf-8" ? 65001 : 949,
        raw: false,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("CSV 파일을 읽을 수 없습니다.");
}

export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  if (!file) throw new Error("파일이 없습니다.");

  const fileName = file.name.toLowerCase();
  let workbook: XLSX.WorkBook;

  if (fileName.endsWith(".csv")) {
    workbook = await readCsvWithFallback(file);
  } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, {
      type: "array",
      raw: false,
      cellDates: true,
    });
  } else {
    throw new Error("지원하지 않는 파일 형식입니다. xlsx, xls, csv 파일만 업로드해주세요.");
  }

  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) {
    throw new Error("헤더가 포함된 올바른 파일을 업로드해주세요.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error("헤더가 포함된 올바른 파일을 업로드해주세요.");
  }

  const aoa = XLSX.utils.sheet_to_json<SpreadsheetCell[]>(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });

  if (!Array.isArray(aoa) || aoa.length === 0) {
    throw new Error("헤더가 포함된 올바른 파일을 업로드해주세요.");
  }

  const headers = (aoa[0] ?? []).map(normalizeHeader);

  if (!headers.length || headers.every((value) => value === "")) {
    throw new Error("헤더가 포함된 올바른 파일을 업로드해주세요.");
  }

  if (headers.some((value) => value === "")) {
    throw new Error("빈 헤더명이 있습니다. 첫 번째 행의 컬럼명을 확인해주세요.");
  }

  const headerSet = new Set(headers);
  if (headerSet.size !== headers.length) {
    throw new Error("헤더명에 중복이 있습니다. 같은 이름의 컬럼이 없는 파일을 업로드해주세요.");
  }

  const rows = aoa
    .slice(1)
    .filter((row): row is SpreadsheetCell[] => Array.isArray(row))
    .map((row) => arrayRowToObject(headers, headers.map((_, index) => row[index] ?? "")));

  return {
    file,
    fileName: file.name,
    headers,
    rows,
    totalRows: rows.length,
    fileSize: file.size ?? 0,
    loadedAt: formatDateTime(),
  };
}

export function exportWorkbook(headers: string[], rows: SpreadsheetRow[], sheetName: string) {
  const data = [
    headers,
    ...rows.map((row) => headers.map((header) => row?.[header] ?? "")),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbook;
}

export function saveWorkbook(headers: string[], rows: SpreadsheetRow[], fileName: string, sheetName: string) {
  const workbook = exportWorkbook(headers, rows, sheetName);
  XLSX.writeFile(workbook, fileName, { compression: true });
}

export function createStableKeyFromHeaders(row: SpreadsheetRow, selectedHeaders: string[]) {
  const normalizedParts = [...selectedHeaders].map((header) => normalizeForDuplicate(row?.[header]));

  if (normalizedParts.length === 0 || normalizedParts.some((value) => value === "")) {
    return "";
  }

  return [...normalizedParts].sort().join(DUPLICATE_KEY_SEPARATOR);
}

export function removeRowsWithBlankDuplicateKey(rows: SpreadsheetRow[], selectedHeaders: string[]): BlankRemovedRowsResult {
  const keptRows: SpreadsheetRow[] = [];
  let removedCount = 0;

  for (const row of rows) {
    const key = createStableKeyFromHeaders(row, selectedHeaders);
    if (!key) {
      removedCount += 1;
      continue;
    }
    keptRows.push(row);
  }

  return {
    rows: keptRows,
    removedCount,
    originalCount: rows.length,
    finalCount: keptRows.length,
  };
}

export function dedupeWithinRowsKeepLast(rows: SpreadsheetRow[], selectedHeaders: string[]): DedupedRowsResult {
  const lastIndexMap = new Map<string, number>();

  for (let index = 0; index < rows.length; index += 1) {
    const key = createStableKeyFromHeaders(rows[index], selectedHeaders);
    if (!key) continue;
    lastIndexMap.set(key, index);
  }

  const keptRows: SpreadsheetRow[] = [];
  let removedCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const key = createStableKeyFromHeaders(row, selectedHeaders);

    if (!key) {
      removedCount += 1;
      continue;
    }

    if (lastIndexMap.get(key) === index) {
      keptRows.push(row);
    } else {
      removedCount += 1;
    }
  }

  return {
    rows: keptRows,
    removedCount,
    originalCount: rows.length,
    finalCount: keptRows.length,
  };
}

export function removeRowsDuplicatedAgainstExistingFlexible(
  sourceRows: SpreadsheetRow[],
  existingRows: SpreadsheetRow[],
  sourceHeaders: string[],
  existingHeaders: string[],
): ExistingComparisonResult {
  const existingKeySet = new Set<string>();

  for (const row of existingRows) {
    const key = createStableKeyFromHeaders(row, existingHeaders);
    if (!key) continue;
    existingKeySet.add(key);
  }

  const keptRows: SpreadsheetRow[] = [];
  let removedCount = 0;

  for (const row of sourceRows) {
    const key = createStableKeyFromHeaders(row, sourceHeaders);

    if (!key) {
      removedCount += 1;
      continue;
    }

    if (existingKeySet.has(key)) {
      removedCount += 1;
      continue;
    }

    keptRows.push(row);
  }

  return {
    rows: keptRows,
    removedCount,
    sourceCount: sourceRows.length,
    finalCount: keptRows.length,
  };
}