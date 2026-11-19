import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getProvider } from "@/lib/payments";
import { finalizePaidOrder } from "@/lib/orders";
import type { PaymentProviderId } from "@/lib/types";

/**
 * Daily housekeeping (Vercel Cron, see vercel.json; on Netlify use a
 * Scheduled Function hitting this URL). Protected by CRON_SECRET.
 *  1. Re-verifies pending payments from the last 24h (catches missed webhooks)
 *  2. Cancels pending orders older than 24h
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

  const db = getAdminSupabase();
  const since = new Date(Date.now() - 86400000).toISOString();
  const { data: pending } = await db.from("imaket_payments").select("order_id, provider, provider_reference").eq("status", "pending").gte("created_at", since).limit(200);

  let recovered = 0;
  for (const p of pending ?? []) {
    const provider = getProvider(p.provider);
    if (!provider?.isConfigured() || !p.provider_reference) continue;
    try {
      const v = await provider.verify(p.provider_reference);
      const res = await finalizePaidOrder({ ...v, orderId: p.order_id, provider: p.provider as PaymentProviderId });
      if (res.ok) recovered++;
    } catch { /* provider unreachable — try tomorrow */ }
  }

  const { data: cancelled } = await db.from("imaket_orders").update({ status: "cancelled" }).eq("status", "pending").lt("created_at", since).select("id");
  return NextResponse.json({ ok: true, recovered, cancelled: cancelled?.length ?? 0 });
}
