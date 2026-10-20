"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatMoney } from "@/lib/utils";

const axis = { stroke: "rgb(var(--muted))", fontSize: 12, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, currency, valueLabel }: {
  active?: boolean; payload?: { value: number; dataKey: string; color: string; name: string }[]; label?: string; currency?: string; valueLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-surface px-3 py-2 text-sm shadow-card">
      <p className="mb-1 text-xs text-muted">{label && new Date(label).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 font-medium">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name ?? valueLabel}: {currency && p.dataKey !== "orders" ? formatMoney(p.value, currency) : p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

/** Revenue over time (area) with an optional secondary series. */
export function RevenueChart({ data, currency, dataKey = "revenue", secondKey, height = 280 }: {
  data: Record<string, number | string>[]; currency: string; dataKey?: string; secondKey?: string; height?: number;
}) {
  return (
    <div style={{ height }} role="img" aria-label="Revenue over time chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity={0.28} />
              <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 4" />
          <XAxis dataKey="day" {...axis} tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} minTickGap={28} />
          <YAxis {...axis} tickFormatter={(v: number) => formatCompact(v)} width={48} />
          <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: "rgb(var(--muted))", strokeDasharray: "3 3" }} />
          <Area type="monotone" dataKey={dataKey} name="Revenue" stroke="rgb(var(--brand))" strokeWidth={2.25} fill="url(#rev)" activeDot={{ r: 4 }} />
          {secondKey && <Area type="monotone" dataKey={secondKey} name="Platform fees" stroke="rgb(var(--accent))" strokeWidth={2} fill="transparent" />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersBarChart({ data, height = 220 }: { data: { day: string; orders: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Orders per day chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 4" />
          <XAxis dataKey="day" {...axis} tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric" })} minTickGap={12} />
          <YAxis {...axis} allowDecimals={false} width={40} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(var(--surface-2))" }} />
          <Bar dataKey="orders" name="Orders" fill="rgb(var(--fg))" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
