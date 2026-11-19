import Link from "next/link";
import { PageHeader, Panel, StatCard } from "@/components/dashboard/widgets";
import { RevenueChart } from "@/components/dashboard/charts";
import { StatusBadge } from "@/components/ui/primitives";
import { getAdminStats, getAllOrders, getModerationQueue } from "@/lib/data/dashboard";
import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { formatCompact, formatMoney, percentChange, timeAgo } from "@/lib/utils";

export default async function AdminOverview() {
  await requireRole(["admin"], "/admin");
  const [s, queue, orders] = await Promise.all([getAdminStats(), getModerationQueue(), getAllOrders(8)]);
  const cur = env.defaultCurrency;

  return (
    <>
      <PageHeader title="Platform overview" description={`Last 30 days, shown in ${cur}. Multi-currency totals are converted at the daily rate in production reporting.`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard emphasis label="Gross sales" value={formatMoney(s.gmv30, cur)} change={percentChange(s.gmv30, s.gmvPrev30)} hint="vs previous 30 days" />
        <StatCard label="Platform revenue" value={formatMoney(s.fees30, cur)} hint="Fees earned" />
        <StatCard label="Paid orders" value={s.orders30.toLocaleString()} />
        <StatCard label="Creators · customers" value={`${formatCompact(s.creators)} · ${formatCompact(s.customers)}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Gross sales and fees">
          <RevenueChart data={s.series as unknown as Record<string, number | string>[]} currency={cur} dataKey="gmv" secondKey="fees" />
        </Panel>
        <Panel title="Needs attention">
          <ul className="space-y-3">
            <li><Link href="/admin/moderation" className="flex items-center justify-between rounded-xl border p-4 hover:border-fg/25">
              <span><span className="block font-medium">Products awaiting review</span><span className="text-sm text-muted">Oldest first</span></span>
              <span className="font-display text-3xl font-bold text-warning">{s.pendingProducts}</span></Link></li>
            <li><Link href="/admin/payouts" className="flex items-center justify-between rounded-xl border p-4 hover:border-fg/25">
              <span><span className="block font-medium">Payout requests</span><span className="text-sm text-muted">Requested or processing</span></span>
              <span className="font-display text-3xl font-bold text-warning">{s.pendingPayouts}</span></Link></li>
          </ul>
          {queue[0] && <p className="mt-4 text-sm text-muted">Next up: <span className="text-fg">{queue[0].title}</span> by {queue[0].creator?.store_name}</p>}
        </Panel>
      </div>

      <Panel title="Latest transactions" className="mt-6" action={<Link href="/admin/transactions" className="text-sm text-brand hover:underline">All transactions</Link>}>
        <ul className="divide-y">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{o.items?.map((i) => i.title).join(", ")}</span>
                <span className="text-xs text-muted">{o.order_number} · {o.customer_email} · {timeAgo(o.created_at)}</span>
              </span>
              <StatusBadge status={o.status} />
              <span className="w-28 text-right text-sm font-semibold tabular-nums">{formatMoney(Number(o.total), o.currency)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
