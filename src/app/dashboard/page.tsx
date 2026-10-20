import Link from "next/link";
import { Library as LibraryIcon } from "lucide-react";
import { PageHeader, StatCard } from "@/components/dashboard/widgets";
import { Library } from "@/components/dashboard/library";
import { EmptyState, StatusBadge } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { getCustomerDownloads, getCustomerOrders, getWishlist } from "@/lib/data/dashboard";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function CustomerHome() {
  const { user } = await requireRole(["customer", "creator", "admin"], "/dashboard");
  const [orders, downloads, wishlist] = await Promise.all([getCustomerOrders(user.id), getCustomerDownloads(user.id), getWishlist(user.id)]);
  const first = (user.full_name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader title={first ? `Welcome back, ${first}` : "Your account"} description="Your purchases, downloads and saved products." />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Items in your library" value={String(downloads.length)} />
        <StatCard label="Orders" value={String(orders.length)} />
        <StatCard label="Saved for later" value={String(wishlist.length)} />
      </div>

      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-xl font-bold">Recently bought</h2>
        <Link href="/dashboard/downloads" className="text-sm text-brand hover:underline">Open library</Link>
      </div>
      {downloads.length ? <Library items={downloads.slice(0, 4)} /> : (
        <EmptyState icon={LibraryIcon} title="Nothing here yet" body="Things you buy show up here, ready to download." action={<ButtonLink href="/marketplace">Browse the marketplace</ButtonLink>} />
      )}

      {orders.some((o) => o.items?.some((i) => i.product_type === "physical")) && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">Deliveries</h2>
          <ul className="card divide-y">
            {orders.flatMap((o) => (o.items ?? []).filter((i) => i.product_type === "physical").map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 p-4">
                <span><span className="block font-medium">{i.title}</span><span className="text-sm text-muted">{o.order_number} · {formatDate(o.created_at)}</span></span>
                <span className="flex items-center gap-3"><StatusBadge status={i.fulfillment_status} /><span className="font-medium">{formatMoney(Number(i.line_total), o.currency)}</span></span>
              </li>
            )))}
          </ul>
        </section>
      )}
    </>
  );
}
