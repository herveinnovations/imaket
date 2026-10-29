import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[2rem] sm:text-[2.3rem]">{title}</h1>
        {description && <p className="mt-1.5 text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, change, hint, emphasis }: { label: string; value: string; change?: number; hint?: string; emphasis?: boolean }) {
  const up = (change ?? 0) >= 0;
  return (
    <div className={cn("border p-5", emphasis ? "border-black bg-black text-lime" : "border-black/20 bg-lime/0")}>
      <p className={cn("text-sm", emphasis ? "text-white" : "")}>{label}</p>
      <p className="mt-2 font-display text-[1.9rem] leading-none tabular-nums">{value}</p>
      {(change != null || hint) && (
        <p className={cn("mt-3 flex items-center gap-1 text-sm", emphasis ? "text-white" : "text-muted")}>
          {change != null && (
            <span className={cn("inline-flex items-center font-medium", up ? (emphasis ? "text-lime" : "text-success") : "text-danger")}>
              {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("card p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-sans text-base font-semibold tracking-normal">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Horizontal bars as plain HTML: crisp, accessible, server-rendered. */
export function HBarList({ rows, currency }: { rows: { label: string; value: number }[]; currency?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const fmt = (n: number) => (currency ? formatMoney(n, currency) : n.toLocaleString());
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between gap-4 text-sm"><span className="truncate">{r.label}</span><span className="shrink-0 tabular-nums text-muted">{fmt(r.value)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
