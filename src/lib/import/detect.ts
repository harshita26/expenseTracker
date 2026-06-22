import type { ImportType } from "@/types";

const TXN_HEADERS = ["date", "transaction date", "txn date", "posting date", "debit", "credit", "amount", "description", "narration", "remarks"];
const MONTH_HEADERS = ["month", "period"];
const SUMMARY_FIELDS = ["salary", "income", "expense", "savings", "cashback", "interest"];

export interface DetectResult {
  type: ImportType;
  confidence: number;
  notes: string;
  fieldMap?: {
    date?: string;
    month?: string;
    description?: string;
    amount?: string;
    direction?: string;
    category?: string;
    salary?: string;
    otherIncome?: string;
    expense?: string;
    savings?: string;
    cashback?: string;
    interest?: string;
    notes?: string;
    account?: string;
    categoryColumns?: string[];
  };
}

function norm(s: string) { return s.toLowerCase().trim(); }

export function detectImportType(headers: string[]): DetectResult {
  const lc = headers.map(norm);
  const has = (...keys: string[]) => keys.some((k) => lc.some((h) => h === k || h.includes(k)));
  const find = (...keys: string[]) =>
    headers.find((h) => keys.some((k) => norm(h) === k || norm(h).includes(k)));

  const hasDate = has("date", "transaction date", "txn date", "posting date");
  const hasMonth = has("month", "period");
  const hasAmount = has("amount", "debit", "credit");
  const hasDescription = has("description", "narration", "remarks", "particulars");

  // detailed transactions?
  if (hasDate && (hasAmount || hasDescription)) {
    return {
      type: "detailed_transactions",
      confidence: 0.9,
      notes: "Detected date + transaction columns",
      fieldMap: {
        date: find("date", "transaction date", "txn date", "posting date"),
        description: find("description", "narration", "remarks", "particulars"),
        amount: find("amount", "debit", "credit"),
        category: find("category", "type"),
      },
    };
  }

  // monthly?
  if (hasMonth) {
    const summaryHits = SUMMARY_FIELDS.filter((f) => has(f)).length;
    // Find non-summary columns that aren't 'month' — likely categories
    const categoryColumns = headers.filter((h) => {
      const n = norm(h);
      if (MONTH_HEADERS.includes(n) || n.includes("month") || n === "year" || n === "notes") return false;
      if (SUMMARY_FIELDS.some((f) => n === f || n.includes(f))) return false;
      return true;
    });

    if (summaryHits >= 2 && categoryColumns.length === 0) {
      return {
        type: "monthly_summary",
        confidence: 0.9,
        notes: "Detected month + summary totals",
        fieldMap: {
          month: find("month", "period"),
          salary: find("salary"),
          otherIncome: find("income"),
          expense: find("expense"),
          savings: find("savings"),
          cashback: find("cashback"),
          interest: find("interest"),
          notes: find("notes"),
        },
      };
    }
    if (categoryColumns.length >= 2) {
      return {
        type: "monthly_category_summary",
        confidence: 0.8,
        notes: "Detected month + per-category columns",
        fieldMap: {
          month: find("month", "period"),
          salary: find("salary"),
          otherIncome: find("income"),
          cashback: find("cashback"),
          interest: find("interest"),
          categoryColumns,
        },
      };
    }
    return {
      type: "monthly_summary",
      confidence: 0.5,
      notes: "Month column detected, please verify mapping",
      fieldMap: { month: find("month", "period") },
    };
  }

  return {
    type: "manual_mapping",
    confidence: 0.3,
    notes: "Unable to auto-detect — please map columns manually",
  };
}
