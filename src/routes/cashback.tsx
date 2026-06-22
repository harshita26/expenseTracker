import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { db } from "@/db/dexie";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useMemo, useState } from "react";
import { computeYearTotals } from "@/lib/analytics";
import { formatINR } from "@/lib/formatting";
import { MONTH_SHORT } from "@/lib/month";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CashbackTrend } from "@/components/dashboard/Charts";
import { Sparkles, PiggyBank } from "lucide-react";

export const Route = createFileRoute("/cashback")({
  head: () => ({ meta: [{ title: "Cashback & Interest — My Money" }, { name: "description", content: "Track cashback earned and bank interest received." }] }),
  component: CashbackPage,
});

function CashbackPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const txns = useLiveQuery(() => db.transactions.where("year").equals(year).toArray(), [year]) ?? [];
  const summaries = useLiveQuery(() => db.monthly_summaries.where("year").equals(year).toArray(), [year]) ?? [];
  const allYears = useLiveQuery(async () => {
    const t = await db.transactions.toArray();
    const s = await db.monthly_summaries.toArray();
    return Array.from(new Set([now.getFullYear(), ...t.map((x) => x.year), ...s.map((x) => x.year)])).sort((a, b) => b - a);
  }, []) ?? [now.getFullYear()];

  const agg = useMemo(() => computeYearTotals(year, txns, summaries), [year, txns, summaries]);
  const data = agg.perMonth.map((m, i) => ({ label: MONTH_SHORT[i], cashback: m.cashback, interest: m.interest }));

  const cashbackTxns = txns.filter((t) => t.moneyType === "cashback").sort((a, b) => b.date.localeCompare(a.date));
  const interestTxns = txns.filter((t) => t.moneyType === "interest").sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeader
        title="Cashback & Interest"
        description="Free money you earned this year"
        actions={
          <Select value={String(year)} onValueChange={(v) => setYear(+v)}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{allYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        }
      />
      <main className="flex-1 space-y-6 p-6">
        <section className="grid gap-4 md:grid-cols-3">
          <Stat icon={<Sparkles className="h-5 w-5" />} accent="bg-cashback/15 text-cashback" label="Cashback YTD" value={agg.totals.cashback} />
          <Stat icon={<PiggyBank className="h-5 w-5" />} accent="bg-balance/15 text-balance" label="Interest YTD" value={agg.totals.interest} />
          <Stat icon={<Sparkles className="h-5 w-5" />} accent="bg-primary/15 text-primary" label="Combined" value={agg.totals.cashback + agg.totals.interest} />
        </section>
        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Monthly trend</h2>
          <CashbackTrend data={data} />
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <TxnList title="Cashback entries" rows={cashbackTxns} />
          <TxnList title="Interest entries" rows={interestTxns} />
        </section>
      </main>
    </>
  );
}

function Stat({ icon, accent, label, value }: { icon: React.ReactNode; accent: string; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>{icon}</span>
      </div>
      <div className="mt-3 font-display text-2xl font-semibold">{formatINR(value)}</div>
    </div>
  );
}

function TxnList({ title, rows }: { title: string; rows: { id: string; date: string; description: string; amount: number; account?: string }[] }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <div className="mt-2 divide-y divide-border/60">
        {rows.length === 0 && <div className="py-6 text-sm text-muted-foreground">Nothing yet.</div>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium">{r.description}</div>
              <div className="text-xs text-muted-foreground">{r.date}{r.account ? ` · ${r.account}` : ""}</div>
            </div>
            <div className="text-sm font-semibold text-income">+ {formatINR(r.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
