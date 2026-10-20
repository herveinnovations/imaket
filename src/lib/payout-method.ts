import type { PayoutMethod } from "./types";

export function describeMethodServer(m: PayoutMethod) {
  if (m.type === "mobile_money") return `${m.network} ••• ${m.number.slice(-4)}`;
  if (m.type === "bank") return `${m.bank} ••• ${m.account_number.slice(-4)}`;
  return `PayPal ${m.email}`;
}
