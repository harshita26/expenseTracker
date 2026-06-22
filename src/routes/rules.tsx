import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { db } from "@/db/dexie";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import type { CategorizationRule, Direction, MoneyType } from "@/types";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Auto-categorization Rules — My Money" },
      { name: "description", content: "Manage merchant-to-category rules that run during imports." },
    ],
  }),
  component: RulesPage,
});

const DIRECTIONS: Direction[] = ["income", "expense", "transfer"];
const MONEY_TYPES: MoneyType[] = ["salary", "expense", "cashback", "interest", "refund", "transfer", "investment", "other_income", "other_expense"];

function RulesPage() {
  const rules = useLiveQuery(() => db.categorization_rules.orderBy("priority").reverse().toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [editing, setEditing] = useState<CategorizationRule | null>(null);
  const [open, setOpen] = useState(false);

  function startNew() {
    const now = new Date().toISOString();
    setEditing({
      id: uuid(),
      pattern: "",
      isRegex: false,
      category: categories[0]?.name ?? "Miscellaneous",
      direction: "expense",
      moneyType: "expense",
      priority: 50,
      isSystem: false,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    setOpen(true);
  }

  function startEdit(r: CategorizationRule) {
    setEditing({ ...r });
    setOpen(true);
  }

  async function save() {
    if (!editing) return;
    if (!editing.pattern.trim()) return toast.error("Pattern is required");
    await db.categorization_rules.put({ ...editing, updatedAt: new Date().toISOString() });
    toast.success("Rule saved");
    setOpen(false);
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this rule?")) return;
    await db.categorization_rules.delete(id);
    toast.success("Rule deleted");
  }

  async function toggle(r: CategorizationRule, enabled: boolean) {
    await db.categorization_rules.put({ ...r, enabled, updatedAt: new Date().toISOString() });
  }

  return (
    <>
      <PageHeader
        title="Auto-categorization Rules"
        description="When you import a statement, these rules match merchants and auto-assign categories."
        actions={<Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" />New rule</Button>}
      />
      <main className="flex-1 space-y-4 p-6">
        <div className="rounded-2xl border border-border/60 bg-card">
          <div className="border-b border-border/60 p-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cashback" />
            <span className="font-display text-lg font-semibold">{rules.length} rule{rules.length === 1 ? "" : "s"}</span>
            <span className="text-xs text-muted-foreground ml-2">Higher priority runs first.</span>
          </div>
          <div className="divide-y divide-border/60">
            {rules.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">No rules yet — add one to auto-categorize Swiggy, Amazon, Netflix etc.</div>
            )}
            {rules.map((r) => (
              <div key={r.id} className="flex items-center gap-4 p-4">
                <Switch checked={r.enabled} onCheckedChange={(v) => toggle(r, v)} />
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => startEdit(r)}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.isRegex ? `/${r.pattern}/i` : r.pattern}</code>
                    <span className="text-muted-foreground">→</span>
                    <span>{r.category}</span>
                    {r.isSystem && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">DEFAULT</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    priority {r.priority} · {r.direction ?? "—"} · {r.moneyType ?? "—"}{r.account ? ` · ${r.account}` : ""}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-expense" /></Button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing && rules.some((r) => r.id === editing.id) ? "Edit rule" : "New rule"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Pattern</Label>
                <Input value={editing.pattern} onChange={(e) => setEditing({ ...editing, pattern: e.target.value })} placeholder={editing.isRegex ? "swiggy|zomato" : "SWIGGY"} />
                <p className="mt-1 text-xs text-muted-foreground">Matched (case-insensitive) against description + merchant.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-2">
                <Label>Treat as regular expression</Label>
                <Switch checked={editing.isRegex} onCheckedChange={(v) => setEditing({ ...editing, isRegex: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} list="categories-list" />
                  <datalist id="categories-list">
                    {categories.map((c) => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Input type="number" value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: +e.target.value || 0 })} />
                </div>
                <div>
                  <Label>Direction</Label>
                  <Select value={editing.direction ?? "expense"} onValueChange={(v) => setEditing({ ...editing, direction: v as Direction })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIRECTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Money type</Label>
                  <Select value={editing.moneyType ?? "expense"} onValueChange={(v) => setEditing({ ...editing, moneyType: v as MoneyType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONEY_TYPES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Account override (optional)</Label>
                  <Input value={editing.account ?? ""} onChange={(e) => setEditing({ ...editing, account: e.target.value || undefined })} placeholder="e.g. HDFC Credit Card" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
