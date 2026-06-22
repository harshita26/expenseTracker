import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseQuickAdd, draftToTransaction } from "@/lib/quickAdd";
import { db } from "@/db/dexie";
import { formatINR } from "@/lib/formatting";
import { toast } from "sonner";
import { Sparkles, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export function QuickAddBar() {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<ReturnType<typeof parseQuickAdd> | null>(null);

  useEffect(() => { setDraft(parseQuickAdd(text)); }, [text]);

  async function save() {
    if (!draft) return;
    const txn = draftToTransaction(draft);
    await db.transactions.add(txn);
    toast.success(`${draft.direction === "income" ? "Income" : "Expense"} added — ${formatINR(draft.amount)}`);
    setText("");
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sparkles className="h-4 w-4 text-cashback" /> Quick Add
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="Try: rent 18000 · salary 54000 · swiggy 420 · cashback 350 axis"
          className="h-11 text-base"
        />
        <Button onClick={save} disabled={!draft} className="h-11 px-5">Add</Button>
      </div>
      {draft && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${draft.direction === "income" ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
            {draft.direction === "income" ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
            {formatINR(draft.amount)}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{draft.category}</span>
          {draft.account && <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{draft.account}</span>}
          <span className="text-xs text-muted-foreground">Press Enter to save</span>
        </div>
      )}
    </div>
  );
}
