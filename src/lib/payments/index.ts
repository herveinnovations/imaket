import type { PaymentProviderId } from "@/lib/types";
import { dusupayProvider } from "./dusupay";
import { flutterwaveProvider } from "./flutterwave";
import { mobileMoneyProvider } from "./mobile-money";
import { paypalProvider } from "./paypal";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export const PROVIDERS: Record<PaymentProviderId, PaymentProvider> = {
  mobile_money: mobileMoneyProvider,
  flutterwave: flutterwaveProvider,
  dusupay: dusupayProvider,
  stripe: stripeProvider,
  paypal: paypalProvider,
};

export function getProvider(id: string): PaymentProvider | null {
  return (PROVIDERS as Record<string, PaymentProvider>)[id] ?? null;
}

/** Providers usable for a currency (configured + currency supported). */
export function providersFor(currency: string, enabled?: string[]) {
  return Object.values(PROVIDERS).filter(
    (p) => (!enabled || enabled.includes(p.id)) && (p.currencies === null || p.currencies.includes(currency)),
  );
}

export * from "./types";
