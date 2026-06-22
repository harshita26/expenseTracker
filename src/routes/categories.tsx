import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { db } from "@/db/dexie";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { v4 as uuid } from "uuid";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — My Money" }, { name: "description", content: "Manage income and expense categories." }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const [name, setName] = useState("");
  const [type, setType] = useState<"expense" | "income" | "both">("expense");
  const [accName, setAccName] = useState("");

  async function addCat() {
    if (!name.trim()) return;
    if (cats.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) return toast.error("Already exists");
    await db.categories.add({ id: uuid(), name: name.trim(), type, isSystem: false });
    setName("");
    toast.success("Category added");
  }
  async function delCat(id: string) {
    await db.categories.delete(id);
    toast.success("Removed");
  }
  async function addAcc() {
    if (!accName.trim()) return;
    await db.accounts.add({ id: uuid(), name: accName.trim(), type: "bank", isActive: true });
    setAccName("");
  }
  async function delAcc(id: string) {
    await db.accounts.delete(id);
  }

  return (
    <>
      <PageHeader title="Categories & Accounts" description="Tune the buckets you use to track spending and income" />
      <main className="flex-1 grid gap-6 p-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Categories</h2>
          <div className="mt-3 flex gap-2">
            <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addCat}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="mt-4 divide-y divide-border/60">
            {cats.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.type}{c.isSystem ? " · default" : ""}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => delCat(c.id)}><Trash2 className="h-4 w-4 text-expense" /></Button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Accounts</h2>
          <div className="mt-3 flex gap-2">
            <Input placeholder="Bank / card / wallet name" value={accName} onChange={(e) => setAccName(e.target.value)} />
            <Button onClick={addAcc}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="mt-4 divide-y divide-border/60">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.type}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => delAcc(a.id)}><Trash2 className="h-4 w-4 text-expense" /></Button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
