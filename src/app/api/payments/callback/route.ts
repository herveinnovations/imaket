import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";
import { getProvider } from "@/lib/payments";
import { finalizePaidOrder } from "@/lib/orders";
import { env } from "@/lib/env";
import type { PaymentProviderId } from "@/lib/types";

/**
 * GET /api/payments/callback?provider=…&order=…
 * Where hosted checkouts send the buyer back. We NEVER trust query params:
 * the stored provider reference is verified server-to-server.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const providerId = url.searchParams.get("provider") ?? "";
  const orderId = url.searchParams.get("order") ?? "";
  const provider = getProvider(providerId);
  const to = (path: string) => NextResponse.redirect(new URL(path, env.appUrl));
  if (!provider || !/^[0-9a-f-]{36}$/.test(orderId)) return to("/checkout?cancelled=1");

  // Flutterwave appends status=cancelled; PayPal returns token=<orderId>; Stripe session_id
  if (url.searchParams.get("status") === "cancelled") return to("/checkout?cancelled=1");

  const db = getAdminSupabase();
  const { data: payment } = await db.from("imaket_payments").select("provider_reference")
    .eq("order_id", orderId).eq("provider", providerId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const reference = url.searchParams.get("session_id") ?? payment?.provider_reference;
  if (!reference) return to("/checkout?cancelled=1");

  try {
    const v = await provider.verify(reference);
    const res = await finalizePaidOrder({ ...v, orderId, provider: providerId as PaymentProviderId });
    if (res.ok) return to(`/checkout/success?order=${orderId}`);
    if (res.reason === "failed") return to("/checkout?cancelled=1");
  } catch (e) {
    console.error("[callback]", e);
  }
  // Not confirmed yet (async MoMo / bank) — the webhook will finish it
  return to(`/checkout/pending?order=${orderId}`);
}
