// src/services/importService.ts
// v2.0 — CRITICAL FIX: removed expo-file-system/legacy import.
//
// expo-file-system/legacy ships ONLY .d.ts files in Expo SDK 54 — no compiled JS.
// Metro bundled it → satisfied TypeScript → crashed at runtime.
// Fix: all file reading now uses native fetch() on content:// URIs (same as
// ScanImportScreen.tsx). This works on Android without any native module.
//
// RULE: NEVER import expo-file-system or expo-file-system/legacy in this project.

import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SheetSummary {
  name: string;        // exact sheet tab name (emoji preserved)
  rowCount: number;    // data rows, excluding header
}

export interface WorkbookResult {
  workbook: XLSX.WorkBook;
  sheets: SheetSummary[];
  fileName: string;
}

export interface SheetData {
  headers: string[];    // trimmed column names
  rows: string[][];     // all values as strings; empty cells → ''
}

// ─── Internal: fetch-based file reading ──────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Read a file URI (content:// or file://) into a SheetJS WorkBook.
 * Uses native fetch() — no expo-file-system dependency.
 */
async function uriToWorkbook(uri: string, fileName: string): Promise<XLSX.WorkBook> {
  const isCSV = /\.(csv|tsv)$/i.test(fileName);
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not open file (HTTP ${response.status})`);

  if (isCSV) {
    const text = await response.text();
    if (!text || text.trim().length === 0) throw new Error('The file is empty.');
    return XLSX.read(text, { type: 'string' });
  } else {
    const blob = await response.blob();
    const b64 = await blobToBase64(blob);
    if (!b64) throw new Error('File read returned empty data.');
    return XLSX.read(b64, { type: 'base64', cellDates: true, raw: false });
  }
}

// ─── Step 1: Pick a file ─────────────────────────────────────────────────────

/**
 * Opens the system file picker.
 * Uses type:'*\/*' because Android MIME detection for .xlsx/.csv is unreliable.
 * Extension validation happens in readPickedFile() below.
 */
export async function pickFile(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

// ─── Step 2: Parse file into a workbook ──────────────────────────────────────

/**
 * Reads any .csv, .xlsx, .xls, or .xlsm file and returns a SheetJS workbook
 * plus a summary of all sheets with their row counts.
 */
export async function readPickedFile(asset: DocumentPicker.DocumentPickerAsset): Promise<WorkbookResult> {
  const fileName = asset.name ?? '';
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const supported = ['csv', 'xlsx', 'xls', 'xlsm', 'ods', 'tsv'];
  if (!supported.includes(ext)) {
    throw new Error(`Unsupported file type ".${ext}". Please select a .csv or .xlsx file.`);
  }

  const workbook = await uriToWorkbook(asset.uri, fileName);

  const sheets: SheetSummary[] = workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
    const dataRowCount = rows.slice(1).filter((r) =>
      r.some((cell: any) => cell !== null && cell !== undefined && cell !== '')
    ).length;
    return { name, rowCount: dataRowCount };
  });

  return { workbook, sheets, fileName };
}

// ─── Step 3: Extract data from a chosen sheet ────────────────────────────────

/**
 * Given a workbook and a sheet name, returns headers and all data rows.
 * Headers are trimmed; all values coerced to strings; dates → DD/MM/YYYY.
 */
export function extractSheetData(workbook: XLSX.WorkBook, sheetName: string): SheetData {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return { headers: [], rows: [] };

  const raw = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: null,
    raw: false,
    dateNF: 'dd/mm/yyyy',
  });

  if (raw.length === 0) return { headers: [], rows: [] };

  const headers: string[] = (raw[0] as any[]).map((h: any) =>
    (h !== null && h !== undefined ? String(h) : '').trim()
  );

  const rows: string[][] = raw.slice(1).map((row: any[]) =>
    headers.map((_, i) => {
      const cell = row[i];
      if (cell === null || cell === undefined) return '';
      if (cell instanceof Date) {
        const d = String(cell.getDate()).padStart(2, '0');
        const m = String(cell.getMonth() + 1).padStart(2, '0');
        return `${d}/${m}/${cell.getFullYear()}`;
      }
      return String(cell).trim();
    })
  );

  return { headers, rows };
}

// ─── Legacy helpers (fetch-based, no expo-file-system) ───────────────────────

/**
 * Legacy one-shot pick + read. For multi-sheet flows use
 * pickFile() + readPickedFile() + extractSheetData() instead.
 * Defaults to the FIRST sheet (intentional for legacy callers).
 */
export async function pickAndReadCSV(): Promise<SheetData | null> {
  const asset = await pickFile();
  if (!asset) return null;
  const { workbook } = await readPickedFile(asset);
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return null;
  return extractSheetData(workbook, firstSheet);
}

/**
 * Legacy helper matching the old ImportResult shape.
 * Defaults to the first sheet (intentional for legacy callers).
 */
export async function pickAndReadFile(): Promise<{
  headers: string[];
  rows: string[][];
  fileName: string;
  isExcel: boolean;
} | null> {
  const asset = await pickFile();
  if (!asset) return null;
  const fileName = asset.name ?? '';
  const isExcel = /\.(xlsx|xls|xlsm)$/i.test(fileName);
  const { workbook } = await readPickedFile(asset);
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return null;
  const { headers, rows } = extractSheetData(workbook, firstSheet);
  return { headers, rows, fileName, isExcel };
}

export function csvRowsToRecords(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}
