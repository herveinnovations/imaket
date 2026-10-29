import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { priceCart, type PricingCoupon, type PricingProduct } from "@/lib/pricing";
import { getProvider, type VerifyResult } from "@/lib/payments";
import { CURRENCY_COUNTRY } from "@/lib/payments/mobile-money";
import { emails, sendEmail } from "@/lib/email";
import type { PaymentProviderId } from "@/lib/types";

export const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(50).default(1),
    customPrice: z.number().nonnegative().optional(),
  })).min(1).max(25),
  email: z.string().email(),
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  couponCode: z.string().max(40).optional(),
  provider: z.enum(["mobile_money", "flutterwave", "dusupay", "stripe", "paypal"]),
  momo: z.object({ network: z.string().min(2).max(20), phone: z.string().regex(/^\+?\d{9,15}$/) }).optional(),
  shippingAddress: z.object({
    line1: z.string().min(3), city: z.string().min(2), country: z.string().min(2), notes: z.string().optional(),
  }).optional(),
});
export type CheckoutRequest = z.infer<typeof checkoutSchema>;

const PRODUCT_COLS =
  "id, creator_id, title, type, price, currency, pay_what_you_want, min_price, requires_shipping, shipping_fee, track_inventory, inventory_qty, affiliate_enabled, affiliate_commission_percent, status";

async function feePercent() {
  const db = getAdminSupabase();
  const { data } = await db.from("imaket_platform_settings").select("value").eq("key", "fee_percent").maybeSingle();
  return Number(data?.value ?? env.platformFeePercent);
}

/** Has this buyer (by account or email) completed an order before? */
async function hasPaidOrder(email?: string | null, customerId?: string | null) {
  if (!email && !customerId) return false;
  const db = getAdminSupabase();
  const ors = [email ? `customer_email.eq.${email.toLowerCase()}` : null, customerId ? `customer_id.eq.${customerId}` : null].filter(Boolean).join(",");
  const { count } = await db.from("imaket_orders").select("id", { count: "exact", head: true }).in("status", ["paid", "fulfilled"]).or(ors);
  return (count ?? 0) > 0;
}

/** Server-side quote: loads products, coupon (store or sitewide) & affiliate, prices the cart. */
export async function quoteCart(req: Pick<CheckoutRequest, "items" | "couponCode"> & { email?: string | null; customerId?: string | null }) {
  const db = getAdminSupabase();
  const ids = [...new Set(req.items.map((i) => i.productId))];
  const { data: products, error } = await db.from("imaket_products").select(PRODUCT_COLS).in("id", ids).eq("status", "published");
  if (error) throw error;
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const missing = ids.filter((id) => !byId.has(id));
  const lines = req.items
    .filter((i) => byId.has(i.productId))
    .map((i) => ({ product: byId.get(i.productId) as PricingProduct, quantity: i.quantity, customPrice: i.customPrice }));

  let coupon: (PricingCoupon & { id: string }) | null = null;
  let platformCouponId: string | null = null;
  let sitewideCreatorIds: string[] | undefined;
  const couponErrors: string[] = [];
  const code = req.couponCode?.trim();
  if (code && /^[A-Za-z0-9_-]{2,40}$/.test(code)) {
    const creators = [...new Set(lines.map((l) => l.product.creator_id))];
    const { data } = await db.from("imaket_coupons").select("*").ilike("code", code).in("creator_id", creators).limit(1).maybeSingle();
    coupon = data as PricingCoupon | null;
    if (!coupon) {
      // sitewide code (TEES25, WELCOME10 …)
      const { data: pc } = await db.from("imaket_platform_coupons").select("*").ilike("code", code).maybeSingle();
      if (pc) {
        coupon = { ...pc, creator_id: null, product_ids: null } as PricingCoupon & { id: string };
        platformCouponId = pc.id;
        const { data: taking } = await db.from("imaket_creators").select("id").in("id", creators).eq("join_sitewide_sales", true);
        sitewideCreatorIds = (taking ?? []).map((t) => t.id);
        if (pc.first_order_only && (await hasPaidOrder(req.email, req.customerId))) {
          couponErrors.push("This code is for your first order only.");
          coupon = null; platformCouponId = null;
        }
      }
    }
  }

  let affiliate: { id: string; creator_id: string; commission_percent: number } | null = null;
  const ref = (await cookies()).get("sk_ref")?.value;
  if (ref) {
    const { data } = await db.from("imaket_affiliates").select("id, creator_id, commission_percent, status").ilike("code", ref).maybeSingle();
    if (data?.status === "active") affiliate = data;
  }

  const priced = priceCart(lines, { feePercent: await feePercent(), coupon, affiliate, sitewideCreatorIds });
  if (missing.length) priced.errors.unshift("Some items are no longer available and were removed.");
  if (couponErrors.length) priced.errors.push(...couponErrors);
  else if (req.couponCode && !coupon) priced.errors.push("That discount code doesn't exist.");
  return { priced, coupon, affiliate, platformCouponId };
}

