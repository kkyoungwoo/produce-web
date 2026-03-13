import * as XLSX from "xlsx";

import { formatCellValue, getColumnLabel } from "@/components/workbench/helpers";

const EXCEL_NO = "번호";
const MAX_SHEET_NAME_LENGTH = 31;

type WorkbookRow = Record<string, string | number>;
type SheetDefinition = {
  name: string;
  rows: WorkbookRow[];
};

type DownloadFlatExcelInput = {
  productSlug: string;
  suffix: string;
  rows: Array<Record<string, string | number>>;
  columns: string[];
  labelMap: Record<string, string>;
  sheetName?: string;
};

type DownloadGroupedExcelInput = {
  productSlug: string;
  suffix: string;
  allRows: Array<Record<string, string | number>>;
  groupedRows: Array<{ name: string; rows: Array<Record<string, string | number>> }>;
  columns: string[];
  labelMap: Record<string, string>;
};

function buildExcelRows(
  rows: Array<Record<string, string | number>>,
  columns: string[],
  labelMap: Record<string, string>,
) {
  return rows.map((row, index) => {
    const output: WorkbookRow = { [EXCEL_NO]: index + 1 };

for (const column of columns) {
  const label = getColumnLabel(column, labelMap);
  const rawValue = row[column];
  const formattedValue = column === "permitNo"
    ? String(rawValue ?? "")
    : formatCellValue(column, rawValue, row);

  output[label] = formattedValue;
}

    return output;
  });
}

function buildFileName(productSlug: string, suffix: string) {
  const now = new Date();
  const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}${String(now.getMilliseconds()).padStart(3, "0")}`;
  return `${datePart}_${productSlug}_${suffix}_${timePart}.xlsx`;
}

function sanitizeSheetName(name: string, usedNames: Set<string>) {
  const base = (name || "sheet")
    .replace(/[\\/?*\[\]:]/g, " ")
    .trim()
    .slice(0, MAX_SHEET_NAME_LENGTH) || "sheet";

  let candidate = base;
  let counter = 2;

  while (usedNames.has(candidate)) {
    const suffix = ` ${counter}`;
    candidate = `${base.slice(0, MAX_SHEET_NAME_LENGTH - suffix.length)}${suffix}`;
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

function writeWorkbook(productSlug: string, suffix: string, sheets: SheetDefinition[]) {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  const PERMIT_NO_HEADERS = new Set(["permitNo", "인허가번호"]);

  for (const sheet of sheets) {
    if (sheet.rows.length === 0) continue;

    const headers = Object.keys(sheet.rows[0] ?? {});
    const aoa: unknown[][] = [headers];

    for (const row of sheet.rows) {
      aoa.push(headers.map((header) => {
        const value = row[header];
        return PERMIT_NO_HEADERS.has(header) ? String(value ?? "") : value;
      }));
    }

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    for (let col = 0; col < headers.length; col += 1) {
      const header = headers[col];
      if (!PERMIT_NO_HEADERS.has(header)) continue;

      for (let rowIndex = 1; rowIndex < aoa.length; rowIndex += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: col });
        const textValue = String(aoa[rowIndex][col] ?? "");

        worksheet[cellAddress] = {
          t: "s",
          v: textValue,
          z: "@",
        };
      }
    }

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      sanitizeSheetName(sheet.name, usedNames),
    );
  }

  XLSX.writeFile(workbook, buildFileName(productSlug, suffix), {
    cellStyles: true,
  });
}

export function downloadFlatExcel({
  productSlug,
  suffix,
  rows,
  columns,
  labelMap,
  sheetName = "results",
}: DownloadFlatExcelInput) {
  if (rows.length === 0) return;

  writeWorkbook(productSlug, suffix, [
    {
      name: sheetName,
      rows: buildExcelRows(rows, columns, labelMap),
    },
  ]);
}

export function downloadGroupedExcel({
  productSlug,
  suffix,
  allRows,
  groupedRows,
  columns,
  labelMap,
}: DownloadGroupedExcelInput) {
  if (allRows.length === 0 || groupedRows.length === 0) return;

  writeWorkbook(productSlug, suffix, [
    {
      name: "전체",
      rows: buildExcelRows(allRows, columns, labelMap),
    },
    ...groupedRows.map((group) => ({
      name: group.name,
      rows: buildExcelRows(group.rows, columns, labelMap),
    })),
  ]);
}
