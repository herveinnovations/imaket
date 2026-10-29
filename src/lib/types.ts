// Domain types — mirror supabase/migrations/*.sql
// Regenerate strict DB types with `npm run db:types` once Supabase is linked.

export type UserRole = "admin" | "creator" | "customer";
export type CreatorStatus = "pending" | "active" | "suspended";
export type ProductType = "digital" | "course" | "service" | "ticket" | "physical" | "membership";
export type ProductStatus = "draft" | "pending_review" | "published" | "rejected" | "archived";
export type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded" | "failed";
export type PaymentStatus = "initiated" | "pending" | "succeeded" | "failed" | "refunded";
export type PaymentProviderId = "stripe" | "paypal" | "flutterwave" | "dusupay" | "mobile_money";
export type PayoutStatus = "requested" | "processing" | "paid" | "rejected";
export type CouponType = "percent" | "fixed";
export type FulfillmentStatus = "unfulfilled" | "delivered" | "shipped" | "completed";

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone?: string | null;
  country?: string | null;
  role: UserRole;
  is_banned?: boolean;
  public_profile?: boolean;
  bio?: string | null;
  created_at: string;
}

export interface Socials {
  instagram?: string;
  x?: string;
  tiktok?: string;
  youtube?: string;
  website?: string;
  whatsapp?: string;
}

export interface Creator {
  id: string;
  user_id: string;
  handle: string;
  store_name: string;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  brand_color: string | null;
  socials: Socials;
  country: string | null;
  currency: string;
  status: CreatorStatus;
  verified: boolean;
  featured_product_ids: string[];
  join_sitewide_sales?: boolean;
  payout_method?: PayoutMethod | null;
  created_at: string;
  // computed (demo / joins)
  product_count?: number;
  sales_count?: number;
}

export type PayoutMethod =
  | { type: "mobile_money"; network: string; number: string; name: string }
  | { type: "bank"; bank: string; account_number: string; account_name: string }
  | { type: "paypal"; email: string };

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  creator_id: string;
  category_id: string | null;
  type: ProductType;
  status: ProductStatus;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  pay_what_you_want: boolean;
  min_price: number | null;
  cover_url: string | null;
  gallery: string[];
  tags: string[];
  featured: boolean;
  track_inventory: boolean;
  inventory_qty: number | null;
  requires_shipping: boolean;
  shipping_fee: number;
  event_starts_at: string | null;
  event_venue: string | null;
  service_duration_minutes: number | null;
  download_limit: number | null;
  affiliate_enabled: boolean;
  affiliate_commission_percent: number | null;
  rating_avg: number;
  rating_count: number;
  sales_count: number;
  view_count: number;
  rejection_reason: string | null;
  audience?: "men" | "women" | "unisex" | null;
  refund?: string | null;
  delivery?: string | null;
  published_at: string | null;
  created_at: string;
  // joins
  creator?: Pick<Creator, "id" | "handle" | "store_name" | "avatar_url" | "verified">;
  category?: Pick<Category, "id" | "slug" | "name"> | null;
  files?: ProductFile[];
  modules?: CourseModule[];
}

export interface ProductFile {
  id: string;
  product_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
}

export interface CourseModule {
  id: string;
  title: string;
  sort_order: number;
  lessons: { id: string; title: string; duration_seconds: number | null; is_preview: boolean }[];
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_email: string;
  customer_name: string | null;
  customer_phone?: string | null;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  total: number;
  payment_provider: PaymentProviderId | null;
  created_at: string;
  paid_at: string | null;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  creator_id: string;
  title: string;
  product_type: ProductType;
  unit_price: number;
  quantity: number;
  line_total: number;
  platform_fee: number;
  creator_earnings: number;
  fulfillment_status: FulfillmentStatus;
  cover_url?: string | null;
}

export interface Payment {
  id: string;
  order_id: string;
  provider: PaymentProviderId;
  provider_reference: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  created_at: string;
}

export interface Download {
  id: string;
  product_id: string;
  order_item_id: string;
  download_count: number;
  max_downloads: number | null;
  expires_at: string | null;
  created_at: string;
  product?: Pick<Product, "id" | "title" | "slug" | "cover_url" | "type"> & {
    creator?: Pick<Creator, "store_name" | "handle">;
    files?: Pick<ProductFile, "id" | "file_name" | "size_bytes">[];
  };
}

export interface Review {
  id: string;
  product_id: string;
  customer_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  creator_reply: string | null;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null };
}

export interface Coupon {
  id: string;
  creator_id: string | null;
  code: string;
  type: CouponType;
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

export interface Payout {
  id: string;
  creator_id: string;
  amount: number;
  currency: string;
  method: string;
  status: PayoutStatus;
  reference: string | null;
  requested_at: string;
  processed_at: string | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Affiliate {
  id: string;
  code: string;
  commission_percent: number;
  clicks: number;
  conversions: number;
  earnings: number;
  status: "active" | "paused";
  name?: string;
  email?: string;
}

export interface DailyPoint {
  day: string;
  revenue: number;
  orders: number;
}

export interface ProductFilters {
  q?: string;
  category?: string;
  type?: ProductType;
  minPrice?: number;
  maxPrice?: number;
  sort?: "popular" | "newest" | "price_asc" | "price_desc" | "rating";
  /** Men / Women collections (unisex items show in both) */
  audience?: "men" | "women";
  /** "New" collection: published in the last 30 days */
  isNew?: boolean;
  creatorId?: string;
  page?: number;
  pageSize?: number;
}
