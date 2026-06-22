import type { DetectResult } from "./detect";

export interface BankPreset {
  id: string;
  name: string;
  /** human label e.g. "Bank statement" / "Credit card statement" */
  kind: "bank" | "credit_card";
  /** Strings (lowercased) we expect to find among headers / first rows to auto-pick this preset. */
  headerSignals: string[];
  /** Column synonyms — first match wins when applying field map. */
  columns: {
    date?: string[];
    description?: string[];
    debit?: string[];
    credit?: string[];
    amount?: string[];
    balance?: string[];
    type?: string[]; // Cr/Dr indicator
  };
  /** Default account name suggestion for transactions imported via this preset. */
  defaultAccount?: string;
  /** Helpful note shown to user. */
  notes?: string;
}

export const BANK_PRESETS: BankPreset[] = [
  {
    id: "hdfc_savings",
    name: "HDFC Bank — Savings",
    kind: "bank",
    headerSignals: ["narration", "withdrawal amt", "deposit amt", "chq./ref.no"],
    columns: {
      date: ["Date", "Txn Date", "Value Dt"],
      description: ["Narration", "Description"],
      debit: ["Withdrawal Amt.", "Withdrawal Amt", "Debit"],
      credit: ["Deposit Amt.", "Deposit Amt", "Credit"],
      balance: ["Closing Balance", "Balance"],
    },
    defaultAccount: "HDFC Bank",
    notes: "Auto-pairs Withdrawal/Deposit columns into a single signed amount.",
  },
  {
    id: "icici_savings",
    name: "ICICI Bank — Savings",
    kind: "bank",
    headerSignals: ["transaction remarks", "withdrawal amount", "deposit amount"],
    columns: {
      date: ["Transaction Date", "Value Date", "Date"],
      description: ["Transaction Remarks", "Remarks", "Description"],
      debit: ["Withdrawal Amount (INR )", "Withdrawal Amount", "Debit"],
      credit: ["Deposit Amount (INR )", "Deposit Amount", "Credit"],
      balance: ["Balance (INR )", "Balance"],
    },
    defaultAccount: "ICICI Bank",
  },
  {
    id: "sbi_savings",
    name: "SBI — Savings",
    kind: "bank",
    headerSignals: ["txn date", "description", "debit", "credit", "balance"],
    columns: {
      date: ["Txn Date", "Value Date", "Date"],
      description: ["Description", "Narration"],
      debit: ["Debit", "Debit Amount"],
      credit: ["Credit", "Credit Amount"],
      balance: ["Balance"],
    },
    defaultAccount: "SBI",
  },
  {
    id: "axis_savings",
    name: "Axis Bank — Savings",
    kind: "bank",
    headerSignals: ["chq no", "particulars", "debit amount", "credit amount"],
    columns: {
      date: ["Tran Date", "Date", "Txn Date"],
      description: ["Particulars", "Description"],
      debit: ["Debit Amount", "Debit", "Withdrawal"],
      credit: ["Credit Amount", "Credit", "Deposit"],
      balance: ["Balance", "Closing Balance"],
    },
    defaultAccount: "Axis Bank",
  },
  {
    id: "kotak_savings",
    name: "Kotak Mahindra — Savings",
    kind: "bank",
    headerSignals: ["withdrawal(dr)", "deposit(cr)"],
    columns: {
      date: ["Date", "Txn Date"],
      description: ["Description", "Narration"],
      debit: ["Withdrawal(Dr)", "Debit"],
      credit: ["Deposit(Cr)", "Credit"],
      balance: ["Balance"],
    },
    defaultAccount: "Kotak Bank",
  },
  {
    id: "hdfc_credit_card",
    name: "HDFC — Credit Card",
    kind: "credit_card",
    headerSignals: ["domestic transactions", "international transactions", "merchant"],
    columns: {
      date: ["Date", "Transaction Date"],
      description: ["Description", "Merchant", "Particulars"],
      amount: ["Amount", "Amount (INR)"],
      type: ["Type", "Dr/Cr"],
    },
    defaultAccount: "HDFC Credit Card",
    notes: "Credit-card amounts default to expense unless marked Cr.",
  },
  {
    id: "axis_flipkart_cc",
    name: "Axis Bank — Flipkart / Magnus Credit Card",
    kind: "credit_card",
    headerSignals: ["merchant category", "transaction details"],
    columns: {
      date: ["Date", "Transaction Date"],
      description: ["Transaction Details", "Merchant", "Description"],
      amount: ["Amount (INR)", "Amount"],
      type: ["Debit/Credit", "Dr/Cr"],
    },
    defaultAccount: "Axis Flipkart Credit Card",
  },
  {
    id: "icici_amazon_pay_cc",
    name: "ICICI — Amazon Pay Credit Card",
    kind: "credit_card",
    headerSignals: ["transaction details", "reward points", "cashback"],
    columns: {
      date: ["Date", "Transaction Date"],
      description: ["Transaction Details", "Description"],
      amount: ["Amount (INR)", "Amount"],
      type: ["Dr/Cr"],
    },
    defaultAccount: "ICICI Amazon Pay Credit Card",
  },
  {
    id: "amex",
    name: "American Express",
    kind: "credit_card",
    headerSignals: ["amex", "card member name", "appears on your statement as"],
    columns: {
      date: ["Date", "Transaction Date"],
      description: ["Description", "Appears On Your Statement As"],
      amount: ["Amount"],
    },
    defaultAccount: "Amex Card",
    notes: "Amex statements show all charges as positive; payments appear as negative.",
  },
  {
    id: "sbi_credit_card",
    name: "SBI Card — Credit Card",
    kind: "credit_card",
    headerSignals: ["sbi card", "transaction details"],
    columns: {
      date: ["Date", "Transaction Date"],
      description: ["Transaction Details", "Description"],
      amount: ["Amount"],
      type: ["Dr/Cr"],
    },
    defaultAccount: "SBI Credit Card",
  },
];

export function matchPreset(headers: string[], sampleText?: string): BankPreset | null {
  const blob = (headers.join(" | ") + " " + (sampleText ?? "")).toLowerCase();
  let best: { p: BankPreset; score: number } | null = null;
  for (const p of BANK_PRESETS) {
    let score = 0;
    for (const s of p.headerSignals) if (blob.includes(s.toLowerCase())) score++;
    if (score === 0) continue;
    if (!best || score > best.score) best = { p, score };
  }
  return best?.p ?? null;
}

function findHeader(headers: string[], candidates: string[] | undefined): string | undefined {
  if (!candidates) return undefined;
  const lc = headers.map((h) => h.toLowerCase().trim());
  for (const cand of candidates) {
    const target = cand.toLowerCase().trim();
    const idx = lc.findIndex((h) => h === target);
    if (idx >= 0) return headers[idx];
  }
  for (const cand of candidates) {
    const target = cand.toLowerCase().trim();
    const idx = lc.findIndex((h) => h.includes(target) || target.includes(h));
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

export function applyPreset(preset: BankPreset, headers: string[]): DetectResult {
  const fm: DetectResult["fieldMap"] = {
    date: findHeader(headers, preset.columns.date),
    description: findHeader(headers, preset.columns.description),
    amount: findHeader(headers, preset.columns.amount),
  };
  // expose debit/credit through fieldMap.amount fallback — mapping.ts already auto-detects Debit/Credit columns by name
  return {
    type: "detailed_transactions",
    confidence: 0.95,
    notes: `Applied preset: ${preset.name}`,
    fieldMap: fm,
  };
}
