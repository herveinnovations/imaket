import { dusupayProvider } from "./dusupay";
import { flutterwaveProvider } from "./flutterwave";
import type { PaymentProvider } from "./types";

/**
 * "Mobile Money" as a first-class checkout option. It's a thin router over
 * an aggregator so you can swap gateways per market without touching the UI.
 *   MOBILE_MONEY_GATEWAY=dusupay | flutterwave   (default: first configured)
 * To add a direct MNO integration (e.g. MTN MoMo Collections API,
 * Airtel Money Open API), implement PaymentProvider and route to it here.
 */
export const MOMO_NETWORKS: Record<string, { label: string; code: string }[]> = {
  ZM: [{ label: "MTN MoMo", code: "MTN" }, { label: "Airtel Money", code: "AIRTEL" }, { label: "Zamtel Kwacha", code: "ZAMTEL" }],
  UG: [{ label: "MTN MoMo", code: "MTN" }, { label: "Airtel Money", code: "AIRTEL" }],
  KE: [{ label: "M-Pesa", code: "MPESA" }, { label: "Airtel Money", code: "AIRTEL" }],
  GH: [{ label: "MTN MoMo", code: "MTN" }, { label: "Telecel Cash", code: "VODAFONE" }, { label: "AT Money", code: "AIRTELTIGO" }],
  TZ: [{ label: "M-Pesa", code: "MPESA" }, { label: "Tigo Pesa", code: "TIGO" }, { label: "Airtel Money", code: "AIRTEL" }],
  RW: [{ label: "MTN MoMo", code: "MTN" }, { label: "Airtel Money", code: "AIRTEL" }],
};

export const CURRENCY_COUNTRY: Record<string, string> = { ZMW: "ZM", UGX: "UG", KES: "KE", GHS: "GH", TZS: "TZ", RWF: "RW" };

function gateway(): PaymentProvider {
  const pref = process.env.MOBILE_MONEY_GATEWAY;
  if (pref === "flutterwave") return flutterwaveProvider;
  if (pref === "dusupay") return dusupayProvider;
  return dusupayProvider.isConfigured() ? dusupayProvider : flutterwaveProvider;
}

export const mobileMoneyProvider: PaymentProvider = {
  id: "mobile_money",
  label: "Mobile money",
  currencies: Object.keys(CURRENCY_COUNTRY),
  isConfigured: () => dusupayProvider.isConfigured() || flutterwaveProvider.isConfigured(),
  createCheckout: (i) => gateway().createCheckout(i),
  verify: (ref, hint) => gateway().verify(ref, hint),
  parseWebhook: (body, headers) => gateway().parseWebhook(body, headers),
};
