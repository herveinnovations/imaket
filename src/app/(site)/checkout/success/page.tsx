import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Payment received", robots: { index: false } };

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderId } = await searchParams;
  let order: { order_number: string; total: number; currency: string; customer_email: string; status: string } | null = null;
  if (!isDemoMode && orderId && /^[0-9a-f-]{36}$/.test(orderId)) {
    const { data } = await getAdminSupabase().from("imaket_orders").select("order_number, total, currency, customer_email, status").eq("id", orderId).maybeSingle();
    order = data;
  }
  if (isDemoMode) order = { order_number: "SK-DEMO01", total: 0, currency: "ZMW", customer_email: "you@example.com", status: "paid" };
  const paid = order?.status === "paid" || order?.status === "fulfilled";

  return (
    <div className="container flex max-w-xl flex-col items-center py-24 text-center">
      <CircleCheck className="h-16 w-16 text-brand" strokeWidth={1.5} />
      <h1 className="mt-6 text-4xl font-bold">{paid ? "Payment received" : "Confirming your payment"}</h1>
      {order && (
        <p className="mt-4 text-lg text-muted">
          Order {order.order_number}{order.total > 0 && <> · {formatMoney(order.total, order.currency)}</>}.{" "}
          {paid ? <>A receipt and your access links are on their way to <strong className="text-fg">{order.customer_email}</strong>.</>
            : "This usually takes a few seconds. You'll get an email the moment it clears."}
        </p>
      )}
      {isDemoMode && <p className="mt-3 text-sm text-muted">Demo mode: no real payment was taken.</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/dashboard/downloads">Open your purchases</ButtonLink>
        <ButtonLink href="/marketplace" variant="secondary">Keep browsing</ButtonLink>
      </div>
    </div>
  );
}
