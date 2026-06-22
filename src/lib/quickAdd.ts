import type { Direction, MoneyType, Transaction } from "@/types";
import { todayISO, dateToParts } from "./month";
import { v4 as uuid } from "uuid";

const INCOME_KEYWORDS: { match: RegExp; moneyType: MoneyType; category: string }[] = [
  { match: /\bsalary\b/i, moneyType: "salary", category: "Salary" },
  { match: /\bbonus\b/i, moneyType: "other_income", category: "Bonus" },
  { match: /\bcashback\b/i, moneyType: "cashback", category: "Cashback" },
  { match: /\binterest\b/i, moneyType: "interest", category: "Interest" },
  { match: /\brefund\b/i, moneyType: "refund", category: "Refund" },
  { match: /\b(dividend|return)\b/i, moneyType: "investment", category: "Investment Return" },
];

const EXPENSE_HINTS: { match: RegExp; category: string }[] = [
  { match: /\brent\b/i, category: "Rent / Housing" },
  { match: /\b(swiggy|zomato|dining|restaurant|food)\b/i, category: "Food / Dining" },
  { match: /\b(grocer|bigbasket|blinkit|dmart)\b/i, category: "Groceries" },
  { match: /\b(fuel|petrol|diesel|uber|ola|cab|metro|bus|train|transport)\b/i, category: "Fuel / Transport" },
  { match: /\b(wifi|internet|electricity|bill|water|gas)\b/i, category: "Utilities" },
  { match: /\b(amazon|flipkart|shopping|myntra|ajio)\b/i, category: "Shopping" },
  { match: /\b(movie|netflix|spotify|prime|subscription)\b/i, category: "Subscriptions" },
  { match: /\b(doctor|pharmacy|medical|health|hospital)\b/i, category: "Health" },
  { match: /\b(travel|trip|hotel|flight)\b/i, category: "Travel" },
  { match: /\b(gift)\b/i, category: "Gifts" },
  { match: /\b(maid|cook|family)\b/i, category: "Family" },
];

const ACCOUNT_HINTS = [
  { match: /\b(hdfc)\b/i, name: "HDFC Bank" },
  { match: /\b(axis|flipkart)\b/i, name: "Axis Flipkart Credit Card" },
  { match: /\b(icici)\b/i, name: "ICICI Bank" },
  { match: /\b(sbi)\b/i, name: "SBI Bank" },
  { match: /\b(cash)\b/i, name: "Cash" },
  { match: /\b(upi)\b/i, name: "UPI" },
];

export interface QuickAddDraft {
  amount: number;
  direction: Direction;
  moneyType: MoneyType;
  category: string;
  description: string;
  account?: string;
  date: string;
}

export function parseQuickAdd(input: string): QuickAddDraft | null {
  const text = input.trim();
  if (!text) return null;
  // amount: largest number in text
  const nums = [...text.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) =>
    parseFloat(m[1].replace(/,/g, "")),
  );
  if (!nums.length) return null;
  const amount = Math.max(...nums);

  let direction: Direction = "expense";
  let moneyType: MoneyType = "expense";
  let category = "Miscellaneous";

  for (const k of INCOME_KEYWORDS) {
    if (k.match.test(text)) {
      direction = "income";
      moneyType = k.moneyType;
      category = k.category;
      break;
    }
  }
  if (direction === "expense") {
    for (const h of EXPENSE_HINTS) {
      if (h.match.test(text)) {
        category = h.category;
        break;
      }
    }
  }
  let account: string | undefined;
  for (const a of ACCOUNT_HINTS) {
    if (a.match.test(text)) {
      account = a.name;
      break;
    }
  }

  // description = remove numbers, trim
  let description = text.replace(/\d+(?:[.,]\d+)?/g, "").replace(/\s+/g, " ").trim();
  if (!description) description = category;
  // capitalize first letter
  description = description.charAt(0).toUpperCase() + description.slice(1);

  return {
    amount,
    direction,
    moneyType,
    category,
    description,
    account,
    date: todayISO(),
  };
}

export function draftToTransaction(d: QuickAddDraft, source = "quick_add"): Transaction {
  const parts = dateToParts(d.date);
  const now = new Date().toISOString();
  return {
    id: uuid(),
    date: d.date,
    monthKey: parts.monthKey,
    year: parts.year,
    month: parts.month,
    description: d.description,
    amount: d.amount,
    direction: d.direction,
    moneyType: d.moneyType,
    category: d.category,
    account: d.account,
    isRecurring: false,
    tags: [],
    source,
    createdAt: now,
    updatedAt: now,
  };
}
