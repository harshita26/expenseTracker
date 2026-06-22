import Dexie, { type Table } from "dexie";
import type {
  Transaction,
  MonthlySummary,
  MonthlyCategorySummary,
  Account,
  Category,
  ImportBatch,
  AppSettings,
  CategorizationRule,
} from "@/types";

export class MyMoneyDB extends Dexie {
  transactions!: Table<Transaction, string>;
  monthly_summaries!: Table<MonthlySummary, string>;
  monthly_category_summaries!: Table<MonthlyCategorySummary, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  import_batches!: Table<ImportBatch, string>;
  app_settings!: Table<AppSettings, string>;
  categorization_rules!: Table<CategorizationRule, string>;

  constructor() {
    super("my_money_db");
    this.version(1).stores({
      transactions: "id, date, monthKey, year, month, category, direction, moneyType, account, importBatchId",
      monthly_summaries: "id, &monthKey, year, month, importBatchId",
      monthly_category_summaries: "id, monthKey, year, month, category, importBatchId",
      accounts: "id, name, type",
      categories: "id, &name, type",
      import_batches: "id, createdAt, importType",
      app_settings: "id",
    });
    this.version(2).stores({
      transactions: "id, date, monthKey, year, month, category, direction, moneyType, account, importBatchId, dedupeHash",
      categorization_rules: "id, pattern, category, priority, enabled",
    });
  }
}

export const db = new MyMoneyDB();
