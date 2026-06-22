import { db } from "@/db/dexie";
import type { Account, Category, Transaction } from "@/types";
import { v4 as uuid } from "uuid";
import { dateToParts } from "./month";
import { ensureDefaultRules } from "./import/rules";

const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  // expense
  ...[
    "Rent / Housing", "Groceries", "Food / Dining", "Shopping", "Fuel / Transport",
    "Utilities", "Health", "Travel", "Subscriptions", "Gifts", "Family",
    "Personal Care", "Miscellaneous",
  ].map((name) => ({ name, type: "expense" as const, isSystem: true })),
  // income
  ...[
    "Salary", "Bonus", "Cashback", "Interest", "Refund", "Side Income",
    "Gift Received", "Investment Return",
  ].map((name) => ({ name, type: "income" as const, isSystem: true })),
];

const DEFAULT_ACCOUNTS: Omit<Account, "id">[] = [
  { name: "HDFC Bank", type: "bank", isActive: true },
  { name: "Axis Flipkart Credit Card", type: "credit_card", isActive: true },
  { name: "Cash", type: "cash", isActive: true },
  { name: "UPI", type: "upi", isActive: true },
];

function mkTxn(
  date: string,
  description: string,
  amount: number,
  direction: "income" | "expense",
  moneyType: Transaction["moneyType"],
  category: string,
  account?: string,
): Transaction {
  const parts = dateToParts(date);
  const now = new Date().toISOString();
  return {
    id: uuid(),
    date,
    monthKey: parts.monthKey,
    year: parts.year,
    month: parts.month,
    description,
    amount,
    direction,
    moneyType,
    category,
    account,
    isRecurring: false,
    tags: ["demo"],
    source: "demo",
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureBaseData() {
  await ensureDefaultRules();
  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c, id: uuid() })));
  }
  const accCount = await db.accounts.count();
  if (accCount === 0) {
    await db.accounts.bulkAdd(DEFAULT_ACCOUNTS.map((a) => ({ ...a, id: uuid() })));
  }
  const settings = await db.app_settings.get("app");
  if (!settings) {
    await db.app_settings.put({
      id: "app",
      currency: "INR",
      theme: "dark",
      backupReminderEnabled: true,
      smartCategorySuggestions: true,
      demoSeeded: false,
    });
  }
}

export async function seedDemoIfNeeded() {
  await ensureBaseData();
  const settings = await db.app_settings.get("app");
  if (settings?.demoSeeded) return;
  const txnCount = await db.transactions.count();
  if (txnCount > 0) {
    await db.app_settings.put({ ...settings!, demoSeeded: true });
    return;
  }

  const now = new Date();
  const txns: Transaction[] = [];
  // Generate last 6 months of demo data
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const iso = (day: number) =>
      `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    txns.push(
      mkTxn(iso(1), "Monthly Salary", 54000 + i * 500, "income", "salary", "Salary", "HDFC Bank"),
      mkTxn(iso(2), "Apartment Rent", 18000, "expense", "expense", "Rent / Housing", "HDFC Bank"),
      mkTxn(iso(5), "BigBasket Groceries", 4200 + i * 80, "expense", "expense", "Groceries", "UPI"),
      mkTxn(iso(8), "Swiggy", 480, "expense", "expense", "Food / Dining", "UPI"),
      mkTxn(iso(10), "Petrol", 1800, "expense", "expense", "Fuel / Transport", "Axis Flipkart Credit Card"),
      mkTxn(iso(12), "Electricity Bill", 1450, "expense", "expense", "Utilities", "HDFC Bank"),
      mkTxn(iso(15), "Amazon Shopping", 2100 + i * 130, "expense", "expense", "Shopping", "Axis Flipkart Credit Card"),
      mkTxn(iso(16), "Netflix", 649, "expense", "expense", "Subscriptions", "Axis Flipkart Credit Card"),
      mkTxn(iso(18), "Zomato", 380, "expense", "expense", "Food / Dining", "UPI"),
      mkTxn(iso(20), "Axis Cashback", 340 + i * 20, "income", "cashback", "Cashback", "Axis Flipkart Credit Card"),
      mkTxn(iso(22), "Pharmacy", 620, "expense", "expense", "Health", "UPI"),
      mkTxn(iso(25), "Maid Salary", 3000, "expense", "expense", "Family", "Cash"),
      mkTxn(iso(28), "Savings Bank Interest", 510, "income", "interest", "Interest", "HDFC Bank"),
    );
  }
  await db.transactions.bulkAdd(txns);
  await db.app_settings.put({ ...settings!, demoSeeded: true });
}

export async function clearDemoData() {
  await db.transactions.where("source").equals("demo").delete();
  const s = await db.app_settings.get("app");
  if (s) await db.app_settings.put({ ...s, demoSeeded: true });
}

export async function wipeAll() {
  await Promise.all([
    db.transactions.clear(),
    db.monthly_summaries.clear(),
    db.monthly_category_summaries.clear(),
    db.import_batches.clear(),
  ]);
}
