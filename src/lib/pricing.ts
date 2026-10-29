/**
 * Pure, isomorphic cart pricing. The server is the source of truth: the
 * checkout API re-loads products from the DB and runs this again, so a
 * tampered client can't change prices, fees or discounts.
 */

export interface PricingProduct {
  id: string;
  creator_id: string;
  title: string;
  type: "digital" | "course" | "service" | "ticket" | "physical" | "membership";
  price: number;
  currency: string;
  pay_what_you_want: boolean;
  min_price: number | null;
  requires_shipping: boolean;
  shipping_fee: number;
  track_inventory: boolean;
  inventory_qty: number | null;
  affiliate_enabled: boolean;
  affiliate_commission_percent: number | null;
}

export interface PricingCoupon {
  id: string;
  /** null = sitewide code (admin-created); applies to stores in `sitewideCreatorIds` */
  creator_id: string | null;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  product_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

export interface CartLineInput {
  product: PricingProduct;
  quantity: number;
  /** Buyer-chosen price for pay-what-you-want products */
  customPrice?: number;
}

export interface PricedLine {
  product_id: string;
  creator_id: string;
  title: string;
  product_type: PricingProduct["type"];
  unit_price: number;
  quantity: number;
  line_total: number;
  discount: number;
  shipping: number;
  platform_fee: number;
  affiliate_fee: number;
  creator_earnings: number;
}

export interface PricedCart {
  currency: string;
  lines: PricedLine[];
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  total: number;
  requires_shipping: boolean;
  coupon_applied: boolean;
  errors: string[];
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const MULTI_QTY = new Set(["physical", "ticket"]);

export function couponProblem(c: PricingCoupon, now = new Date()): string | null {
  if (!c.active) return "This code is no longer active.";
  if (c.starts_at && new Date(c.starts_at) > now) return "This code isn't active yet.";
  if (c.ends_at && new Date(c.ends_at) < now) return "This code has expired.";
  if (c.max_uses != null && c.used_count >= c.max_uses) return "This code has reached its usage limit.";
  return null;
}

export function priceCart(
  input: CartLineInput[],
  opts: {
    feePercent: number;
    coupon?: PricingCoupon | null;
    affiliate?: { creator_id: string; commission_percent: number } | null;
    /** For sitewide codes: stores taking part in sitewide sales (default: all) */
    sitewideCreatorIds?: string[];
    now?: Date;
  },
): PricedCart {
  const errors: string[] = [];
  if (!input.length) errors.push("Your cart is empty.");
  const currency = input[0]?.product.currency ?? "ZMW";
  if (input.some((l) => l.product.currency !== currency)) {
    errors.push("Items in different currencies must be bought in separate orders.");
  }

  // 1. base lines
  const lines = input.map((l) => {
    const p = l.product;
    let qty = Math.max(1, Math.floor(l.quantity || 1));
    if (!MULTI_QTY.has(p.type)) qty = 1;
    if (p.track_inventory && p.inventory_qty != null && qty > p.inventory_qty) {
      errors.push(p.inventory_qty === 0 ? `${p.title} is sold out.` : `Only ${p.inventory_qty} left of ${p.title}.`);
    }
    let unit = p.price;
    if (p.pay_what_you_want && l.customPrice != null) {
      const floor = p.min_price ?? 0;
      if (l.customPrice < floor) errors.push(`The minimum for ${p.title} is ${floor}.`);
      unit = Math.max(l.customPrice, floor);
    }
    return {
      product_id: p.id, creator_id: p.creator_id, title: p.title, product_type: p.type,
      unit_price: r2(unit), quantity: qty, line_total: r2(unit * qty), discount: 0,
      shipping: p.requires_shipping ? r2(p.shipping_fee) : 0,
      platform_fee: 0, affiliate_fee: 0, creator_earnings: 0, _p: p,
    };
  });

  // 2. coupon: a store code (one creator, optionally specific products) or a sitewide code
  let couponApplied = false;
  const c = opts.coupon;
  if (c) {
    const problem = couponProblem(c, opts.now);
    const inScope = (creatorId: string) => c.creator_id
      ? creatorId === c.creator_id
      : !opts.sitewideCreatorIds || opts.sitewideCreatorIds.includes(creatorId);
    const eligible = lines.filter((l) => inScope(l.creator_id) && (!c.product_ids?.length || c.product_ids.includes(l.product_id)));
    const eligibleSubtotal = eligible.reduce((s, l) => s + l.line_total, 0);
    if (problem) errors.push(problem);
    else if (!eligible.length) errors.push("This code doesn't apply to the items in your cart.");
    else if (eligibleSubtotal < c.min_order) errors.push(`This code needs a minimum order of ${c.min_order}.`);
    else {
      couponApplied = true;
      const totalDiscount = c.type === "percent"
        ? eligibleSubtotal * (c.value / 100)
        : Math.min(c.value, eligibleSubtotal);
      // distribute proportionally, put rounding remainder on the last line
      let left = r2(totalDiscount);
      eligible.forEach((l, i) => {
        const d = i === eligible.length - 1 ? left : r2(totalDiscount * (l.line_total / eligibleSubtotal));
        l.discount = Math.min(l.line_total, d);
        left = r2(left - l.discount);
      });
    }
  }

  // 3. fees & earnings
  for (const l of lines) {
    const net = r2(l.line_total - l.discount);
    l.platform_fee = r2(net * (opts.feePercent / 100));
    const a = opts.affiliate;
    if (a && a.creator_id === l.creator_id && l._p.affiliate_enabled) {
      const pct = l._p.affiliate_commission_percent ?? a.commission_percent;
      l.affiliate_fee = r2(net * (pct / 100));
    }
    // shipping is passed through to the creator
    l.creator_earnings = r2(net - l.platform_fee - l.affiliate_fee + l.shipping);
  }

  const subtotal = r2(lines.reduce((s, l) => s + l.line_total, 0));
  const discount_total = r2(lines.reduce((s, l) => s + l.discount, 0));
  const shipping_total = r2(lines.reduce((s, l) => s + l.shipping, 0));

  return {
    currency,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    lines: lines.map(({ _p, ...rest }) => rest),
    subtotal,
    discount_total,
    shipping_total,
    total: r2(subtotal - discount_total + shipping_total),
    requires_shipping: lines.some((l) => l.shipping > 0 || l._p.requires_shipping),
    coupon_applied: couponApplied,
    errors,
  };
}
