import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { isDemoMode, env } from "@/lib/env";
import { priceCart, type PricingCoupon } from "@/lib/pricing";
import { DEMO_COUPONS, DEMO_PRODUCTS } from "@/lib/demo-data";
import { quoteCart } from "@/lib/orders";
import { getApiSession } from "@/lib/auth";

const schema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(50), customPrice: z.number().nonnegative().optional() })).min(1).max(25),
  couponCode: z.string().max(40).optional(),
  email: z.string().email().max(254).optional(),
});

/** POST /api/checkout/quote — authoritative server-side totals for the cart. */
export async function POST(req: Request) {
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  const { items, couponCode } = body.data;

  if (isDemoMode) {
    const lines = items.flatMap((i) => {
      const p = DEMO_PRODUCTS.find((x) => x.id === i.productId);
      return p ? [{ product: p, quantity: i.quantity, customPrice: i.customPrice }] : [];
    });
    const c = couponCode ? DEMO_COUPONS.find((x) => x.code.toLowerCase() === couponCode.toLowerCase()) : null;
    const coupon: PricingCoupon | null = c ? { ...c, product_ids: null } : null;
    const priced = priceCart(lines, { feePercent: env.platformFeePercent, coupon });
    if (couponCode && !c) priced.errors.push("That discount code doesn't exist. Try MONTHEND in the demo.");
    return ok(priced);
  }

  try {
    const session = await getApiSession();
    const { priced } = await quoteCart({ ...body.data, customerId: session && !session.demo ? session.user.id : null });
    return ok(priced);
  } catch (e) {
    console.error("[quote]", e);
    return fail("Couldn't price your cart right now.", 500);
  }
}
