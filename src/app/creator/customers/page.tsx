import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/dashboard/widgets";
import { ExportCsvButton } from "@/components/dashboard/export-csv";
import { Avatar, EmptyState, Table, THead } from "@/components/ui/primitives";
import { requireCreator } from "@/lib/auth";
import { getCreatorCustomers } from "@/lib/data/dashboard";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const { creator } = await requireCreator("/creator/customers");
  const customers = await getCreatorCustomers(creator.id);
  const repeat = customers.filter((c) => c.orders > 1).length;
  const total = customers.reduce((s, c) => s + c.spent, 0);

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has bought from your store."
        actions={<ExportCsvButton filename="customers.csv" rows={customers.map((c) => ({ name: c.name, email: c.email, orders: c.orders, spent: c.spent, currency: c.currency, last_order: c.last }))} />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Customers" value={customers.length.toLocaleString()} />
        <StatCard label="Bought more than once" value={`${customers.length ? Math.round((repeat / customers.length) * 100) : 0}%`} hint={`${repeat} people`} />
        <StatCard label="Average spend" value={formatMoney(customers.length ? total / customers.length : 0, creator.currency)} />
      </div>
      {customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" body="When someone buys, they'll show up here with their order history." />
      ) : (
        <Table>
          <THead cols={["Customer", { label: "Orders", className: "text-right" }, { label: "Spent", className: "text-right" }, "Last order"]} />
          <tbody className="divide-y">
            {customers.map((c) => (
              <tr key={c.email}>
                <td data-label="">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name ?? c.email} size={34} color="#5C637A" />
                    <div><p className="font-medium">{c.name ?? "—"}</p><a href={`mailto:${c.email}`} className="text-xs text-muted hover:text-brand">{c.email}</a></div>
                  </div>
                </td>
                <td data-label="Orders" className="text-right tabular-nums">{c.orders}</td>
                <td data-label="Spent" className="text-right font-medium tabular-nums">{formatMoney(c.spent, c.currency)}</td>
                <td data-label="Last order" className="text-muted">{formatDate(c.last)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
