import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { QuickAddBar } from "@/components/transactions/QuickAddBar";
import { TxnFormDialog } from "@/components/transactions/TxnFormDialog";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { OverviewDonut, CashFlowTrend, ExpenseBreakdown, CashbackTrend } from "@/components/dashboard/Charts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowDownLeft, ArrowUpRight, PiggyBank, Sparkles, Wallet } from "lucide-react";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { db } from "@/db/dexie";
import { computeMonthTotals, computeYearTotals, categoryBreakdown } from "@/lib/analytics";
import { MONTH_NAMES, MONTH_SHORT, monthKey } from "@/lib/month";
import { formatINR } from "@/lib/formatting";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — My Money" },
      { name: "description", content: "See your income, expenses, savings, cashback and interest at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [openForm, setOpenForm] = useState(false);

  const txns = useLiveQuery(() => db.transactions.where("year").equals(year).toArray(), [year]) ?? [];
  const summaries = useLiveQuery(() => db.monthly_summaries.where("year").equals(year).toArray(), [year]) ?? [];
  const catSums = useLiveQuery(() => db.monthly_category_summaries.where("year").equals(year).toArray(), [year]) ?? [];
  const recent = useLiveQuery(() => db.transactions.orderBy("date").reverse().limit(8).toArray(), []) ?? [];

  const mk = monthKey(year, month);
  const monthTotals = useMemo(() => computeMonthTotals(mk, txns, summaries), [mk, txns, summaries]);
  const yearAgg = useMemo(() => computeYearTotals(year, txns, summaries), [year, txns, summaries]);
  const trend = yearAgg.perMonth.map((m, i) => ({
    label: MONTH_SHORT[i],
    income: m.income, expense: m.expense, savings: m.savings,
  }));
  const cashbackTrend = yearAgg.perMonth.map((m, i) => ({
    label: MONTH_SHORT[i], cashback: m.cashback, interest: m.interest,
  }));
  const catData = useMemo(() => categoryBreakdown(mk, txns, catSums), [mk, txns, catSums]);

  const greet = (() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const years = Array.from(new Set([now.getFullYear(), now.getFullYear() - 1, year])).sort((a, b) => b - a);

  return (
    <>
      <PageHeader
        title={`${greet}`}
        description={`Here's your money snapshot for ${MONTH_NAMES[month - 1]} ${year}`}
        actions={
          <>
            <Select value={String(month)} onValueChange={(v) => setMonth(+v)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(+v)}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setOpenForm(true)} className="gap-2"><Plus className="h-4 w-4" /> Add Transaction</Button>
          </>
        }
      />

      <main className="flex-1 space-y-6 p-6">
        <QuickAddBar />

        {monthTotals.source === "summary" && (
          <div className="rounded-xl border border-cashback/30 bg-cashback/10 px-4 py-2 text-sm text-cashback">
            Showing imported monthly summary for {MONTH_NAMES[month - 1]} {year}. Add daily transactions to switch to detailed view.
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Income" value={monthTotals.income} hint={`Salary ${formatINR(monthTotals.salary)}`} icon={ArrowDownLeft} accent="income" />
          <KpiCard label="Spent" value={monthTotals.expense} icon={ArrowUpRight} accent="expense" />
          <KpiCard label="Saved" value={monthTotals.savings} icon={PiggyBank} accent="savings" />
          <KpiCard label="Cashback + Interest" value={monthTotals.cashback + monthTotals.interest} icon={Sparkles} accent="cashback" />
          <KpiCard label="Year Balance" value={yearAgg.totals.savings} hint={`${year} YTD`} icon={Wallet} accent="balance" />
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Income / Expense / Savings</h2>
              <span className="text-xs text-muted-foreground">{MONTH_NAMES[month - 1]} {year}</span>
            </div>
            <OverviewDonut income={monthTotals.income} expense={monthTotals.expense} savings={monthTotals.savings} />
          </div>
          <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Cash Flow — {year}</h2>
            </div>
            <CashFlowTrend data={trend} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Expense Breakdown</h2>
              <span className="text-xs text-muted-foreground">{MONTH_NAMES[month - 1]} {year}</span>
            </div>
            <ExpenseBreakdown data={catData} />
          </div>
          <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Cashback & Interest</h2>
            <div className="mt-2 mb-3 text-2xl font-display font-semibold text-cashback">
              {formatINR(yearAgg.totals.cashback + yearAgg.totals.interest)}
              <span className="ml-2 text-xs text-muted-foreground">YTD</span>
            </div>
            <CashbackTrend data={cashbackTrend} />
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Recent Transactions</h2>
          <div className="mt-3 divide-y divide-border/60">
            {recent.length === 0 && <div className="py-6 text-sm text-muted-foreground">No transactions yet. Use Quick Add above to get started.</div>}
            {recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.direction === "income" ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
                    {t.direction === "income" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{t.description}</div>
                    <div className="text-xs text-muted-foreground">{t.category} · {t.date}{t.account ? ` · ${t.account}` : ""}</div>
                  </div>
                </div>
                <div className={`text-sm font-semibold ${t.direction === "income" ? "text-income" : "text-foreground"}`}>
                  {t.direction === "income" ? "+" : "−"} {formatINR(t.amount)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <TxnFormDialog open={openForm} onOpenChange={setOpenForm} />
    </>
  );
}
