import type { Metadata } from "next";
import { HBarList, PageHeader, Panel, StatCard } from "@/components/dashboard/widgets";
import { OrdersBarChart, RevenueChart } from "@/components/dashboard/charts";
import { requireRole } from "@/lib/auth";
import { getAdminStats, getAllCreators, getAllOrders } from "@/lib/data/dashboard";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const PROVIDER_LABEL: Record<string, string> = { mobile_money: "Mobile money", flutterwave: "Flutterwave", dusupay: "DusuPay", stripe: "Stripe", paypal: "PayPal" };

export default async function AdminAnalyticsPage() {
  await requireRole(["admin"], "/admin/analytics");
  const [s, orders, creators] = await Promise.all([getAdminStats(), getAllOrders(500), getAllCreators()]);
  const cur = env.defaultCurrency;
  const byProvider = new Map<string, number>();
  orders.filter((o) => o.status === "paid").forEach((o) => byProvider.set(o.payment_provider ?? "other", (byProvider.get(o.payment_provider ?? "other") ?? 0) + 1));
  const byCountry = new Map<string, number>();
  creators.forEach((c) => byCountry.set(c.country ?? "—", (byCountry.get(c.country ?? "—") ?? 0) + 1));
  const take = (m: Map<string, number>, label = (k: string) => k) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: label(k), value: v }));
  const aov = s.orders30 ? s.gmv30 / s.orders30 : 0;

  return (
    <>
      <PageHeader title="Platform analytics" description="Last 30 days." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross sales" value={formatMoney(s.gmv30, cur)} />
        <StatCard label="Take rate" value={s.gmv30 ? `${((s.fees30 / s.gmv30) * 100).toFixed(1)}%` : "—"} />
        <StatCard label="Average order" value={formatMoney(aov, cur)} />
        <StatCard label="Orders per day" value={(s.orders30 / 30).toFixed(1)} />
      </div>
      <Panel title="Gross sales" className="mt-6"><RevenueChart data={s.series as unknown as Record<string, number | string>[]} currency={cur} dataKey="gmv" secondKey="fees" height={320} /></Panel>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Orders per day"><OrdersBarChart data={s.series} /></Panel>
        <Panel title="Paid orders by method"><HBarList rows={take(byProvider, (k) => PROVIDER_LABEL[k] ?? k)} /></Panel>
        <Panel title="Creators by country"><HBarList rows={take(byCountry)} /></Panel>
      </div>
    </>
  );
}
