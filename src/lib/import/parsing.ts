import * as XLSX from "xlsx";
import Papa from "papaparse";
import { extractPdf } from "./pdf";

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  rawRows: unknown[][];
}

export interface ParsedFile {
  sheets: ParsedSheet[];
}

function rowsToObjects(raw: unknown[][]): { headers: string[]; rows: Record<string, unknown>[] } {
  if (!raw.length) return { headers: [], rows: [] };
  // Find first non-empty row as header
  let headerIdx = 0;
  while (headerIdx < raw.length && raw[headerIdx].every((c) => c == null || String(c).trim() === "")) {
    headerIdx++;
  }
  const headers = (raw[headerIdx] || []).map((h, i) => (h == null || String(h).trim() === "" ? `col_${i + 1}` : String(h).trim()));
  const rows = raw.slice(headerIdx + 1)
    .filter((r) => r.some((c) => c != null && String(c).trim() !== ""))
    .map((r) => {
      const o: Record<string, unknown> = {};
      headers.forEach((h, i) => { o[h] = r[i]; });
      return o;
    });
  return { headers, rows };
}

export async function parseExcelFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheets: ParsedSheet[] = wb.SheetNames.map((name) => {
    const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null, raw: true });
    const { headers, rows } = rowsToObjects(raw as unknown[][]);
    return { name, headers, rows, rawRows: raw as unknown[][] };
  });
  return { sheets };
}

export async function parseCsvFile(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const parsed = Papa.parse<unknown[]>(text, { skipEmptyLines: true });
  const raw = parsed.data as unknown[][];
  const { headers, rows } = rowsToObjects(raw);
  return { sheets: [{ name: "CSV", headers, rows, rawRows: raw }] };
}

export async function parsePdfFile(file: File): Promise<ParsedFile> {
  const { rows, headers, lines } = await extractPdf(file);
  if (rows.length === 0) {
    // Fall back to exposing raw text lines so the user can still see what was extracted.
    return { sheets: [{ name: "PDF (raw text)", headers: ["Line"], rows: lines.map((l) => ({ Line: l })), rawRows: [] }] };
  }
  return { sheets: [{ name: "PDF Statement", headers, rows, rawRows: [] }] };
}

export async function parseUploadedFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsvFile(file);
  if (name.endsWith(".pdf")) return parsePdfFile(file);
  return parseExcelFile(file);
}

/**
 * Parse pasted text. Handles either:
 *  - One line per transaction with day & month: "1 Jun Salary 54200"
 *  - One line per month summary: "Jan 2026 Salary 54000 Expense 32000 Savings 15000 Cashback 350 Interest 500"
 * Returns generic record rows; detection happens downstream.
 */
export function parsePastedText(text: string): { kind: "transactions" | "monthly"; rows: Record<string, unknown>[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // Heuristic: if most lines contain pairs like "Salary 1234" + "Expense 5678", treat as monthly summary
  const summaryRegex = /\b(salary|income|expense|savings|cashback|interest)\b/i;
  const summaryHits = lines.filter((l) => (l.match(summaryRegex) || []).length >= 1 && (l.match(/\d+/g) || []).length >= 2).length;

  if (summaryHits >= Math.max(1, Math.floor(lines.length * 0.6))) {
    const rows: Record<string, unknown>[] = lines.map((line) => {
      const obj: Record<string, unknown> = { raw: line };
      // capture month at start
      const mm = line.match(/^([A-Za-z]+(?:\s+\d{2,4})?|\d{4}-\d{1,2})/);
      if (mm) obj.Month = mm[1];
      const fields = ["salary", "income", "expense", "savings", "cashback", "interest"];
      for (const f of fields) {
        const re = new RegExp(`${f}[^0-9-]*(-?\\d+(?:[.,]\\d+)?)`, "i");
        const m = line.match(re);
        if (m) obj[f.charAt(0).toUpperCase() + f.slice(1)] = parseFloat(m[1].replace(/,/g, ""));
      }
      return obj;
    });
    return { kind: "monthly", rows };
  }

  // transactions: e.g. "1 Jun Salary 54200" or "2026-06-02 Rent 18000"
  const rows: Record<string, unknown>[] = lines.map((line) => {
    const obj: Record<string, unknown> = { raw: line };
    // try ISO date
    let m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.*?)\s+(-?\d+(?:[.,]\d+)?)\s*$/);
    if (m) {
      obj.Date = m[1]; obj.Description = m[2]; obj.Amount = parseFloat(m[3].replace(/,/g, ""));
      return obj;
    }
    // day + month name
    m = line.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(.*?)\s+(-?\d+(?:[.,]\d+)?)\s*$/);
    if (m) {
      obj.Day = +m[1]; obj.Month = m[2]; obj.Description = m[3]; obj.Amount = parseFloat(m[4].replace(/,/g, ""));
      return obj;
    }
    // fallback: just amount + description
    m = line.match(/^(.*?)\s+(-?\d+(?:[.,]\d+)?)\s*$/);
    if (m) {
      obj.Description = m[1]; obj.Amount = parseFloat(m[2].replace(/,/g, ""));
    }
    return obj;
  });
  return { kind: "transactions", rows };
}
