import { z } from "zod";

const money = z.number().nonnegative().max(100_000_000);

export const productSchema = z.object({
  type: z.enum(["digital", "course", "service", "ticket", "physical", "membership"]),
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().max(180).nullish(),
  description: z.string().max(20_000).nullish(),
  category_id: z.string().uuid().nullish().or(z.literal("").transform(() => null)),
  audience: z.enum(["men", "women", "unisex"]).nullish().or(z.literal("").transform(() => null)),
  cover_url: z.string().url().nullish(),
  gallery: z.array(z.string().url()).max(8).optional(),
  currency: z.string().length(3).optional(),
  price: money,
  compare_at_price: money.nullish(),
  pay_what_you_want: z.boolean().optional(),
  min_price: money.nullish(),
  download_limit: z.number().int().positive().max(1000).nullish(),
  access_days: z.number().int().positive().nullish(),
  event_starts_at: z.string().datetime().nullish(),
  event_venue: z.string().max(200).nullish(),
  service_duration_minutes: z.number().int().positive().max(1440).nullish(),
  booking_url: z.string().url().nullish(),
  requires_shipping: z.boolean().optional(),
  shipping_fee: money.optional(),
  sku: z.string().max(64).nullish(),
  track_inventory: z.boolean().optional(),
  inventory_qty: z.number().int().nonnegative().nullish(),
  affiliate_enabled: z.boolean().optional(),
  affiliate_commission_percent: z.number().min(0).max(90).nullish(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  status: z.enum(["draft", "pending_review", "archived"]).optional(),
  files: z.array(z.object({ path: z.string().min(3), name: z.string().max(255), size: z.number().int().nonnegative(), mime: z.string().max(120) })).max(50).optional(),
  modules: z.array(z.object({
    title: z.string().min(1).max(140),
    lessons: z.array(z.object({ title: z.string().min(1).max(140), is_preview: z.boolean().default(false) })).max(100),
  })).max(50).optional(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const couponSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,24}$/),
  type: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  min_order: z.number().nonnegative().default(0),
  max_uses: z.number().int().positive().nullish(),
  product_ids: z.array(z.string().uuid()).nullish(),
  starts_at: z.string().datetime().nullish(),
  ends_at: z.string().datetime().nullish(),
}).refine((c) => c.type !== "percent" || c.value <= 100, { message: "Percent discounts can't exceed 100", path: ["value"] });

export const creatorProfileSchema = z.object({
  store_name: z.string().trim().min(2).max(80).optional(),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/).optional(),
  tagline: z.string().max(90).nullish(),
  bio: z.string().max(600).nullish(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  avatar_url: z.string().url().nullish(),
  banner_url: z.string().url().nullish(),
  socials: z.record(z.enum(["instagram", "x", "tiktok", "youtube", "website", "whatsapp"]), z.string().max(200)).optional(),
  featured_product_ids: z.array(z.string()).max(4).optional(),
  join_sitewide_sales: z.boolean().optional(),
  currency: z.string().length(3).optional(),
  payout_method: z.discriminatedUnion("type", [
    z.object({ type: z.literal("mobile_money"), network: z.string().min(2), number: z.string().regex(/^\+?\d{9,15}$/), name: z.string().min(2) }),
    z.object({ type: z.literal("bank"), bank: z.string().min(2), account_number: z.string().min(5).max(34), account_name: z.string().min(2) }),
    z.object({ type: z.literal("paypal"), email: z.string().email() }),
  ]).optional(),
});
