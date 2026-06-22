export type Direction = "income" | "expense" | "transfer";
export type MoneyType =
  | "salary"
  | "expense"
  | "cashback"
  | "interest"
  | "refund"
  | "transfer"
  | "investment"
  | "other_income"
  | "other_expense";

export interface Transaction {
  id: string;
  date: string; // ISO YYYY-MM-DD
  monthKey: string; // YYYY-MM
  year: number;
  month: number; // 1-12
  description: string;
  merchant?: string;
  amount: number;
  direction: Direction;
  moneyType: MoneyType;
  category: string;
  subcategory?: string;
  account?: string;
  paymentMethod?: string;
  notes?: string;
  isRecurring: boolean;
  tags: string[];
  source: string;
  importBatchId?: string;
  dedupeHash?: string; // sha-ish hash of (date|amount|normDescription)
  appliedRuleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategorizationRule {
  id: string;
  /** Substring (case-insensitive) or /regex/ pattern matched against description+merchant */
  pattern: string;
  isRegex: boolean;
  category: string;
  direction?: Direction;
  moneyType?: MoneyType;
  account?: string;
  priority: number; // higher wins
  isSystem: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlySummary {
  id: string;
  monthKey: string;
  year: number;
  month: number;
  salary: number;
  otherIncome: number;
  expense: number;
  savings: number | null;
  cashback: number;
  interest: number;
  openingBalance: number | null;
  closingBalance: number | null;
  notes?: string;
  source: string;
  importBatchId?: string;
  hasDetailedTransactions: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyCategorySummary {
  id: string;
  monthKey: string;
  year: number;
  month: number;
  category: string;
  amount: number;
  direction: Direction;
  notes?: string;
  source: string;
  importBatchId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: "bank" | "cash" | "credit_card" | "wallet" | "upi" | "investment";
  provider?: string;
  notes?: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense" | "both";
  parentCategory?: string;
  color?: string;
  icon?: string;
  isSystem: boolean;
}

export type ImportType =
  | "detailed_transactions"
  | "monthly_summary"
  | "monthly_category_summary"
  | "manual_mapping"
  | "text_import";

export interface ImportBatch {
  id: string;
  name: string;
  fileName: string;
  importType: ImportType;
  detectedFormat?: string;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  createdAt: string;
  notes?: string;
}

export interface AppSettings {
  id: string; // singleton "app"
  currency: string;
  theme: "dark" | "light";
  defaultAccount?: string;
  backupReminderEnabled: boolean;
  smartCategorySuggestions: boolean;
  demoSeeded: boolean;
}
