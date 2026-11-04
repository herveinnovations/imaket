-- iMaket: keep store numbers and payout details private.
--
-- Row level security decides WHICH rows a visitor can read; column grants decide
-- WHICH fields. Visitors and other members can still read published products and
-- active stores, but no longer:
--   * imaket_products.sales_count / view_count  (how much a store sells)
--   * imaket_products.file_path                 (where a paid download is stored)
--   * imaket_creators.payout_method             (mobile money / bank details)
-- The store owner's dashboard and the admin pages read these on the server with
-- the service role, after checking who is signed in.

revoke select on public.imaket_products from anon, authenticated;
grant select (
  id, creator_id, category_id, slug, title, description, type, format, delivery, refund,
  price, currency, inventory_qty, status, cover_url, featured, created_at, summary,
  compare_at_price, pay_what_you_want, min_price, gallery, tags, track_inventory, sku,
  requires_shipping, shipping_fee, weight_grams, event_starts_at, event_ends_at, event_venue,
  event_online_url, service_duration_minutes, booking_url, download_limit, access_days,
  affiliate_enabled, affiliate_commission_percent, rating_avg, rating_count,
  rejection_reason, reviewed_by, reviewed_at, published_at, updated_at, search, audience
) on public.imaket_products to anon, authenticated;

revoke select on public.imaket_creators from anon, authenticated;
grant select (
  id, user_id, handle, store_name, bio, banner_url, avatar_url, socials, status, created_at,
  tagline, brand_color, country, currency, verified, featured_product_ids, custom_domain,
  updated_at, join_sitewide_sales
) on public.imaket_creators to anon, authenticated;
