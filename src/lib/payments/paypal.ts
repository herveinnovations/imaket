import { PaymentError, type PaymentProvider } from "./types";

/**
 * PayPal Orders v2. Buyer approves on PayPal, returns to our callback,
 * where verify() CAPTURES the order (capture is the moment money moves).
 * Webhook (optional, belt and braces): PAYMENT.CAPTURE.COMPLETED → /api/webhooks/paypal
 * Note: PayPal does not support ZMW/NGN/KES etc. — charge USD for those stores.
 */
const base = () => (process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

async function token() {
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new PaymentError("PayPal auth failed", "paypal", json);
  return json.access_token as string;
}

async function pp<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok && !(res.status === 422 && JSON.stringify(json).includes("ORDER_ALREADY_CAPTURED"))) {
    throw new PaymentError(json?.message ?? "PayPal request failed", "paypal", json);
  }
  return json as T;
}

type PPOrder = {
  id: string; status: string;
  links: { rel: string; href: string }[];
  purchase_units: { custom_id?: string; amount?: { value: string; currency_code: string };
    payments?: { captures?: { status: string; amount: { value: string; currency_code: string } }[] } }[];
};

export const SUPPORTED = ["USD", "EUR", "GBP", "CAD", "AUD"];

export const paypalProvider: PaymentProvider = {
  id: "paypal",
  label: "PayPal",
  currencies: SUPPORTED,
  isConfigured: () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),

  async createCheckout(i) {
    const order = await pp<PPOrder>("/v2/checkout/orders", "POST", {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: i.orderNumber,
        custom_id: i.orderId,
        description: i.description.slice(0, 127),
        amount: { currency_code: i.currency, value: i.amount.toFixed(2) },
      }],
      payment_source: {
        paypal: { experience_context: { return_url: i.returnUrl, cancel_url: i.cancelUrl, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" } },
      },
    });
    const approve = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
    return { reference: order.id, redirectUrl: approve?.href, raw: order };
  },

  async verify(reference) {
    let order = await pp<PPOrder>(`/v2/checkout/orders/${reference}`);
    if (order.status === "APPROVED") order = await pp<PPOrder>(`/v2/checkout/orders/${reference}/capture`, "POST", {});
    const pu = order.purchase_units[0];
    const cap = pu.payments?.captures?.[0];
    return {
      reference: order.id,
      orderId: pu.custom_id,
      status: order.status === "COMPLETED" && cap?.status === "COMPLETED" ? "succeeded"
        : ["VOIDED"].includes(order.status) ? "failed" : "pending",
      amount: Number(cap?.amount.value ?? pu.amount?.value),
      currency: cap?.amount.currency_code ?? pu.amount?.currency_code,
      method: "paypal",
      raw: order,
    };
  },

  async parseWebhook(rawBody, headers) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) return null;
    const event = JSON.parse(rawBody);
    const check = await pp<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", "POST", {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    });
    if (check.verification_status !== "SUCCESS") return null;
    if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return null;
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id as string | undefined;
    if (!orderId) return null;
    return this.verify(orderId);
  },
};
