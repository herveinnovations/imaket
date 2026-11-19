import type { PaymentProviderId } from "@/lib/types";

export interface CheckoutInput {
  orderId: string;
  orderNumber: string;
  amount: number;            // major units (e.g. 150.00)
  currency: string;          // ISO 4217
  description: string;
  customer: { email: string; name?: string | null; phone?: string | null };
  /** For mobile money: network code e.g. MTN, AIRTEL, ZAMTEL, MPESA, VODAFONE */
  momo?: { network: string; phone: string; country: string };
  returnUrl: string;         // where the provider redirects the buyer
  cancelUrl: string;
}

export interface CheckoutResult {
  /** Provider's id for this payment (stored in payments.provider_reference) */
  reference: string;
  /** Hosted page to send the buyer to (card / PayPal / hosted MoMo) */
  redirectUrl?: string;
  /** For push-to-phone mobile money: show "approve the prompt on your phone" */
  awaitingCustomerApproval?: boolean;
  instructions?: string;
  raw?: unknown;
}

export interface VerifyResult {
  status: "succeeded" | "failed" | "pending";
  amount?: number;
  currency?: string;
  reference: string;
  orderId?: string;
  method?: string;
  raw?: unknown;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  label: string;
  /** Is the provider configured with credentials? */
  isConfigured(): boolean;
  /** Currencies the provider can charge in (null = any) */
  currencies: string[] | null;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Server-to-server check of a payment's state (never trust redirects alone). */
  verify(reference: string, hint?: Record<string, string>): Promise<VerifyResult>;
  /** Validate signature + parse a webhook. Return null for irrelevant / invalid events. */
  parseWebhook(rawBody: string, headers: Headers): Promise<VerifyResult | null>;
}

export class PaymentError extends Error {
  constructor(message: string, public provider: PaymentProviderId, public details?: unknown) {
    super(message);
  }
}

/** ISO currencies without minor units (Stripe/PayPal amount conversion) */
export const ZERO_DECIMAL = new Set(["UGX", "RWF", "XAF", "XOF", "JPY", "KRW", "BIF", "GNF", "KMF", "MGA", "VND", "VUV", "CLP", "PYG", "DJF"]);
export const toMinor = (amount: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
export const fromMinor = (amount: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : amount / 100;
