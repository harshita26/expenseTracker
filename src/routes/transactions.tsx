import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db/dexie";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { TxnFormDialog } from "@/components/transactions/TxnFormDialog";
import { Plus, Pencil, Trash2, Copy, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatINR } from "@/lib/formatting";
import { MONTH_NAMES } from "@/lib/month";
import type { Transaction } from "@/types";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — My Money" },
      { name: "description", content: "Search, filter, edit and manage every transaction." },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const now = new Date();
  const [year, setYear] = useState<number | "all">(now.getFullYear());
  const [month, setMonth] = useState<number | "all">("all");
  const [tab, setTab] = useState<"all" | "income" | "expense" | "cashback" | "interest">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const all = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];

  const filtered = useMemo(() => {
    let r = all;
    if (year !== "all") r = r.filter((t) => t.year === year);
    if (month !== "all") r = r.filter((t) => t.month === month);
    if (tab === "income") r = r.filter((t) => t.direction === "income");
    else if (tab === "expense") r = r.filter((t) => t.direction === "expense");
    else if (tab === "cashback") r = r.filter((t) => t.moneyType === "cashback");
    else if (tab === "interest") r = r.filter((t) => t.moneyType === "interest");
    if (q) {
      const lc = q.toLowerCase();
      r = r.filter((t) => t.description.toLowerCase().includes(lc) || t.category.toLowerCase().includes(lc) || (t.account ?? "").toLowerCase().includes(lc));
    }
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [all, year, month, tab, q]);

  const years = Array.from(new Set([now.getFullYear(), ...all.map((t) => t.year)])).sort((a, b) => b - a);

  async function del(id: string) {
    await db.transactions.delete(id);
    toast.success("Deleted");
  }
  async function duplicate(t: Transaction) {
    await db.transactions.add({ ...t, id: uuid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    toast.success("Duplicated");
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description={`${filtered.length} ${filtered.length === 1 ? "entry" : "entries"} shown`}
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> New</Button>}
      />
      <main className="flex-1 space-y-4 p-6">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search description, category, account..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
            <Select value={String(year)} onValueChange={(v) => setYear(v === "all" ? "all" : +v)}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(month)} onValueChange={(v) => setMonth(v === "all" ? "all" : +v)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {MONTH_NAMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="ml-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
                <TabsTrigger value="expense">Expenses</TabsTrigger>
                <TabsTrigger value="cashback">Cashback</TabsTrigger>
                <TabsTrigger value="interest">Interest</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card">
          <div className="divide-y divide-border/60">
            {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No transactions match the filters.</div>}
            {filtered.map((t) => (
              <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.direction === "income" ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
                  {t.direction === "income" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.description}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.date} · {t.category}{t.account ? ` · ${t.account}` : ""}{t.moneyType !== "expense" && t.moneyType !== "other_income" ? ` · ${t.moneyType}` : ""}</div>
                </div>
                <div className={`text-sm font-semibold tabular-nums ${t.direction === "income" ? "text-income" : ""}`}>
                  {t.direction === "income" ? "+" : "−"} {formatINR(t.amount)}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => duplicate(t)}><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(t.id)}><Trash2 className="h-4 w-4 text-expense" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        {accounts.length === 0 && <p className="text-xs text-muted-foreground">Tip: add accounts in Settings to track money by bank/card.</p>}
      </main>
      <TxnFormDialog open={open} onOpenChange={setOpen} initial={editing ?? undefined} />
    </>
  );
}
