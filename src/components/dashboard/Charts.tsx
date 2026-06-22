import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend,
} from "recharts";
import { formatINR } from "@/lib/formatting";

const TT_STYLE = {
  contentStyle: {
    background: "oklch(0.21 0.025 260)",
    border: "1px solid oklch(1 0 0 / 10%)",
    borderRadius: 12,
    color: "oklch(0.97 0.01 250)",
  },
  labelStyle: { color: "oklch(0.7 0.03 255)" },
};

export function OverviewDonut({ income, expense, savings }: { income: number; expense: number; savings: number }) {
  const data = [
    { name: "Income", value: income, color: "oklch(0.72 0.16 245)" },
    { name: "Expense", value: expense, color: "oklch(0.7 0.2 30)" },
    { name: "Savings", value: Math.max(savings, 0), color: "oklch(0.78 0.17 155)" },
  ].filter((d) => d.value > 0);

  if (!data.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3} stroke="none">
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip formatter={(v: any) => formatINR(Number(v))} {...TT_STYLE} />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CashFlowTrend({ data }: { data: { label: string; income: number; expense: number; savings: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
        <XAxis dataKey="label" stroke="oklch(0.7 0.03 255)" tick={{ fontSize: 11 }} />
        <YAxis stroke="oklch(0.7 0.03 255)" tick={{ fontSize: 11 }} tickFormatter={(v: any) => formatINR(Number(v), { compact: true })} />
        <Tooltip formatter={(v: any) => formatINR(Number(v))} {...TT_STYLE} />
        <Legend />
        <Line type="monotone" dataKey="income" stroke="oklch(0.72 0.16 245)" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="expense" stroke="oklch(0.7 0.2 30)" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="savings" stroke="oklch(0.78 0.17 155)" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const CAT_COLORS = [
  "oklch(0.72 0.16 245)", "oklch(0.7 0.2 30)", "oklch(0.78 0.17 155)",
  "oklch(0.72 0.18 305)", "oklch(0.82 0.16 85)", "oklch(0.68 0.16 200)",
  "oklch(0.68 0.18 0)", "oklch(0.75 0.16 130)", "oklch(0.7 0.17 260)",
];

export function ExpenseBreakdown({ data }: { data: { category: string; amount: number }[] }) {
  if (!data.length) return <EmptyChart />;
  const top = data.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={top} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" horizontal={false} />
        <XAxis type="number" stroke="oklch(0.7 0.03 255)" tick={{ fontSize: 11 }} tickFormatter={(v: any) => formatINR(Number(v), { compact: true })} />
        <YAxis type="category" dataKey="category" stroke="oklch(0.7 0.03 255)" tick={{ fontSize: 11 }} width={130} />
        <Tooltip formatter={(v: any) => formatINR(Number(v))} {...TT_STYLE} />
        <Bar dataKey="amount" radius={[0, 8, 8, 0]}>
          {top.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashbackTrend({ data }: { data: { label: string; cashback: number; interest: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
        <XAxis dataKey="label" stroke="oklch(0.7 0.03 255)" tick={{ fontSize: 11 }} />
        <YAxis stroke="oklch(0.7 0.03 255)" tick={{ fontSize: 11 }} tickFormatter={(v: any) => formatINR(Number(v), { compact: true })} />
        <Tooltip formatter={(v: any) => formatINR(Number(v))} {...TT_STYLE} />
        <Legend />
        <Bar dataKey="cashback" fill="oklch(0.72 0.18 305)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="interest" fill="oklch(0.82 0.16 85)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      No data for this period yet.
    </div>
  );
}
