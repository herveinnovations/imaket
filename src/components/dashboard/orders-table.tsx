"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Receipt, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusBadge, Table, THead } from "@/components/ui/primitives";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { Order } from "@/lib/types";

const PROVIDER_LABEL: Record<string, string> = { mobile_money: "Mobile money", flutterwave: "Flutterwave", dusupay: "DusuPay", stripe: "Card", paypal: "PayPal" };

/** Creator orders. Shows only this creator's lines; live-updates via Supabase Realtime. */
export function OrdersTable({ orders, creatorId, admin }: { orders: Order[]; creatorId?: string; admin?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb || !creatorId) return;
    const ch = sb.channel(`orders:${creatorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imaket_order_items", filter: `creator_id=eq.${creatorId}` }, () => router.refresh())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [creatorId, router]);

  const shown = useMemo(() => orders.filter((o) =>
    (status === "all" || o.status === status) &&
    (!q || [o.order_number, o.customer_email, o.customer_name, ...(o.items ?? []).map((i) => i.title)].some((s) => s?.toLowerCase().includes(q.toLowerCase())))), [orders, q, status]);

  async function markShipped(itemId: string) {
    const tracking = prompt("Tracking number or courier note (optional)") ?? "";
    setBusy(itemId);
    const res = await fetch(`/api/orders/items/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fulfillment_status: "shipped", tracking_number: tracking || null }) });
    setBusy(null);
    if (!res.ok) return toast.error("Couldn't update the order.");
    toast.success("Marked as shipped. The buyer has been notified.");
    router.refresh();
  }

  if (!orders.length) return <EmptyState icon={Receipt} title="No orders yet" body="Orders appear here the moment a buyer pays." />;

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order, buyer or product" className="input h-10 pl-9" aria-label="Search orders" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input h-10 w-auto pr-8" aria-label="Filter by status">
          {["all", "paid", "fulfilled", "pending", "failed", "refunded"].map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>
      <Table>
        <THead cols={["Order", "Buyer", "Items", "Payment", "Status", { label: admin ? "Total" : "You earn", className: "text-right" }]} />
        <tbody className="divide-y">
          {shown.map((o) => {
            const lines = admin ? o.items ?? [] : (o.items ?? []).filter((i) => !creatorId || i.creator_id === creatorId);
            const amount = admin ? Number(o.total) : lines.reduce((s, i) => s + Number(i.creator_earnings), 0);
            return (
              <tr key={o.id} className="align-top">
                <td data-label="Order"><span className="font-medium">{o.order_number}</span><span className="block text-xs text-muted">{formatDate(o.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></td>
                <td data-label="Buyer"><span className="block">{o.customer_name ?? "—"}</span><span className="text-xs text-muted">{o.customer_email}</span></td>
                <td data-label="Items">
                  <ul className="space-y-1">
                    {lines.map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center gap-2">
                        <span>{i.title}{i.quantity > 1 && ` ×${i.quantity}`}</span>
                        {i.product_type === "physical" && (
                          i.fulfillment_status === "unfulfilled" && o.status === "paid" && !admin
                            ? <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" loading={busy === i.id} onClick={() => markShipped(i.id)}><Truck className="h-3.5 w-3.5" /> Mark shipped</Button>
                            : <StatusBadge status={i.fulfillment_status} />
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
                <td data-label="Payment" className="text-muted">{o.payment_provider ? PROVIDER_LABEL[o.payment_provider] : "—"}</td>
                <td data-label="Status"><StatusBadge status={o.status} /></td>
                <td data-label={admin ? "Total" : "You earn"} className={cn("text-right font-semibold tabular-nums", o.status === "refunded" && "text-muted line-through")}>{formatMoney(amount, o.currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {shown.length === 0 && <p className="py-10 text-center text-sm text-muted">No orders match those filters.</p>}
    </>
  );
}