/** Creates order + items + payment row, then starts the provider checkout. */
export async function createOrderAndCheckout(req: CheckoutRequest, customerId: string | null) {
  const db = getAdminSupabase();
  const { data: maint } = await db.from("imaket_platform_settings").select("value").eq("key", "maintenance_mode").maybeSingle();
  if (maint?.value === true) return { error: "Checkout is paused for maintenance. Please try again shortly." } as const;
  const { priced, coupon, affiliate, platformCouponId } = await quoteCart({ ...req, customerId });
  if (priced.errors.length) return { error: priced.errors[0] } as const;
  if (priced.requires_shipping && !req.shippingAddress) return { error: "A delivery address is required." } as const;

  const provider = getProvider(req.provider);
  if (!provider) return { error: "Unknown payment method." } as const;
  if (priced.total > 0 && provider.currencies && !provider.currencies.includes(priced.currency)) {
    return { error: `${provider.label} doesn't support ${priced.currency}.` } as const;
  }
  if (!provider.isConfigured() && priced.total > 0) return { error: `${provider.label} isn't set up yet.` } as const;

  const { data: order, error } = await db.from("imaket_orders").insert({
    customer_id: customerId,
    customer_email: req.email.toLowerCase(),
    customer_name: req.name,
    customer_phone: req.momo?.phone ?? req.phone,
    currency: priced.currency,
    subtotal: priced.subtotal,
    discount_total: priced.discount_total,
    shipping_total: priced.shipping_total,
    total: priced.total,
    coupon_id: priced.coupon_applied && !platformCouponId ? coupon?.id : null,
    platform_coupon_id: priced.coupon_applied ? platformCouponId : null,
    affiliate_id: affiliate?.id ?? null,
    shipping_address: req.shippingAddress ?? null,
    payment_provider: req.provider,
  }).select("id, order_number").single();
  if (error || !order) throw error ?? new Error("Could not create order");

  const { error: itemsErr } = await db.from("imaket_order_items").insert(priced.lines.map((l) => ({
    order_id: order.id, product_id: l.product_id, creator_id: l.creator_id, title: l.title, product_type: l.product_type,
    unit_price: l.unit_price, quantity: l.quantity, discount: l.discount, line_total: l.line_total,
    platform_fee: l.platform_fee, affiliate_fee: l.affiliate_fee, creator_earnings: l.creator_earnings,
  })));
  if (itemsErr) throw itemsErr;

  // Free orders (100% coupon, free lead magnets) complete immediately
  if (priced.total === 0) {
    await db.from("imaket_payments").insert({ order_id: order.id, provider: req.provider, amount: 0, currency: priced.currency, status: "succeeded", provider_reference: `free-${order.id}` });
    await finalizePaidOrder({ orderId: order.id, provider: req.provider, reference: `free-${order.id}`, status: "succeeded", amount: 0, currency: priced.currency });
    return { orderId: order.id, orderNumber: order.order_number, redirectUrl: `/checkout/success?order=${order.id}` } as const;
  }

  const returnUrl = `${env.appUrl}/api/payments/callback?provider=${req.provider}&order=${order.id}`;
  const country = CURRENCY_COUNTRY[priced.currency] ?? "ZM";
  const result = await provider.createCheckout({
    orderId: order.id,
    orderNumber: order.order_number,
    amount: priced.total,
    currency: priced.currency,
    description: priced.lines.map((l) => l.title).join(", "),
    customer: { email: req.email, name: req.name, phone: req.phone },
    momo: req.provider === "mobile_money" && req.momo ? { ...req.momo, country } : undefined,
    returnUrl,
    cancelUrl: `${env.appUrl}/checkout?cancelled=1`,
  });

  await db.from("imaket_payments").insert({
    order_id: order.id, provider: req.provider, provider_reference: result.reference, checkout_url: result.redirectUrl,
    amount: priced.total, currency: priced.currency, status: "pending", method: req.provider === "mobile_money" ? "mobile_money" : null,
  });
  await db.from("imaket_analytics_events").insert(priced.lines.map((l) => ({ event: "checkout_start", creator_id: l.creator_id, product_id: l.product_id, value: l.line_total })));

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    redirectUrl: result.redirectUrl ?? `/checkout/pending?order=${order.id}`,
    awaitingCustomerApproval: result.awaitingCustomerApproval,
    instructions: result.instructions,
  } as const;
}

