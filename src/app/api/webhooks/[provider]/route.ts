import { NextResponse } from "next/server";
import { getProvider } from "@/lib/payments";
import { finalizePaidOrder } from "@/lib/orders";
import type { PaymentProviderId } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/{stripe|paypal|flutterwave|dusupay|mobile_money}
 * Signature-verified, then re-verified with the provider API before the
 * order is finalised. Always 200 for valid-but-irrelevant events so the
 * provider stops retrying; unsigned/invalid payloads are ignored (never finalised).
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params;
  const provider = getProvider(id);
  if (!provider) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const raw = await req.text();
  let result;
  try {
    result = await provider.parseWebhook(raw, req.headers);
  } catch (e) {
    console.error(`[webhook:${id}] parse error`, e);
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  if (!result) return NextResponse.json({ received: true, ignored: true }, { status: 200 });

  try {
    const res = await finalizePaidOrder({ ...result, provider: id as PaymentProviderId });
    return NextResponse.json({ received: true, ...res });
  } catch (e) {
    console.error(`[webhook:${id}] finalize error`, e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 }); // provider will retry
  }
}
