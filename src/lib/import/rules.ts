import { v4 as uuid } from "uuid";
import { db } from "@/db/dexie";
import type { CategorizationRule, Direction, MoneyType } from "@/types";

export interface CompiledRule {
  rule: CategorizationRule;
  test: (text: string) => boolean;
}

export function compileRules(rules: CategorizationRule[]): CompiledRule[] {
  return rules
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority)
    .map((rule) => {
      if (rule.isRegex) {
        try {
          const re = new RegExp(rule.pattern, "i");
          return { rule, test: (t: string) => re.test(t) };
        } catch {
          return { rule, test: () => false };
        }
      }
      const needle = rule.pattern.toLowerCase();
      return { rule, test: (t: string) => t.toLowerCase().includes(needle) };
    });
}

export interface RuleMatch {
  category: string;
  direction?: Direction;
  moneyType?: MoneyType;
  account?: string;
  ruleId: string;
}

export function matchRule(text: string, compiled: CompiledRule[]): RuleMatch | null {
  for (const c of compiled) {
    if (c.test(text)) {
      return {
        category: c.rule.category,
        direction: c.rule.direction,
        moneyType: c.rule.moneyType,
        account: c.rule.account,
        ruleId: c.rule.id,
      };
    }
  }
  return null;
}

/** Default rules tuned for Indian banks & common merchants. */
const DEFAULT_RULE_SEEDS: Array<Omit<CategorizationRule, "id" | "createdAt" | "updatedAt" | "isSystem" | "enabled">> = [
  // Income
  { pattern: "salary", isRegex: false, category: "Salary", direction: "income", moneyType: "salary", priority: 100 },
  { pattern: "cashback|cash back|cb credit", isRegex: true, category: "Cashback", direction: "income", moneyType: "cashback", priority: 95 },
  { pattern: "\\b(interest|int\\.?\\s*credit|sb int)\\b", isRegex: true, category: "Interest", direction: "income", moneyType: "interest", priority: 95 },
  { pattern: "refund|reversal|chargeback", isRegex: true, category: "Refund", direction: "income", moneyType: "refund", priority: 90 },
  { pattern: "dividend", isRegex: false, category: "Investment Return", direction: "income", moneyType: "other_income", priority: 85 },
  // Food
  { pattern: "swiggy", isRegex: false, category: "Food / Dining", direction: "expense", moneyType: "expense", priority: 80 },
  { pattern: "zomato", isRegex: false, category: "Food / Dining", direction: "expense", moneyType: "expense", priority: 80 },
  { pattern: "dominos|pizza hut|mcdonald|kfc|burger king|starbucks|cafe coffee", isRegex: true, category: "Food / Dining", direction: "expense", moneyType: "expense", priority: 75 },
  // Groceries
  { pattern: "bigbasket|blinkit|zepto|grofers|dmart|reliance fresh|more retail|spencer|nature's basket", isRegex: true, category: "Groceries", direction: "expense", moneyType: "expense", priority: 80 },
  // Transport / Fuel
  { pattern: "uber|ola|rapido", isRegex: true, category: "Fuel / Transport", direction: "expense", moneyType: "expense", priority: 80 },
  { pattern: "indian oil|hp\\s*petrol|bharat petroleum|iocl|hpcl|bpcl|shell\\b|petrol pump|fuel", isRegex: true, category: "Fuel / Transport", direction: "expense", moneyType: "expense", priority: 80 },
  { pattern: "irctc|indigo|spicejet|air india|vistara|akasa|makemytrip|goibibo|cleartrip|ixigo", isRegex: true, category: "Travel", direction: "expense", moneyType: "expense", priority: 75 },
  // Shopping
  { pattern: "amazon|amzn", isRegex: true, category: "Shopping", direction: "expense", moneyType: "expense", priority: 70 },
  { pattern: "flipkart|myntra|ajio|nykaa|meesho|tata cliq|snapdeal", isRegex: true, category: "Shopping", direction: "expense", moneyType: "expense", priority: 70 },
  // Subscriptions
  { pattern: "netflix|prime video|hotstar|disney|spotify|youtube premium|apple\\.com/bill|google\\s*one|icloud|notion|chatgpt|openai|github|cursor|figma|adobe|microsoft 365|office 365", isRegex: true, category: "Subscriptions", direction: "expense", moneyType: "expense", priority: 80 },
  // Utilities
  { pattern: "electricity|bescom|tata power|adani electricity|reliance energy|msedcl|kseb|tneb|bsnl|airtel|jio|vodafone|vi\\s*postpaid|broadband|water bill|gas bill", isRegex: true, category: "Utilities", direction: "expense", moneyType: "expense", priority: 75 },
  // Health
  { pattern: "apollo|pharmeasy|1mg|netmeds|practo|cult\\.fit|cure\\.fit|tata 1mg|medplus|pharmacy|hospital|clinic", isRegex: true, category: "Health", direction: "expense", moneyType: "expense", priority: 75 },
  // Rent / EMI
  { pattern: "\\brent\\b|landlord", isRegex: true, category: "Rent / Housing", direction: "expense", moneyType: "expense", priority: 90 },
  { pattern: "emi|loan", isRegex: true, category: "Miscellaneous", direction: "expense", moneyType: "expense", priority: 60 },
  // Investments
  { pattern: "zerodha|groww|upstox|kuvera|coin\\.zerodha|mf utility|sip", isRegex: true, category: "Investment Return", direction: "expense", moneyType: "investment", priority: 85 },
  // Transfers
  { pattern: "\\bupi\\b.*(self|own a/c)|imps.*self|neft.*self", isRegex: true, category: "Transfer", direction: "transfer", moneyType: "transfer", priority: 95 },
  // ATM
  { pattern: "atm|cash wdl|cash withdrawal", isRegex: true, category: "Miscellaneous", direction: "expense", moneyType: "expense", priority: 60 },
];

export async function ensureDefaultRules() {
  const count = await db.categorization_rules.count();
  if (count > 0) return;
  const now = new Date().toISOString();
  await db.categorization_rules.bulkAdd(
    DEFAULT_RULE_SEEDS.map((r) => ({
      ...r,
      id: uuid(),
      isSystem: true,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

export async function getCompiledRules() {
  const all = await db.categorization_rules.toArray();
  return compileRules(all);
}
