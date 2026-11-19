import crypto from "node:crypto";
import { PaymentError, fromMinor, toMinor, type PaymentProvider } from "./types";

/**
 * Stripe Checkout via the REST API (no SDK dependency).
 * Webhook: point Stripe at /api/webhooks/stripe, events:
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   checkout.session.async_payment_failed
 */
const API = "https://api.stripe.com/v1";
const key = () => process.env.STRIPE_SECRET_KEY ?? "";

async function stripe<T>(path: string, init: RequestInit & { form?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.form ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: init.form ? new URLSearchParams(init.form).toString() : undefined,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new PaymentError(json?.error?.message ?? "Stripe request failed", "stripe", json);
  return json as T;
}

type Session = {
  id: string; url: string; payment_status: "paid" | "unpaid" | "no_payment_required";
  status: string; amount_total: number; currency: string; client_reference_id: string;
};

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Card (Stripe)",
  currencies: null,
  isConfigured: () => Boolean(key()),

  async createCheckout(i) {
    const s = await stripe<Session>("/checkout/sessions", {
      form: {
        mode: "payment",
        client_reference_id: i.orderId,
        customer_email: i.customer.email,
        success_url: `${i.returnUrl}${i.returnUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: i.cancelUrl,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": i.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": String(toMinor(i.amount, i.currency)),
        "line_items[0][price_data][product_data][name]": i.description.slice(0, 250),
        "metadata[order_id]": i.orderId,
        "metadata[order_number]": i.orderNumber,
        "payment_intent_data[metadata][order_id]": i.orderId,
      },
    });
    return { reference: s.id, redirectUrl: s.url, raw: s };
  },

  async verify(reference) {
    const s = await stripe<Session>(`/checkout/sessions/${reference}`);
    return {
      reference: s.id,
      orderId: s.client_reference_id,
      status: s.payment_status === "paid" ? "succeeded" : s.status === "expired" ? "failed" : "pending",
      amount: fromMinor(s.amount_total, s.currency),
      currency: s.currency.toUpperCase(),
      method: "card",
      raw: s,
    };
  },

  async parseWebhook(rawBody, headers) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = headers.get("stripe-signature");
    if (!secret || !sig) return null;
    const parts = Object.fromEntries(sig.split(",").map((kv) => kv.split("=") as [string, string]));
    const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
    const ok = sig.split(",").some((kv) => {
      const [k, v] = kv.split("=");
      return k === "v1" && v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
    });
    if (!ok || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return null;

    const event = JSON.parse(rawBody) as { type: string; data: { object: Session } };
    const s = event.data.object;
    const map: Record<string, "succeeded" | "failed"> = {
      "checkout.session.completed": s.payment_status === "paid" ? "succeeded" : ("pending" as never),
      "checkout.session.async_payment_succeeded": "succeeded",
      "checkout.session.async_payment_failed": "failed",
    };
    const status = map[event.type];
    if (!status) return null;
    return {
      reference: s.id, orderId: s.client_reference_id, status,
      amount: fromMinor(s.amount_total, s.currency), currency: s.currency.toUpperCase(), method: "card", raw: event,
    };
  },
};
