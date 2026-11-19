import type { Metadata } from "next";
import { PageHeader, StatCard } from "@/components/dashboard/widgets";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { ExportCsvButton } from "@/components/dashboard/export-csv";
import { requireRole } from "@/lib/auth";
import { getAllOrders } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  await requireRole(["admin"], "/admin/transactions");
  const orders = await getAllOrders(200);
  const failed = orders.filter((o) => o.status === "failed").length;
  const pending = orders.filter((o) => o.status === "pending").length;
  return (
    <>
      <PageHeader title="Transactions" description="Every order across the platform, with payment method and status."
        actions={<ExportCsvButton filename="transactions.csv" rows={orders.map((o) => ({ order: o.order_number, email: o.customer_email, status: o.status, provider: o.payment_provider, currency: o.currency, total: Number(o.total), created_at: o.created_at }))} />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Shown" value={orders.length.toLocaleString()} />
        <StatCard label="Pending payment" value={String(pending)} hint="Waiting on the provider" />
        <StatCard label="Failed" value={String(failed)} hint={orders.length ? `${((failed / orders.length) * 100).toFixed(1)}% failure rate` : undefined} />
      </div>
      <OrdersTable orders={orders} admin />
    </>
  );
}
