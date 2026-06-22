import { formatINR } from "@/lib/formatting";
import type { LucideIcon } from "lucide-react";

interface KpiProps {
  label: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
  accent: "income" | "expense" | "savings" | "cashback" | "balance";
}

const ACCENT_BG: Record<KpiProps["accent"], string> = {
  income: "bg-income/15 text-income",
  expense: "bg-expense/15 text-expense",
  savings: "bg-savings/15 text-savings",
  cashback: "bg-cashback/15 text-cashback",
  balance: "bg-balance/15 text-balance",
};

export function KpiCard({ label, value, hint, icon: Icon, accent }: KpiProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${ACCENT_BG[accent]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 font-display text-2xl font-semibold tracking-tight">{formatINR(value)}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
