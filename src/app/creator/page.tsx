import Link from "next/link";
import { Package, Receipt } from "lucide-react";
import { PageHeader, Panel, StatCard } from "@/components/dashboard/widgets";
import { RevenueChart } from "@/components/dashboard/charts";
import { NewProductButton } from "@/components/dashboard/product-upload-modal";
import { ShareStoreButton } from "@/components/dashboard/share-store";
import { EmptyState, StatusBadge } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireCreator } from "@/lib/auth";
import { getCategories } from "@/lib/data/catalog";
import { getCreatorOrders, getCreatorStats } from "@/lib/data/dashboard";
import { formatMoney, percentChange, timeAgo } from "@/lib/utils";

export default async function CreatorOverview() {
  const { creator, user } = await requireCreator();
  const [stats, orders, categories] = await Promise.all([getCreatorStats(creator.id), getCreatorOrders(creator.id, 6), getCategories()]);
  const cur = creator.currency;
  const first = (user.full_name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader
        title={first ? `Hi ${first}` : "Overview"}
        description="Here's how your store did over the last 30 days."
        actions={<><ShareStoreButton handle={creator.handle} /><NewProductButton categories={categories} currency={cur} /></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard emphasis label="Available to withdraw" value={formatMoney(stats.balance.available, cur)} hint={`${formatMoney(stats.balance.pending, cur)} clearing`} />
        <StatCard label="Revenue" value={formatMoney(stats.revenue30, cur)} change={percentChange(stats.revenue30, stats.revenuePrev30)} hint="vs previous 30 days" />
        <StatCard label="Orders" value={stats.orders30.toLocaleString()} change={percentChange(stats.orders30, stats.ordersPrev30)} hint="vs previous 30 days" />
        <StatCard label="Store visits" value={stats.views30.toLocaleString()} hint={`${stats.conversion}% bought something`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Earnings, last 30 days" action={<Link href="/creator/analytics" className="text-sm text-brand hover:underline">Full analytics</Link>}>
          <RevenueChart data={stats.series as unknown as Record<string, number | string>[]} currency={cur} />
        </Panel>
        <Panel title="Best sellers">
          {stats.topProducts.length === 0 ? (
            <EmptyState icon={Package} title="No sales yet" body="Your top products will show up here." />
          ) : (
            <ol className="space-y-4">
              {stats.topProducts.slice(0, 5).map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-semibold">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="text-xs text-muted">{p.sales} sales</span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatMoney(p.revenue, cur)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="Recent orders" className="mt-6" action={<Link href="/creator/orders" className="text-sm text-brand hover:underline">All orders</Link>}>
        {orders.length === 0 ? (
          <EmptyState icon={Receipt} title="No orders yet" body="Share your store link on WhatsApp and Instagram to get your first sale."
            action={<ButtonLink href={`/${creator.handle}`} variant="secondary">View your store</ButtonLink>} />
        ) : (
          <ul className="divide-y">
            {orders.map((o) => {
              const mine = (o.items ?? []).filter((i) => i.creator_id === creator.id);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{mine.map((i) => i.title).join(", ")}</span>
                    <span className="text-xs text-muted">{o.customer_name ?? o.customer_email} · {o.order_number} · {timeAgo(o.created_at)}</span>
                  </span>
                  <StatusBadge status={o.status} />
                  <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatMoney(mine.reduce((s, i) => s + Number(i.creator_earnings), 0), o.currency)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
