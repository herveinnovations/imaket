import type { Metadata } from "next";
import Link from "next/link";
import { HBarList, PageHeader, Panel, StatCard } from "@/components/dashboard/widgets";
import { OrdersBarChart, RevenueChart } from "@/components/dashboard/charts";
import { requireCreator } from "@/lib/auth";
import { getCreatorStats } from "@/lib/data/dashboard";
import { cn, formatMoney, percentChange } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };
const RANGES = [7, 30, 90] as const;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { creator } = await requireCreator("/creator/analytics");
  const sp = await searchParams;
  const days = RANGES.find((r) => String(r) === sp.days) ?? 30;
  const s = await getCreatorStats(creator.id, days);
  const cur = creator.currency;
  const aov = s.orders30 ? s.revenue30 / s.orders30 : 0;
  const best = [...s.series].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <>
      <PageHeader title="Analytics" description="Where your buyers come from and what they buy."
        actions={
          <div className="inline-flex rounded-xl border bg-surface p-1" role="tablist" aria-label="Date range">
            {RANGES.map((r) => (
              <Link key={r} href={`?days=${r}`} role="tab" aria-selected={r === days}
                className={cn("rounded-lg px-3 py-1.5 text-sm", r === days ? "bg-fg text-bg" : "text-muted hover:text-fg")}>{r} days</Link>
            ))}
          </div>
        } />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Earnings" value={formatMoney(s.revenue30, cur)} change={percentChange(s.revenue30, s.revenuePrev30)} hint={`vs previous ${days} days`} />
        <StatCard label="Orders" value={s.orders30.toLocaleString()} change={percentChange(s.orders30, s.ordersPrev30)} />
        <StatCard label="Average order" value={formatMoney(aov, cur)} />
        <StatCard label="Conversion" value={`${s.conversion}%`} hint={`${s.views30.toLocaleString()} visits`} />
      </div>

      <Panel title="Earnings" className="mt-6" action={best && <span className="text-sm text-muted">Best day: {new Date(best.day).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, {formatMoney(best.revenue, cur)}</span>}>
        <RevenueChart data={s.series as unknown as Record<string, number | string>[]} currency={cur} height={320} />
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Orders per day"><OrdersBarChart data={s.series} /></Panel>
        <Panel title="Where visitors come from">
          {s.trafficSources.length ? <HBarList rows={s.trafficSources.map((t) => ({ label: t.source, value: t.visits }))} />
            : <p className="text-sm text-muted">Visits will appear once people open your store.</p>}
        </Panel>
      </div>

      <Panel title="Revenue by product" className="mt-6">
        <HBarList rows={s.topProducts.map((p) => ({ label: p.title, value: p.revenue }))} currency={cur} />
      </Panel>
    </>
  );
}
