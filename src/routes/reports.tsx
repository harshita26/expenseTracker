import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/db/dexie";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useMemo, useState } from "react";
import { computeYearTotals, categoryBreakdown } from "@/lib/analytics";
import { MONTH_SHORT, monthKey } from "@/lib/month";
import { formatINR } from "@/lib/formatting";
import { toCSV, downloadFile } from "@/lib/backup";
import { Download } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — My Money" }, { name: "description", content: "Monthly, yearly and category reports." }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const txns = useLiveQuery(() => db.transactions.where("year").equals(year).toArray(), [year]) ?? [];
  const summaries = useLiveQuery(() => db.monthly_summaries.where("year").equals(year).toArray(), [year]) ?? [];
  const catSums = useLiveQuery(() => db.monthly_category_summaries.where("year").equals(year).toArray(), [year]) ?? [];
  const allYearsTx = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const allYearsSm = useLiveQuery(() => db.monthly_summaries.toArray(), []) ?? [];

  const agg = useMemo(() => computeYearTotals(year, txns, summaries), [year, txns, summaries]);

  // category for whole year
  const yearCat = useMemo(() => {
    const map = new Map<string, number>();
    for (let m = 1; m <= 12; m++) {
      const items = categoryBreakdown(monthKey(year, m), txns, catSums);
      for (const i of items) map.set(i.category, (map.get(i.category) || 0) + i.amount);
    }
    return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [year, txns, catSums]);

  // yearly summary
  const yearlySummary = useMemo(() => {
    const yrs = Array.from(new Set([...allYearsTx.map((t) => t.year), ...allYearsSm.map((s) => s.year)])).sort();
    return yrs.map((y) => computeYearTotals(y, allYearsTx.filter((t) => t.year === y), allYearsSm.filter((s) => s.year === y)));
  }, [allYearsTx, allYearsSm]);

  const years = Array.from(new Set([now.getFullYear(), ...allYearsTx.map((t) => t.year), ...allYearsSm.map((s) => s.year)])).sort((a, b) => b - a);

  function exportMonthly() {
    const rows = agg.perMonth.map((m, i) => ({
      Month: `${MONTH_SHORT[i]} ${year}`, Income: m.income, Salary: m.salary, Expense: m.expense, Savings: m.savings, Cashback: m.cashback, Interest: m.interest, Source: m.source,
    }));
    downloadFile(`my-money-${year}-monthly.csv`, toCSV(rows), "text/csv");
  }
  function exportCategories() {
    downloadFile(`my-money-${year}-categories.csv`, toCSV(yearCat as unknown as Record<string, unknown>[]), "text/csv");
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Monthly, yearly and category breakdowns"
        actions={
          <>
            <Select value={String(year)} onValueChange={(v) => setYear(+v)}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={exportMonthly} className="gap-2"><Download className="h-4 w-4" /> Monthly CSV</Button>
            <Button variant="outline" onClick={exportCategories} className="gap-2"><Download className="h-4 w-4" /> Categories CSV</Button>
          </>
        }
      />
      <main className="flex-1 space-y-6 p-6">
        <section className="rounded-2xl border border-border/60 bg-card">
          <div className="border-b border-border/60 p-4 font-display text-lg font-semibold">Monthly summary — {year}</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Month</th>
                  <th className="px-4 py-2 text-right">Income</th>
                  <th className="px-4 py-2 text-right">Expense</th>
                  <th className="px-4 py-2 text-right">Savings</th>
                  <th className="px-4 py-2 text-right">Cashback</th>
                  <th className="px-4 py-2 text-right">Interest</th>
                  <th className="px-4 py-2 text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {agg.perMonth.map((m, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-4 py-2">{MONTH_SHORT[i]}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatINR(m.income)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatINR(m.expense)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${m.savings < 0 ? "text-expense" : "text-savings"}`}>{formatINR(m.savings)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatINR(m.cashback)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatINR(m.interest)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{m.source}</td>
                  </tr>
                ))}
                <tr className="border-t border-border/60 bg-muted/20 font-semibold">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(agg.totals.income)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(agg.totals.expense)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(agg.totals.savings)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(agg.totals.cashback)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(agg.totals.interest)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card">
            <div className="border-b border-border/60 p-4 font-display text-lg font-semibold">Top categories — {year}</div>
            <div className="divide-y divide-border/60">
              {yearCat.length === 0 && <div className="p-6 text-sm text-muted-foreground">No data for {year}.</div>}
              {yearCat.slice(0, 12).map((c) => (
                <div key={c.category} className="flex items-center justify-between px-4 py-2">
                  <span className="text-sm">{c.category}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatINR(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card">
            <div className="border-b border-border/60 p-4 font-display text-lg font-semibold">Yearly summary</div>
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Year</th><th className="px-4 py-2 text-right">Income</th><th className="px-4 py-2 text-right">Expense</th><th className="px-4 py-2 text-right">Savings</th></tr>
              </thead>
              <tbody>
                {yearlySummary.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">No data yet.</td></tr>}
                {yearlySummary.map((y, i) => {
                  const yr = Array.from(new Set([...allYearsTx.map((t) => t.year), ...allYearsSm.map((s) => s.year)])).sort()[i];
                  return (
                    <tr key={yr} className="border-t border-border/60">
                      <td className="px-4 py-2">{yr}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatINR(y.totals.income)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatINR(y.totals.expense)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${y.totals.savings < 0 ? "text-expense" : "text-savings"}`}>{formatINR(y.totals.savings)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
