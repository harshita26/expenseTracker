// PDF statement extraction using pdfjs-dist (text-based PDFs only; scanned PDFs need OCR).
import * as pdfjs from "pdfjs-dist";
// Vite resolves ?url to a string URL for the worker bundle.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfExtraction {
  fullText: string;
  lines: string[];
  rows: Record<string, unknown>[];
  headers: string[];
}

/**
 * Heuristic line parser. Supports common shapes:
 *  - "12/06/2026 SWIGGY BANGALORE 480.00 Dr"
 *  - "12-06-2026 NEFT-HDFC0000123-... 18,000.00 25,400.00"
 *  - "2026-06-12  Amazon Purchase  -2,100.00"
 */
const DATE_RE_GROUP = "(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})";
const AMOUNT_RE = /(-?\(?\d{1,3}(?:[,\d]{0,12})(?:\.\d{1,2})?\)?)/g;

function cleanAmount(s: string): number {
  const neg = s.startsWith("(") && s.endsWith(")");
  const n = parseFloat(s.replace(/[(),]/g, ""));
  return isNaN(n) ? 0 : (neg ? -n : n);
}

function parseStatementLine(line: string): Record<string, unknown> | null {
  const dateMatch = line.match(new RegExp("^\\s*" + DATE_RE_GROUP));
  if (!dateMatch) return null;
  const date = dateMatch[1];
  const rest = line.slice(dateMatch[0].length).trim();
  // Find all amount-like tokens
  const amts = [...rest.matchAll(AMOUNT_RE)].map((m) => ({ raw: m[0], idx: m.index ?? 0, val: cleanAmount(m[0]) }));
  if (amts.length === 0) return null;
  const last = amts[amts.length - 1];
  // Description = everything up to first amount token
  const firstAmtIdx = amts[0].idx;
  const description = rest.slice(0, firstAmtIdx).trim().replace(/\s{2,}/g, " ");
  if (!description) return null;
  // Heuristics:
  //  3+ amounts → likely (debit, credit, balance) or (amount, balance, ...)
  //  2 amounts → (amount, balance)
  //  1 amount → amount
  const row: Record<string, unknown> = { Date: date, Description: description };
  if (amts.length >= 3) {
    const [a, b, c] = amts;
    // bank-style: debit | credit | balance — one of debit/credit is 0
    row.Debit = a.val || 0;
    row.Credit = b.val || 0;
    row.Balance = c.val;
    if (!row.Debit && !row.Credit) row.Amount = a.val;
  } else if (amts.length === 2) {
    row.Amount = amts[0].val;
    row.Balance = last.val;
  } else {
    row.Amount = last.val;
  }
  // Detect Dr/Cr marker at end
  if (/\bDr\.?\b/i.test(line)) row.Type = "Dr";
  else if (/\bCr\.?\b/i.test(line)) row.Type = "Cr";
  return row;
}

export async function extractPdf(file: File): Promise<PdfExtraction> {
  const buf = await file.arrayBuffer();
  const pdf = await (pdfjs as any).getDocument({ data: buf }).promise;
  const allLines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group items by y-position to reconstruct lines
    const items = content.items as Array<{ str: string; transform: number[] }>;
    const lineMap = new Map<number, { x: number; str: string }[]>();
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x, str: it.str });
    }
    const ys = [...lineMap.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const parts = lineMap.get(y)!.sort((a, b) => a.x - b.x).map((p) => p.str);
      const line = parts.join(" ").replace(/\s+/g, " ").trim();
      if (line) allLines.push(line);
    }
  }
  const rows: Record<string, unknown>[] = [];
  for (const line of allLines) {
    const r = parseStatementLine(line);
    if (r) rows.push(r);
  }
  // Determine headers from union of keys
  const headerSet = new Set<string>();
  for (const r of rows) Object.keys(r).forEach((k) => headerSet.add(k));
  const preferredOrder = ["Date", "Description", "Debit", "Credit", "Amount", "Balance", "Type"];
  const headers = preferredOrder.filter((h) => headerSet.has(h));
  return { fullText: allLines.join("\n"), lines: allLines, rows, headers };
}
