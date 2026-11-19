import crypto from "node:crypto";
import { PaymentError, type PaymentProvider } from "./types";

/**
 * Flutterwave Standard (hosted checkout) — cards, mobile money (ZM, GH, UG,
 * RW, KE M-Pesa, francophone), bank transfer, USSD.
 * Webhook: set URL /api/webhooks/flutterwave and a "secret hash" in the
 * dashboard; it arrives in the `verif-hash` header.
 */
const API = "https://api.flutterwave.com/v3";
const key = () => process.env.FLUTTERWAVE_SECRET_KEY ?? "";

async function flw<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || json.status !== "success") throw new PaymentError(json?.message ?? "Flutterwave request failed", "flutterwave", json);
  return json as T;
}

/** Payment options shown on the hosted page, per currency */
export const FLW_OPTIONS: Record<string, string> = {
  ZMW: "card,mobilemoneyzambia",
  GHS: "card,mobilemoneyghana",
  UGX: "card,mobilemoneyuganda",
  RWF: "card,mobilemoneyrwanda",
  KES: "card,mpesa",
  TZS: "card,mobilemoneytanzania",
  XAF: "card,mobilemoneyfranco",
  XOF: "card,mobilemoneyfranco",
  NGN: "card,banktransfer,ussd,account",
  ZAR: "card,banktransfer",
  USD: "card",
};

type Tx = { id: number; tx_ref: string; status: string; amount: number; charged_amount: number; currency: string; payment_type: string; meta?: Record<string, string> };

export const flutterwaveProvider: PaymentProvider = {
  id: "flutterwave",
  label: "Card & mobile money (Flutterwave)",
  currencies: Object.keys(FLW_OPTIONS),
  isConfigured: () => Boolean(key()),

  async createCheckout(i) {
    const txRef = `${i.orderNumber}-${Date.now().toString(36)}`;
    const res = await flw<{ data: { link: string } }>("/payments", {
      tx_ref: txRef,
      amount: i.amount,
      currency: i.currency,
      redirect_url: i.returnUrl,
      payment_options: FLW_OPTIONS[i.currency] ?? "card",
      customer: { email: i.customer.email, name: i.customer.name ?? undefined, phonenumber: i.momo?.phone ?? i.customer.phone ?? undefined },
      meta: { order_id: i.orderId, order_number: i.orderNumber },
      customizations: { title: process.env.NEXT_PUBLIC_APP_NAME ?? "iMaket", description: i.description.slice(0, 100) },
    });
    return { reference: txRef, redirectUrl: res.data.link, raw: res };
  },

  async verify(reference) {
    const res = await flw<{ data: Tx }>(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);
    const t = res.data;
    return {
      reference: t.tx_ref,
      orderId: t.meta?.order_id,
      status: t.status === "successful" ? "succeeded" : t.status === "failed" ? "failed" : "pending",
      amount: Number(t.amount),
      currency: t.currency,
      method: t.payment_type,
      raw: t,
    };
  },

  async parseWebhook(rawBody, headers) {
    const secret = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    const given = headers.get("verif-hash");
    if (!secret || !given || given.length !== secret.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))) return null;
    const event = JSON.parse(rawBody);
    if (event.event !== "charge.completed" || !event.data?.tx_ref) return null;
    // Never trust the payload's status — re-verify with the API.
    return this.verify(event.data.tx_ref);
  },
};
