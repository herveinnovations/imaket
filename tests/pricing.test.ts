import { priceCart } from "../src/lib/pricing.ts";
import assert from "node:assert/strict";
const base = { creator_id: "A", type: "digital", currency: "ZMW", pay_what_you_want: false, min_price: null, requires_shipping: false, shipping_fee: 0, track_inventory: false, inventory_qty: null, affiliate_enabled: true, affiliate_commission_percent: 10 } as const;
const p1 = { ...base, id: "1", title: "Planner", price: 150 };
const p2 = { ...base, id: "2", title: "Tote", price: 480, type: "physical", requires_shipping: true, shipping_fee: 60, track_inventory: true, inventory_qty: 3 } as const;
const p3 = { ...base, id: "3", title: "Other creator", price: 100, creator_id: "B" };
const coupon = { id: "c", creator_id: "A", code: "X", type: "percent", value: 20, min_order: 0, max_uses: null, used_count: 0, product_ids: null, starts_at: null, ends_at: null, active: true } as const;
let c = priceCart([{ product: p1, quantity: 5 }, { product: p2, quantity: 2 }, { product: p3, quantity: 1 }], { feePercent: 5, coupon, affiliate: { creator_id: "A", commission_percent: 10 } });
assert.equal(c.lines[0].quantity, 1);           // digital forced to qty 1
assert.equal(c.subtotal, 150 + 960 + 100);
assert.equal(c.discount_total, 0.2 * (150 + 960)); // coupon only on creator A
assert.equal(c.lines[2].discount, 0);
assert.equal(c.shipping_total, 60);
assert.equal(c.total, 1210 - 222 + 60);
assert.equal(c.lines[2].affiliate_fee, 0);     // affiliate belongs to creator A
assert.deepEqual(c.errors, []);
c = priceCart([{ product: p2, quantity: 5 }], { feePercent: 5 }); assert.match(c.errors[0], /Only 3 left/);
c = priceCart([{ product: { ...p1, pay_what_you_want: true, min_price: 60 }, quantity: 1, customPrice: 40 }], { feePercent: 5 }); assert.match(c.errors[0], /minimum/);
c = priceCart([{ product: p1, quantity: 1 }], { feePercent: 5, coupon: { ...coupon, type: "fixed", value: 500 } }); assert.equal(c.total, 0);
c = priceCart([{ product: p1, quantity: 1 }], { feePercent: 5, coupon: { ...coupon, ends_at: "2020-01-01" } }); assert.match(c.errors[0], /expired/);
c = priceCart([{ product: p1, quantity: 1 }, { product: { ...p3, currency: "NGN" }, quantity: 1 }], { feePercent: 5 }); assert.match(c.errors[0], /currencies/);
console.log("ALL PRICING TESTS PASSED");
