import type { MonthlyCategorySummary, MonthlySummary, Transaction } from "@/types";
import { monthKey } from "./month";

export interface MonthTotals {
  monthKey: string;
  income: number;
  salary: number;
  expense: number;
  savings: number;
  cashback: number;
  interest: number;
  source: "transactions" | "summary" | "empty";
  hasSummaryFallback?: boolean;
}

export function computeMonthTotals(
  key: string,
  txns: Transaction[],
  summaries: MonthlySummary[],
): MonthTotals {
  const monthTxns = txns.filter((t) => t.monthKey === key);
  if (monthTxns.length > 0) {
    let salary = 0, income = 0, expense = 0, cashback = 0, interest = 0;
    for (const t of monthTxns) {
      if (t.direction === "income") {
        income += t.amount;
        if (t.moneyType === "salary") salary += t.amount;
        else if (t.moneyType === "cashback") cashback += t.amount;
        else if (t.moneyType === "interest") interest += t.amount;
      } else if (t.direction === "expense") {
        expense += t.amount;
      }
    }
    return {
      monthKey: key,
      income,
      salary,
      expense,
      savings: income - expense,
      cashback,
      interest,
      source: "transactions",
      hasSummaryFallback: summaries.some((s) => s.monthKey === key),
    };
  }
  const sum = summaries.find((s) => s.monthKey === key);
  if (sum) {
    const income = (sum.salary || 0) + (sum.otherIncome || 0) + (sum.cashback || 0) + (sum.interest || 0);
    return {
      monthKey: key,
      income,
      salary: sum.salary || 0,
      expense: sum.expense || 0,
      savings: sum.savings ?? income - (sum.expense || 0),
      cashback: sum.cashback || 0,
      interest: sum.interest || 0,
      source: "summary",
    };
  }
  return { monthKey: key, income: 0, salary: 0, expense: 0, savings: 0, cashback: 0, interest: 0, source: "empty" };
}

export function computeYearTotals(year: number, txns: Transaction[], summaries: MonthlySummary[]) {
  const months = Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1));
  const perMonth = months.map((k) => computeMonthTotals(k, txns, summaries));
  const sum = perMonth.reduce(
    (a, m) => ({
      income: a.income + m.income,
      salary: a.salary + m.salary,
      expense: a.expense + m.expense,
      savings: a.savings + m.savings,
      cashback: a.cashback + m.cashback,
      interest: a.interest + m.interest,
    }),
    { income: 0, salary: 0, expense: 0, savings: 0, cashback: 0, interest: 0 },
  );
  return { perMonth, totals: sum };
}

export function categoryBreakdown(
  key: string,
  txns: Transaction[],
  catSums: MonthlyCategorySummary[],
): { category: string; amount: number }[] {
  const monthTxns = txns.filter((t) => t.monthKey === key && t.direction === "expense");
  if (monthTxns.length > 0) {
    const map = new Map<string, number>();
    for (const t of monthTxns) {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    }
    return [...map.entries()].map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }
  const catMonth = catSums.filter((s) => s.monthKey === key && s.direction === "expense");
  return catMonth.map((s) => ({ category: s.category, amount: s.amount }))
    .sort((a, b) => b.amount - a.amount);
}
