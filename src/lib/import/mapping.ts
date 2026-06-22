import { v4 as uuid } from "uuid";
import type {
  ImportBatch, ImportType, MonthlyCategorySummary, MonthlySummary, Transaction, Direction, MoneyType,
} from "@/types";
import { db } from "@/db/dexie";
import { dateToParts, monthKey, parseLooseMonth } from "../month";
import type { DetectResult } from "./detect";
import { matchRule, type CompiledRule } from "./rules";

function normalizeText(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

export function dedupeHashFor(date: string, amount: number, description: string): string {
  return `${date}|${amount.toFixed(2)}|${normalizeText(description).slice(0, 60)}`;
}

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[₹,$,\s]/g, "").replace(/[(]/g, "-").replace(/[)]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function toAbs(v: unknown) { return Math.abs(toNumber(v)); }

function inferDirection(row: Record<string, unknown>, amountField?: string): { direction: Direction; amount: number; moneyType: MoneyType; category?: string } {
  const desc = String(row.Description ?? row.description ?? row.Narration ?? "").toLowerCase();
  const typeCol = String(row.Type ?? row.type ?? row.Direction ?? "").toLowerCase();
  const debit = toNumber(row.Debit ?? row.debit);
  const credit = toNumber(row.Credit ?? row.credit);
  const amount = amountField ? toNumber(row[amountField]) : toNumber(row.Amount ?? row.amount);

  let direction: Direction = "expense";
  let absAmount = Math.abs(amount);
  if (debit > 0 && credit === 0) { direction = "expense"; absAmount = debit; }
  else if (credit > 0 && debit === 0) { direction = "income"; absAmount = credit; }
  else if (typeCol.includes("credit") || typeCol.includes("income")) direction = "income";
  else if (typeCol.includes("debit") || typeCol.includes("expense")) direction = "expense";
  else if (amount < 0) { direction = "expense"; }
  else if (amount > 0 && (desc.includes("salary") || desc.includes("cashback") || desc.includes("interest") || desc.includes("refund"))) direction = "income";

  let moneyType: MoneyType = direction === "income" ? "other_income" : "expense";
  let category: string | undefined;
  if (/salary/.test(desc)) { moneyType = "salary"; category = "Salary"; direction = "income"; }
  else if (/cashback/.test(desc)) { moneyType = "cashback"; category = "Cashback"; direction = "income"; }
  else if (/interest/.test(desc)) { moneyType = "interest"; category = "Interest"; direction = "income"; }
  else if (/refund/.test(desc)) { moneyType = "refund"; category = "Refund"; direction = "income"; }

  return { direction, amount: absAmount, moneyType, category };
}

function parseDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export interface MapOptions {
  fieldMap: NonNullable<DetectResult["fieldMap"]>;
  fallbackYear?: number;
  dateRule?: "summary" | "first_of_month" | "last_of_month";
  defaultAccount?: string;
  rules?: CompiledRule[];
  /** Skip rows whose dedupe hash already exists in DB or earlier in the batch. */
  dedupe?: boolean;
  /** Existing hashes for cross-batch dedupe (pre-loaded by caller). */
  existingHashes?: Set<string>;
}

export interface MapResult<T> {
  rows: T[];
  skipped: { row: Record<string, unknown>; reason: string }[];
  duplicates?: number;
}

export function mapRowsToTransactions(
  rows: Record<string, unknown>[],
  opts: MapOptions,
  batchId: string,
): MapResult<Transaction> {
  const out: Transaction[] = [];
  const skipped: MapResult<Transaction>["skipped"] = [];
  const now = new Date().toISOString();
  const seenHashes = new Set<string>(opts.existingHashes ?? []);
  let duplicates = 0;
  for (const r of rows) {
    const dateRaw = opts.fieldMap.date ? r[opts.fieldMap.date] : r.Date ?? r.date;
    const iso = parseDate(dateRaw);
    if (!iso) { skipped.push({ row: r, reason: "invalid_date" }); continue; }
    const inferred = inferDirection(r, opts.fieldMap.amount);
    if (!inferred.amount) { skipped.push({ row: r, reason: "no_amount" }); continue; }
    const desc = String(r[opts.fieldMap.description ?? "Description"] ?? r.Description ?? r.description ?? r.Narration ?? "Imported").trim() || "Imported";
    const merchant = String(r.Merchant ?? r.merchant ?? "").trim() || undefined;

    // Apply categorization rules against description + merchant
    const ruleMatch = opts.rules?.length ? matchRule(`${desc} ${merchant ?? ""}`, opts.rules) : null;

    const direction: Direction = ruleMatch?.direction ?? inferred.direction;
    const moneyType: MoneyType = ruleMatch?.moneyType ?? inferred.moneyType;
    const cat = (ruleMatch?.category
      ?? String(r[opts.fieldMap.category ?? "Category"] ?? r.Category ?? inferred.category ?? (direction === "income" ? "Other Income" : "Miscellaneous")).trim()) || "Miscellaneous";
    const account = ruleMatch?.account ?? opts.defaultAccount;

    const hash = dedupeHashFor(iso, inferred.amount, desc);
    if (opts.dedupe && seenHashes.has(hash)) { duplicates++; skipped.push({ row: r, reason: "duplicate" }); continue; }
    seenHashes.add(hash);

    const parts = dateToParts(iso);
    out.push({
      id: uuid(),
      date: iso, monthKey: parts.monthKey, year: parts.year, month: parts.month,
      description: desc,
      merchant,
      amount: inferred.amount,
      direction,
      moneyType,
      category: cat,
      account,
      isRecurring: false,
      tags: [],
      source: "excel_import",
      importBatchId: batchId,
      dedupeHash: hash,
      appliedRuleId: ruleMatch?.ruleId,
      createdAt: now, updatedAt: now,
    });
  }
  return { rows: out, skipped, duplicates };
}

export function mapRowsToMonthlySummaries(
  rows: Record<string, unknown>[],
  opts: MapOptions,
  batchId: string,
): MapResult<MonthlySummary> {
  const out: MonthlySummary[] = [];
  const skipped: MapResult<MonthlySummary>["skipped"] = [];
  const now = new Date().toISOString();
  const fm = opts.fieldMap;
  for (const r of rows) {
    const monthRaw = String(r[fm.month ?? "Month"] ?? r.Month ?? r.month ?? "");
    const parsed = parseLooseMonth(monthRaw, opts.fallbackYear);
    if (!parsed) { skipped.push({ row: r, reason: "invalid_month" }); continue; }
    if ("needsYear" in parsed) { skipped.push({ row: r, reason: "missing_year" }); continue; }
    const { year, month } = parsed;
    out.push({
      id: uuid(),
      monthKey: monthKey(year, month),
      year, month,
      salary: fm.salary ? toAbs(r[fm.salary]) : 0,
      otherIncome: fm.otherIncome ? toAbs(r[fm.otherIncome]) : 0,
      expense: fm.expense ? toAbs(r[fm.expense]) : 0,
      savings: fm.savings ? toAbs(r[fm.savings]) : null,
      cashback: fm.cashback ? toAbs(r[fm.cashback]) : 0,
      interest: fm.interest ? toAbs(r[fm.interest]) : 0,
      openingBalance: null,
      closingBalance: null,
      notes: fm.notes ? String(r[fm.notes] ?? "") : undefined,
      source: "monthly_excel_import",
      importBatchId: batchId,
      hasDetailedTransactions: false,
      createdAt: now, updatedAt: now,
    });
  }
  return { rows: out, skipped };
}

export function mapRowsToMonthlyCategorySummaries(
  rows: Record<string, unknown>[],
  opts: MapOptions,
  batchId: string,
): { categoryRows: MonthlyCategorySummary[]; summaryRows: MonthlySummary[]; skipped: MapResult<unknown>["skipped"] } {
  const categoryRows: MonthlyCategorySummary[] = [];
  const summaryRows: MonthlySummary[] = [];
  const skipped: MapResult<unknown>["skipped"] = [];
  const now = new Date().toISOString();
  const fm = opts.fieldMap;
  const catCols = fm.categoryColumns ?? [];

  for (const r of rows) {
    const monthRaw = String(r[fm.month ?? "Month"] ?? "");
    const parsed = parseLooseMonth(monthRaw, opts.fallbackYear);
    if (!parsed || "needsYear" in parsed) { skipped.push({ row: r, reason: "invalid_month" }); continue; }
    const { year, month } = parsed;
    const mk = monthKey(year, month);

    // store income summary fields into MonthlySummary if any
    const salary = fm.salary ? toAbs(r[fm.salary]) : 0;
    const otherIncome = fm.otherIncome ? toAbs(r[fm.otherIncome]) : 0;
    const cashback = fm.cashback ? toAbs(r[fm.cashback]) : 0;
    const interest = fm.interest ? toAbs(r[fm.interest]) : 0;
    if (salary || otherIncome || cashback || interest) {
      summaryRows.push({
        id: uuid(), monthKey: mk, year, month,
        salary, otherIncome, expense: 0, savings: null, cashback, interest,
        openingBalance: null, closingBalance: null,
        source: "monthly_excel_import", importBatchId: batchId,
        hasDetailedTransactions: false, createdAt: now, updatedAt: now,
      });
    }
    for (const col of catCols) {
      const amount = toAbs(r[col]);
      if (!amount) continue;
      categoryRows.push({
        id: uuid(), monthKey: mk, year, month,
        category: col, amount, direction: "expense",
        source: "monthly_excel_import", importBatchId: batchId,
        createdAt: now, updatedAt: now,
      });
    }
  }
  return { categoryRows, summaryRows, skipped };
}

export async function commitImport(args: {
  fileName: string;
  importType: ImportType;
  detectedFormat?: string;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  notes?: string;
  transactions?: Transaction[];
  summaries?: MonthlySummary[];
  categorySummaries?: MonthlyCategorySummary[];
}): Promise<ImportBatch> {
  const id = uuid();
  const batch: ImportBatch = {
    id,
    name: args.fileName,
    fileName: args.fileName,
    importType: args.importType,
    detectedFormat: args.detectedFormat,
    rowCount: args.rowCount,
    importedCount: args.importedCount,
    skippedCount: args.skippedCount,
    createdAt: new Date().toISOString(),
    notes: args.notes,
  };
  await db.import_batches.add(batch);
  if (args.transactions?.length) await db.transactions.bulkAdd(args.transactions.map((t) => ({ ...t, importBatchId: id })));
  if (args.summaries?.length) {
    // upsert by monthKey
    for (const s of args.summaries) {
      const existing = await db.monthly_summaries.where("monthKey").equals(s.monthKey).first();
      if (existing) {
        await db.monthly_summaries.put({ ...existing, ...s, id: existing.id, importBatchId: id });
      } else {
        await db.monthly_summaries.add({ ...s, importBatchId: id });
      }
    }
  }
  if (args.categorySummaries?.length) await db.monthly_category_summaries.bulkAdd(args.categorySummaries.map((c) => ({ ...c, importBatchId: id })));
  return batch;
}

export async function rollbackImport(batchId: string) {
  await db.transactions.where("importBatchId").equals(batchId).delete();
  await db.monthly_summaries.where("importBatchId").equals(batchId).delete();
  await db.monthly_category_summaries.where("importBatchId").equals(batchId).delete();
  await db.import_batches.delete(batchId);
}
