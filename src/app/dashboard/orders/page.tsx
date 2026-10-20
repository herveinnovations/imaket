import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/dashboard/widgets";
import { EmptyState, StatusBadge, Table, THead } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth";
import { getCustomerOrders } from "@/lib/data/dashboard";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

export default async function CustomerOrdersPage() {
  const { user } = await requireRole(["customer", "creator", "admin"], "/dashboard/orders");
  const orders = await getCustomerOrders(user.id);
  return (
    <>
      <PageHeader title="Order history" description="Receipts for everything you've bought on iMaket." />
      {orders.length === 0 ? <EmptyState icon={Receipt} title="No orders yet" body="Your receipts will appear here after your first purchase." /> : (
        <Table>
          <THead cols={["Order", "Items", "Date", "Status", { label: "Total", className: "text-right" }]} />
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id}>
                <td data-label="Order" className="font-medium">{o.order_number}</td>
                <td data-label="Items">{(o.items ?? []).map((i) => <span key={i.id} className="block">{i.title}{i.quantity > 1 && ` ×${i.quantity}`}</span>)}</td>
                <td data-label="Date" className="text-muted">{formatDate(o.created_at)}</td>
                <td data-label="Status"><StatusBadge status={o.status} /></td>
                <td data-label="Total" className="text-right font-semibold tabular-nums">{formatMoney(Number(o.total), o.currency)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