/**
 * Marks an order paid after a VERIFIED provider result. Checks amount and
 * currency against the stored order before calling the DB function.
 * Safe to call repeatedly (webhook + redirect race).
 */
export async function finalizePaidOrder(v: VerifyResult & { orderId?: string; provider?: PaymentProviderId }) {
  const db = getAdminSupabase();
  let orderId = v.orderId;
  if (!orderId) {
    const { data } = await db.from("imaket_payments").select("order_id").eq("provider_reference", v.reference).maybeSingle();
    orderId = data?.order_id;
  }
  if (!orderId) return { ok: false, reason: "unknown_reference" } as const;

  const { data: order } = await db.from("imaket_orders").select("*, items:imaket_order_items(*)").eq("id", orderId).single();
  if (!order) return { ok: false, reason: "order_not_found" } as const;

  if (v.status === "failed") {
    await db.from("imaket_payments").update({ status: "failed", raw: v.raw ?? null }).eq("order_id", orderId).eq("provider_reference", v.reference);
    if (order.status === "pending") await db.from("imaket_orders").update({ status: "failed" }).eq("id", orderId);
    return { ok: false, reason: "failed" } as const;
  }
  if (v.status !== "succeeded") return { ok: false, reason: "pending" } as const;

  if (v.amount != null && Math.abs(Number(v.amount) - Number(order.total)) > 0.01) {
    console.error("[payments] amount mismatch", { orderId, expected: order.total, got: v.amount });
    return { ok: false, reason: "amount_mismatch" } as const;
  }
  if (v.currency && v.currency.toUpperCase() !== order.currency) return { ok: false, reason: "currency_mismatch" } as const;

  const already = ["paid", "fulfilled"].includes(order.status);
  const provider = (v.provider ?? order.payment_provider) as PaymentProviderId;
  const { error } = await db.rpc("imaket_finalize_order", { p_order_id: orderId, p_provider: provider, p_reference: v.reference, p_raw: v.raw ?? null });
  if (error) throw error;

  if (!already) {
    const receipt = emails.orderReceipt({
      orderNumber: order.order_number, total: Number(order.total), currency: order.currency,
      items: order.items, accessUrl: `${env.appUrl}/dashboard/downloads`,
    });
    await sendEmail(order.customer_email, receipt.subject, receipt.html);

    const creatorIds = [...new Set(order.items.map((i: { creator_id: string }) => i.creator_id))];
    const { data: creators } = await db.from("imaket_creators").select("id, user:imaket_users(email)").in("id", creatorIds);
    for (const item of order.items as { creator_id: string; title: string; creator_earnings: number }[]) {
      const cr = creators?.find((c) => c.id === item.creator_id) as { user?: { email: string } } | undefined;
      if (!cr?.user?.email) continue;
      const m = emails.creatorSale({ title: item.title, earnings: Number(item.creator_earnings), currency: order.currency, buyer: order.customer_name ?? "A customer" });
      await sendEmail(cr.user.email, m.subject, m.html);
    }
  }
  return { ok: true, orderId } as const;
}
