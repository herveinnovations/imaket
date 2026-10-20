import crypto from "node:crypto";
import { PaymentError, type PaymentProvider } from "./types";

/**
 * DusuPay collections — mobile money across ZM, UG, KE, TZ, RW, GH, CM and cards.
 *
 * ⚠ Field names follow DusuPay's v1 collections API. Confirm them against
 *   your merchant dashboard docs before going live (provider codes in
 *   particular differ per country, e.g. "mtn_zm", "airtel_ug").
 *
 * Webhook: configure /api/webhooks/dusupay. DusuPay signs callbacks; set
 * DUSUPAY_WEBHOOK_SECRET to the signing secret and adjust verifySignature()
 * if your account uses their RSA public-key scheme instead of HMAC.
 */
const base = () => (process.env.DUSUPAY_ENV === "live" ? "https://api.dusupay.com" : "https://sandboxapi.dusupay.com");
const secret = () => process.env.DUSUPAY_SECRET_KEY ?? "";

async function dusu<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "public-key": process.env.DUSUPAY_PUBLIC_KEY ?? "",
      "secret-key": secret(),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || json.status === "error") throw new PaymentError(json?.message ?? "DusuPay request failed", "dusupay", json);
  return json as T;
}

/** network (as shown in our UI) + country → DusuPay provider code */
export function dusupayProviderCode(network: string, country: string) {
  return `${network.toLowerCase()}_${country.toLowerCase()}`; // e.g. mtn_zm, airtel_zm, zamtel_zm, mpesa_ke
}

type Collection = {
  data: { id: number; internal_reference: string; merchant_reference: string; transaction_status: string;
    request_amount: number; request_currency: string; payment_url?: string; transaction_method?: string };
};

const mapStatus = (s?: string) =>
  s === "COMPLETED" ? "succeeded" : s === "FAILED" || s === "CANCELLED" ? "failed" : "pending";

export const dusupayProvider: PaymentProvider = {
  id: "dusupay",
  label: "Mobile money (DusuPay)",
  currencies: ["ZMW", "UGX", "KES", "TZS", "RWF", "GHS", "XAF", "USD"],
  isConfigured: () => Boolean(secret() && process.env.DUSUPAY_PUBLIC_KEY),

  async createCheckout(i) {
    const merchantRef = `${i.orderNumber}-${Date.now().toString(36)}`;
    const isMomo = Boolean(i.momo);
    const res = await dusu<Collection>("/v1/collections", {
      merchant_reference: merchantRef,
      transaction_method: isMomo ? "MOBILE_MONEY" : "CARD",
      currency: i.currency,
      amount: i.amount,
      provider_code: isMomo ? dusupayProviderCode(i.momo!.network, i.momo!.country) : `local_${i.currency.toLowerCase()}`,
      account_number: i.momo?.phone,
      customer_email: i.customer.email,
      customer_name: i.customer.name,
      narration: i.description.slice(0, 100),
      redirect_url: i.returnUrl,
      mobile_money_hpp: false,
    });
    return {
      reference: merchantRef,
      redirectUrl: res.data.payment_url,
      awaitingCustomerApproval: isMomo && !res.data.payment_url,
      instructions: isMomo ? `Approve the ${i.momo!.network} prompt on ${i.momo!.phone} to complete payment.` : undefined,
      raw: res,
    };
  },

  async verify(reference) {
    const res = await dusu<Collection>(`/v1/merchant-verify-transaction?merchant_reference=${encodeURIComponent(reference)}`);
    return {
      reference: res.data.merchant_reference,
      status: mapStatus(res.data.transaction_status),
      amount: Number(res.data.request_amount),
      currency: res.data.request_currency,
      method: res.data.transaction_method?.toLowerCase(),
      raw: res,
    };
  },

  async parseWebhook(rawBody, headers) {
    const sigSecret = process.env.DUSUPAY_WEBHOOK_SECRET;
    const sig = headers.get("dusupay-signature") ?? headers.get("x-dusupay-signature");
    if (!sigSecret || !sig) return null;
    const expected = crypto.createHmac("sha512", sigSecret).update(rawBody).digest("hex");
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const event = JSON.parse(rawBody);
    const ref = event?.data?.merchant_reference ?? event?.merchant_reference;
    if (!ref) return null;
    return this.verify(ref); // re-verify server-to-server
  },
};
