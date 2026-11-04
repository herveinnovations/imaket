/**
 * Columns visitors are allowed to read (see migration 20261104000001_imaket_private_stats).
 * Sales/view counts, download paths and payout details are NOT granted to the
 * public API roles, so `select("*")` on these tables fails for them. Use these
 * lists with the user-scoped client, and the service-role client (after an auth
 * check) for the private columns.
 */
export const PUBLIC_PRODUCT_COLUMNS = [
  "id", "creator_id", "category_id", "slug", "title", "description", "type", "format", "delivery", "refund",
  "price", "currency", "inventory_qty", "status", "cover_url", "featured", "created_at", "summary",
  "compare_at_price", "pay_what_you_want", "min_price", "gallery", "tags", "track_inventory", "sku",
  "requires_shipping", "shipping_fee", "weight_grams", "event_starts_at", "event_ends_at", "event_venue",
  "event_online_url", "service_duration_minutes", "booking_url", "download_limit", "access_days",
  "affiliate_enabled", "affiliate_commission_percent", "rating_avg", "rating_count",
  "rejection_reason", "reviewed_by", "reviewed_at", "published_at", "updated_at", "audience",
].join(", ");

export const PUBLIC_CREATOR_COLUMNS = [
  "id", "user_id", "handle", "store_name", "bio", "banner_url", "avatar_url", "socials", "status", "created_at",
  "tagline", "brand_color", "country", "currency", "verified", "featured_product_ids", "custom_domain",
  "updated_at", "join_sitewide_sales",
].join(", ");
