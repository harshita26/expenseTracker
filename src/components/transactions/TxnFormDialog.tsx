import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Direction, MoneyType, Transaction } from "@/types";
import { db } from "@/db/dexie";
import { dateToParts, todayISO } from "@/lib/month";
import { v4 as uuid } from "uuid";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<Transaction>;
}

const MONEY_TYPES: MoneyType[] = ["salary", "expense", "cashback", "interest", "refund", "transfer", "investment", "other_income", "other_expense"];

export function TxnFormDialog({ open, onOpenChange, initial }: Props) {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];

  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [amount, setAmount] = useState<number>(initial?.amount ?? 0);
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? "expense");
  const [moneyType, setMoneyType] = useState<MoneyType>(initial?.moneyType ?? "expense");
  const [category, setCategory] = useState(initial?.category ?? "Miscellaneous");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [account, setAccount] = useState(initial?.account ?? "");
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  useEffect(() => {
    if (!open) return;
    setDate(initial?.date ?? todayISO());
    setAmount(initial?.amount ?? 0);
    setDirection(initial?.direction ?? "expense");
    setMoneyType(initial?.moneyType ?? "expense");
    setCategory(initial?.category ?? "Miscellaneous");
    setDescription(initial?.description ?? "");
    setAccount(initial?.account ?? "");
    setPaymentMethod(initial?.paymentMethod ?? "");
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  async function save() {
    if (!amount || !description.trim()) {
      toast.error("Enter amount and description");
      return;
    }
    const parts = dateToParts(date);
    const now = new Date().toISOString();
    const txn: Transaction = {
      id: initial?.id ?? uuid(),
      date, monthKey: parts.monthKey, year: parts.year, month: parts.month,
      description: description.trim(),
      amount: Math.abs(amount),
      direction, moneyType, category,
      account: account || undefined,
      paymentMethod: paymentMethod || undefined,
      notes: notes || undefined,
      isRecurring: initial?.isRecurring ?? false,
      tags: initial?.tags ?? [],
      source: initial?.source ?? "manual",
      importBatchId: initial?.importBatchId,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    await db.transactions.put(txn);
    toast.success(initial?.id ? "Transaction updated" : "Transaction added");
    onOpenChange(false);
  }

  const visibleCats = categories.filter((c) => c.type === "both" || (direction === "income" ? c.type === "income" : c.type === "expense"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Transaction" : "New Transaction"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Apartment rent" />
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" value={amount || ""} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v: Direction) => {
              setDirection(v);
              setMoneyType(v === "income" ? "other_income" : "expense");
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={moneyType} onValueChange={(v) => setMoneyType(v as MoneyType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONEY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {visibleCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Account</Label>
            <Select value={account || "_none"} onValueChange={(v) => setAccount(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Payment method</Label>
            <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="UPI, card, cash..." />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
