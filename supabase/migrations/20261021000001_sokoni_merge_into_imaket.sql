-- ════════════════════════════════════════════════════════════════════
-- Sokoni ⟶ imaket merge
-- Reshapes the existing (empty) imaket_* marketplace tables into Sokoni's
-- data model, adds Sokoni's extra tables, and keeps imaket-only features
-- (tickets with check-in, bookings, services, events, shipments, shipping
-- rates, lesson progress, reports, payment-event dedupe).
--
-- Does NOT touch the point-of-sale tables (public.products, orders, staff,
-- store_settings).
--
-- Conventions kept from imaket:
--   • privileged helpers live in schema imaket_private (SECURITY DEFINER,
--     search_path=''), exposed via thin SECURITY INVOKER wrappers in public
--   • explicit grants (no blanket privileges for anon/authenticated)
-- ════════════════════════════════════════════════════════════════════

-- ─── 0. Clear policies + functions that reference columns we reshape ─
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where (schemaname = 'public' and tablename like 'imaket\_%')
              or (schemaname = 'storage' and tablename = 'objects'
                  and policyname in ('imaket_cover_delete','imaket_cover_read','imaket_cover_upload',
                                     'imaket_paid_file_read','imaket_paid_lesson_file',
                                     'product_files_delete','product_files_insert','product_files_select'))
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

drop trigger if exists imaket_new_user on auth.users;
drop function if exists imaket_private.handle_new_user();
drop function if exists public.imaket_check_coupon(text, text);
drop function if exists imaket_private.imaket_check_coupon(text, text);

-- ─── 1. users ───────────────────────────────────────────────────────
alter table public.imaket_users rename column display_name to full_name;
alter table public.imaket_users alter column full_name drop not null, alter column full_name drop default;
alter table public.imaket_users
  add column email text not null,
  add column avatar_url text,
  add column phone text,
  add column country text default 'ZM',
  add column is_banned boolean not null default false,
  add column updated_at timestamptz not null default now();
create unique index imaket_users_email_key on public.imaket_users (lower(email));

-- ─── 2. creators (stores) ───────────────────────────────────────────
alter table public.imaket_creators rename column slug to handle;
alter table public.imaket_creators rename column display_name to store_name;
alter table public.imaket_creators rename column social_links to socials;
alter table public.imaket_creators drop constraint imaket_creators_slug_check;
alter table public.imaket_creators add constraint imaket_creators_handle_check
  check (handle ~ '^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$');
alter table public.imaket_creators alter column bio drop not null, alter column bio drop default;
alter table public.imaket_creators alter column status set default 'active';
alter table public.imaket_creators
  add column tagline text,
  add column brand_color text default '#0B7A56',
  add column country text default 'ZM',
  add column currency text not null default 'ZMW',
  add column verified boolean not null default false,
  add column featured_product_ids uuid[] not null default '{}',
  add column payout_method jsonb,
  add column custom_domain text unique,
  add column updated_at timestamptz not null default now();

-- ─── 3. categories ──────────────────────────────────────────────────
alter table public.imaket_categories
  add column icon text,
  add column parent_id uuid references public.imaket_categories(id) on delete set null,
  add column sort_order int not null default 0,
  add column created_at timestamptz not null default now();

insert into public.imaket_categories (slug, name, icon, sort_order) values
  ('ebooks', 'E-books & Guides', 'BookOpen', 1),
  ('courses', 'Online Courses', 'GraduationCap', 2),
  ('templates', 'Templates & Presets', 'LayoutTemplate', 3),
  ('music', 'Music & Audio', 'Music', 4),
  ('design', 'Design', 'Palette', 5),
  ('coaching', 'Coaching & Services', 'Handshake', 6),
  ('events', 'Events & Tickets', 'Ticket', 7),
  ('fashion', 'Fashion & Merch', 'Shirt', 8),
  ('beauty', 'Beauty & Wellness', 'Sparkles', 9),
  ('software', 'Software & Tools', 'Code', 10),
  ('photography', 'Photography', 'Camera', 11),
  ('business', 'Business', 'Briefcase', 12),
  ('marketing', 'Marketing', 'Megaphone', 13),
  ('personal-growth', 'Personal growth', 'Sprout', 14),
  ('lifestyle', 'Lifestyle', 'Coffee', 15),
  ('community', 'Community', 'Users', 16)
on conflict (slug) do update set icon = excluded.icon, sort_order = excluded.sort_order;

-- ─── 4. products ────────────────────────────────────────────────────
-- array_to_string is STABLE; generated columns need IMMUTABLE
create or replace function imaket_private.tags_to_text(text[]) returns text
language sql immutable parallel safe set search_path = '' as $$ select coalesce(array_to_string($1, ' '), '') $$;

alter table public.imaket_products drop constraint imaket_products_price_cents_check;
alter table public.imaket_products drop constraint imaket_products_type_check;
alter table public.imaket_products drop constraint imaket_products_status_check;
alter table public.imaket_products drop constraint imaket_products_title_check;
alter table public.imaket_products rename column price_cents to price;
alter table public.imaket_products alter column price type numeric(12,2) using price / 100.0;
alter table public.imaket_products rename column stock to inventory_qty;
update public.imaket_products set type = case type
  when 'Digital product' then 'digital' when 'Physical product' then 'physical' when 'Course' then 'course'
  when 'Service' then 'service' when 'Event ticket' then 'ticket' else type end,
  status = case status when 'pending' then 'pending_review' else status end;
alter table public.imaket_products
  alter column type set default 'digital',
  alter column currency set default 'ZMW',
  alter column description drop not null, alter column description drop default,
  add constraint imaket_products_price_check check (price >= 0 and price <= 100000000),
  add constraint imaket_products_type_check check (type in ('digital','course','service','ticket','physical','membership')),
  add constraint imaket_products_status_check check (status in ('draft','pending_review','published','rejected','archived')),
  add constraint imaket_products_title_check check (char_length(title) between 3 and 140);
alter table public.imaket_products
  add column summary text,
  add column compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  add column pay_what_you_want boolean not null default false,
  add column min_price numeric(12,2),
  add column gallery text[] not null default '{}',
  add column tags text[] not null default '{}',
  add column track_inventory boolean not null default false,
  add column sku text,
  add column requires_shipping boolean not null default false,
  add column shipping_fee numeric(12,2) not null default 0,
  add column weight_grams int,
  add column event_starts_at timestamptz,
  add column event_ends_at timestamptz,
  add column event_venue text,
  add column event_online_url text,
  add column service_duration_minutes int,
  add column booking_url text,
  add column download_limit int default 5,
  add column access_days int,
  add column affiliate_enabled boolean not null default false,
  add column affiliate_commission_percent numeric(5,2) default 10 check (affiliate_commission_percent between 0 and 90),
  add column rating_avg numeric(3,2) not null default 0,
  add column rating_count int not null default 0,
  add column sales_count int not null default 0,
  add column view_count int not null default 0,
  add column rejection_reason text,
  add column reviewed_by uuid references public.imaket_users(id),
  add column reviewed_at timestamptz,
  add column published_at timestamptz,
  add column updated_at timestamptz not null default now();
alter table public.imaket_products add column search tsvector generated always as (
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
  setweight(to_tsvector('simple', imaket_private.tags_to_text(tags)), 'B') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'C')
) stored;
create index imaket_products_status_idx on public.imaket_products (status, published_at desc);
create index imaket_products_type_idx on public.imaket_products (type);
create index imaket_products_search_idx on public.imaket_products using gin (search);

-- Files delivered after purchase (bucket imaket-product-files, private)
create table public.imaket_product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.imaket_products(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index imaket_product_files_product_idx on public.imaket_product_files (product_id);

-- ─── 5. courses ─────────────────────────────────────────────────────
create table public.imaket_course_modules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.imaket_products(id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);
create index imaket_course_modules_product_idx on public.imaket_course_modules (product_id);

alter table public.imaket_course_lessons drop constraint imaket_course_lessons_product_id_position_key;
alter table public.imaket_course_lessons rename column position to sort_order;
alter table public.imaket_course_lessons rename column file_path to video_path;
alter table public.imaket_course_lessons alter column video_path drop not null;
alter table public.imaket_course_lessons alter column sort_order set default 0;
alter table public.imaket_course_lessons
  add column module_id uuid references public.imaket_course_modules(id) on delete cascade,
  add column content text,
  add column duration_seconds int,
  add column is_preview boolean not null default false;
create index imaket_course_lessons_module_idx on public.imaket_course_lessons (module_id);

-- ─── 6. coupons ─────────────────────────────────────────────────────
alter table public.imaket_coupons drop constraint imaket_coupons_percent_off_check;
alter table public.imaket_coupons rename column percent_off to value;
alter table public.imaket_coupons alter column value type numeric(12,2);
alter table public.imaket_coupons rename column uses to used_count;
alter table public.imaket_coupons rename column expires_at to ends_at;
alter table public.imaket_coupons
  add column type text not null default 'percent' check (type in ('percent','fixed')),
  add column min_order numeric(12,2) not null default 0,
  add column product_ids uuid[],
  add column starts_at timestamptz,
  add column created_at timestamptz not null default now(),
  add constraint imaket_coupons_value_check check (value > 0 and (type <> 'percent' or value <= 100));

-- ─── 7. affiliates ──────────────────────────────────────────────────
alter table public.imaket_affiliates drop constraint imaket_affiliates_commission_percent_check;
alter table public.imaket_affiliates alter column commission_percent type numeric(5,2);
alter table public.imaket_affiliates alter column commission_percent set default 10;
alter table public.imaket_affiliates
  add constraint imaket_affiliates_commission_check check (commission_percent between 0 and 90),
  add column clicks int not null default 0,
  add column conversions int not null default 0,
  add column earnings numeric(12,2) not null default 0,
  add column status text not null default 'active' check (status in ('active','paused')),
  add column created_at timestamptz not null default now(),
  add constraint imaket_affiliates_creator_user_key unique (creator_id, user_id);
update public.imaket_affiliates set status = case when active then 'active' else 'paused' end;
alter table public.imaket_affiliates drop column active;

-- ─── 8. orders ──────────────────────────────────────────────────────
create sequence if not exists public.imaket_order_number_seq start 100001;

alter table public.imaket_orders drop constraint imaket_orders_subtotal_cents_check;
alter table public.imaket_orders drop constraint imaket_orders_total_cents_check;
alter table public.imaket_orders drop constraint imaket_orders_status_check;
alter table public.imaket_orders drop constraint imaket_orders_customer_id_fkey;
alter table public.imaket_orders rename column subtotal_cents to subtotal;
alter table public.imaket_orders rename column total_cents to total;
alter table public.imaket_orders alter column subtotal type numeric(12,2) using subtotal / 100.0;
alter table public.imaket_orders alter column total type numeric(12,2) using total / 100.0;
alter table public.imaket_orders
  alter column subtotal set default 0,
  alter column total set default 0,
  alter column customer_id drop not null,
  alter column currency set default 'ZMW',
  alter column idempotency_key set default gen_random_uuid()::text,
  add constraint imaket_orders_customer_id_fkey foreign key (customer_id) references public.imaket_users(id) on delete set null,
  add constraint imaket_orders_amounts_check check (subtotal >= 0 and total >= 0),
  add constraint imaket_orders_status_check check (status in ('pending','paid','fulfilled','cancelled','refunded','failed'));
alter table public.imaket_orders
  add column order_number text not null unique default ('SK-' || nextval('public.imaket_order_number_seq')),
  add column customer_email text not null,
  add column customer_name text,
  add column customer_phone text,
  add column discount_total numeric(12,2) not null default 0,
  add column shipping_total numeric(12,2) not null default 0,
  add column coupon_id uuid references public.imaket_coupons(id) on delete set null,
  add column affiliate_id uuid references public.imaket_affiliates(id) on delete set null,
  add column payment_provider text check (payment_provider in ('stripe','paypal','flutterwave','dusupay','mobile_money')),
  add column notes text,
  add column updated_at timestamptz not null default now();
create index imaket_orders_email_idx on public.imaket_orders (lower(customer_email));
create index imaket_orders_status_idx on public.imaket_orders (status, created_at desc);

-- ─── 9. order items ─────────────────────────────────────────────────
alter table public.imaket_order_items drop constraint imaket_order_items_unit_price_cents_check;
alter table public.imaket_order_items drop constraint imaket_order_items_product_id_fkey;
alter table public.imaket_order_items rename column unit_price_cents to unit_price;
alter table public.imaket_order_items alter column unit_price type numeric(12,2) using unit_price / 100.0;
alter table public.imaket_order_items
  alter column product_id drop not null,
  alter column quantity set default 1,
  add constraint imaket_order_items_product_id_fkey foreign key (product_id) references public.imaket_products(id) on delete set null,
  add constraint imaket_order_items_unit_price_check check (unit_price >= 0),
  add column product_type text not null check (product_type in ('digital','course','service','ticket','physical','membership')),
  add column discount numeric(12,2) not null default 0,
  add column line_total numeric(12,2) not null,
  add column platform_fee numeric(12,2) not null default 0,
  add column affiliate_fee numeric(12,2) not null default 0,
  add column creator_earnings numeric(12,2) not null default 0,
  add column fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled','delivered','shipped','completed')),
  add column tracking_number text,
  add column created_at timestamptz not null default now();
create index imaket_order_items_creator_created_idx on public.imaket_order_items (creator_id, created_at desc);

-- ─── 10. payments ───────────────────────────────────────────────────
alter table public.imaket_payments drop constraint imaket_payments_amount_cents_check;
alter table public.imaket_payments drop constraint imaket_payments_provider_check;
alter table public.imaket_payments drop constraint imaket_payments_status_check;
alter table public.imaket_payments rename column external_id to provider_reference;
alter table public.imaket_payments rename column amount_cents to amount;
alter table public.imaket_payments alter column amount type numeric(12,2) using amount / 100.0;
update public.imaket_payments set provider = 'mobile_money' where provider = 'mobile-money';
update public.imaket_payments set status = 'succeeded' where status = 'paid';
alter table public.imaket_payments
  alter column status set default 'initiated',
  alter column currency set default 'ZMW',
  add constraint imaket_payments_amount_check check (amount >= 0),
  add constraint imaket_payments_provider_check check (provider in ('stripe','paypal','flutterwave','dusupay','mobile_money')),
  add constraint imaket_payments_status_check check (status in ('initiated','pending','succeeded','failed','refunded')),
  add column checkout_url text,
  add column method text,
  add column failure_reason text,
  add column raw jsonb,
  add column updated_at timestamptz not null default now();

-- ─── 11. downloads (entitlements) ───────────────────────────────────
alter table public.imaket_downloads rename column user_id to customer_id;
alter table public.imaket_downloads alter column customer_id drop not null;
alter table public.imaket_downloads
  add column order_item_id uuid references public.imaket_order_items(id) on delete cascade,
  add column customer_email text not null,
  add column access_token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  add column download_count int not null default 0,
  add column max_downloads int,
  add column expires_at timestamptz,
  add column last_downloaded_at timestamptz;
create index imaket_downloads_email_idx on public.imaket_downloads (lower(customer_email));

-- ─── 12. reviews ────────────────────────────────────────────────────
alter table public.imaket_reviews rename column user_id to customer_id;
alter table public.imaket_reviews alter column body drop not null;
alter table public.imaket_reviews
  add column title text,
  add column status text not null default 'published' check (status in ('published','hidden','flagged')),
  add column creator_reply text,
  add column updated_at timestamptz not null default now();
update public.imaket_reviews set status = case when approved then 'published' else 'hidden' end;
alter table public.imaket_reviews drop column approved;
create index imaket_reviews_product_created_idx on public.imaket_reviews (product_id, created_at desc);

-- ─── 13. payouts ────────────────────────────────────────────────────
alter table public.imaket_payouts drop constraint imaket_payouts_amount_cents_check;
alter table public.imaket_payouts drop constraint imaket_payouts_status_check;
alter table public.imaket_payouts rename column amount_cents to amount;
alter table public.imaket_payouts alter column amount type numeric(12,2) using amount / 100.0;
alter table public.imaket_payouts rename column external_id to reference;
alter table public.imaket_payouts rename column created_at to requested_at;
update public.imaket_payouts set status = case status when 'pending' then 'requested' when 'failed' then 'rejected' else status end;
alter table public.imaket_payouts
  alter column status set default 'requested',
  alter column currency set default 'ZMW',
  add constraint imaket_payouts_amount_check check (amount > 0),
  add constraint imaket_payouts_status_check check (status in ('requested','processing','paid','rejected')),
  add column method text not null,
  add column destination jsonb not null,
  add column note text,
  add column processed_by uuid references public.imaket_users(id),
  add column processed_at timestamptz;

-- ─── 14. notifications ──────────────────────────────────────────────
alter table public.imaket_notifications alter column body drop not null;
alter table public.imaket_notifications
  add column type text not null default 'general',
  add column link text;

-- ─── 15. analytics ──────────────────────────────────────────────────
alter table public.imaket_analytics_events drop constraint imaket_analytics_events_event_check;
update public.imaket_analytics_events set event = case event when 'view' then 'product_view' when 'checkout' then 'checkout_start' else event end;
alter table public.imaket_analytics_events
  add constraint imaket_analytics_events_event_check
    check (event in ('store_view','product_view','add_to_cart','checkout_start','purchase','affiliate_click')),
  add column session_id text,
  add column referrer text,
  add column country text,
  add column value numeric(12,2);

-- ─── 16. new tables: wishlists, platform settings ───────────────────
create table public.imaket_wishlists (
  user_id uuid not null references public.imaket_users(id) on delete cascade,
  product_id uuid not null references public.imaket_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index imaket_wishlists_product_idx on public.imaket_wishlists (product_id);

create table public.imaket_platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.imaket_platform_settings (key, value) values
  ('fee_percent', '5'::jsonb),
  ('payout_hold_days', '7'::jsonb),
  ('min_payout', '{"ZMW":100,"NGN":5000,"KES":500,"GHS":50,"UGX":20000,"USD":10}'::jsonb),
  ('auto_approve_products', 'false'::jsonb),
  ('enabled_providers', '["flutterwave","dusupay","mobile_money","stripe","paypal"]'::jsonb),
  ('maintenance_mode', 'false'::jsonb);

-- ─── 17. Account deletion: personal rows go with the account ───────
-- (imaket's FKs had no ON DELETE action, so deleting any user with a
--  notification/review/etc. failed. Sellers with products or sales are
--  still protected: imaket_products.creator_id stays RESTRICT.)
alter table public.imaket_notifications drop constraint imaket_notifications_user_id_fkey,
  add constraint imaket_notifications_user_id_fkey foreign key (user_id) references public.imaket_users(id) on delete cascade;
alter table public.imaket_lesson_progress drop constraint imaket_lesson_progress_user_id_fkey,
  add constraint imaket_lesson_progress_user_id_fkey foreign key (user_id) references public.imaket_users(id) on delete cascade;
alter table public.imaket_reviews drop constraint imaket_reviews_user_id_fkey,
  add constraint imaket_reviews_customer_id_fkey foreign key (customer_id) references public.imaket_users(id) on delete cascade;
alter table public.imaket_affiliates drop constraint imaket_affiliates_user_id_fkey,
  add constraint imaket_affiliates_user_id_fkey foreign key (user_id) references public.imaket_users(id) on delete cascade;
alter table public.imaket_downloads drop constraint imaket_downloads_user_id_fkey,
  add constraint imaket_downloads_customer_id_fkey foreign key (customer_id) references public.imaket_users(id) on delete set null;
alter table public.imaket_reports drop constraint imaket_reports_user_id_fkey,
  add constraint imaket_reports_user_id_fkey foreign key (user_id) references public.imaket_users(id) on delete cascade;
alter table public.imaket_bookings drop constraint imaket_bookings_customer_id_fkey,
  add constraint imaket_bookings_customer_id_fkey foreign key (customer_id) references public.imaket_users(id) on delete cascade;
alter table public.imaket_tickets drop constraint imaket_tickets_customer_id_fkey,
  add constraint imaket_tickets_customer_id_fkey foreign key (customer_id) references public.imaket_users(id) on delete cascade;
alter table public.imaket_tickets drop constraint imaket_tickets_checked_in_by_fkey,
  add constraint imaket_tickets_checked_in_by_fkey foreign key (checked_in_by) references public.imaket_users(id) on delete set null;
alter table public.imaket_products drop constraint imaket_products_reviewed_by_fkey,
  add constraint imaket_products_reviewed_by_fkey foreign key (reviewed_by) references public.imaket_users(id) on delete set null;
alter table public.imaket_payouts drop constraint imaket_payouts_processed_by_fkey,
  add constraint imaket_payouts_processed_by_fkey foreign key (processed_by) references public.imaket_users(id) on delete set null;

-- ════════════════════════════════════════════════════════════════════
-- Helper functions (imaket_private, SECURITY DEFINER, empty search_path)
-- ════════════════════════════════════════════════════════════════════
create or replace function imaket_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.imaket_users where id = auth.uid() and role = 'admin' and not is_banned)
$$;

create or replace function imaket_private.current_creator_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.imaket_creators where user_id = auth.uid()
$$;

create or replace function imaket_private.owns_creator(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.imaket_creators where id = cid and user_id = auth.uid())
$$;

-- Owner of an active store, account not banned
create or replace function imaket_private.creator_can_sell(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.imaket_creators c join public.imaket_users u on u.id = c.user_id
    where c.id = cid and c.user_id = auth.uid() and c.status = 'active'
      and u.role in ('creator','admin') and not u.is_banned)
$$;

-- Paid order for this product, matched by account or by purchase email
create or replace function imaket_private.has_purchase(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.imaket_order_items i join public.imaket_orders o on o.id = i.order_id
    where i.product_id = pid and o.status in ('paid','fulfilled')
      and (o.customer_id = auth.uid()
           or lower(o.customer_email) = (select lower(email) from public.imaket_users where id = auth.uid())))
$$;

create or replace function imaket_private.is_order_seller(oid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.imaket_order_items i join public.imaket_creators c on c.id = i.creator_id
    where i.order_id = oid and c.user_id = auth.uid())
$$;

create or replace function imaket_private.order_is_mine(oid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.imaket_orders where id = oid and customer_id = auth.uid())
$$;

revoke all on all functions in schema imaket_private from public;
grant usage on schema imaket_private to anon, authenticated, service_role;
grant execute on function
  imaket_private.is_admin(), imaket_private.current_creator_id(), imaket_private.owns_creator(uuid),
  imaket_private.creator_can_sell(uuid), imaket_private.has_purchase(uuid), imaket_private.is_order_seller(uuid),
  imaket_private.order_is_mine(uuid), imaket_private.tags_to_text(text[])
  to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════
create or replace function imaket_private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;

create trigger imaket_users_updated before update on public.imaket_users for each row execute function imaket_private.set_updated_at();
create trigger imaket_creators_updated before update on public.imaket_creators for each row execute function imaket_private.set_updated_at();
create trigger imaket_products_updated before update on public.imaket_products for each row execute function imaket_private.set_updated_at();
create trigger imaket_orders_updated before update on public.imaket_orders for each row execute function imaket_private.set_updated_at();
create trigger imaket_payments_updated before update on public.imaket_payments for each row execute function imaket_private.set_updated_at();
create trigger imaket_reviews_updated before update on public.imaket_reviews for each row execute function imaket_private.set_updated_at();

-- New auth user → profile (+ store when signing up as a creator).
-- 'admin' can never be self-selected; admins are promoted manually.
create or replace function imaket_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role text := case when new.raw_user_meta_data->>'role' = 'creator' then 'creator' else 'customer' end;
  v_name text := left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 100);
  v_handle text;
begin
  insert into public.imaket_users (id, email, full_name, avatar_url, role)
  values (new.id, lower(new.email), v_name, new.raw_user_meta_data->>'avatar_url', v_role);

  if v_role = 'creator' then
    v_handle := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1)), '[^a-z0-9_-]', '', 'gi'));
    v_handle := regexp_replace(v_handle, '^[_-]+|[_-]+$', '', 'g');
    if char_length(v_handle) < 3 then v_handle := v_handle || substr(md5(new.id::text), 1, 4); end if;
    v_handle := left(v_handle, 28);
    while exists (select 1 from public.imaket_creators where handle = v_handle) loop
      v_handle := left(v_handle, 26) || substr(md5(random()::text), 1, 2);
    end loop;
    insert into public.imaket_creators (user_id, handle, store_name)
    values (new.id, v_handle, coalesce(new.raw_user_meta_data->>'store_name', v_name));
  end if;
  return new;
end $$;
create trigger imaket_new_user after insert on auth.users for each row execute function imaket_private.handle_new_user();

create or replace function imaket_private.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin update public.imaket_users set email = lower(new.email) where id = new.id; return new; end $$;
create trigger imaket_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function imaket_private.handle_user_email_change();

-- Users can't change their own role (except customer → creator) or ban status
create or replace function imaket_private.guard_user_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not imaket_private.is_admin() then
    if new.role is distinct from old.role and not (old.role = 'customer' and new.role = 'creator') then
      raise exception 'Not allowed to change role' using errcode = '42501';
    end if;
    if new.is_banned is distinct from old.is_banned then
      raise exception 'Not allowed to change ban status' using errcode = '42501';
    end if;
    new.email := old.email;  -- email only changes through Supabase Auth
  end if;
  return new;
end $$;
create trigger imaket_users_guard before update on public.imaket_users for each row execute function imaket_private.guard_user_update();

-- Reserved store links (collide with app routes)
create or replace function imaket_private.check_reserved_handle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.handle = any (array[
    'admin','api','auth','cart','checkout','creator','dashboard','login','register','logout','marketplace','p',
    'settings','signup','store','support','help','about','terms','privacy','forgot-password','reset-password',
    'verify-email','sokoni','imaket']) then
    raise exception 'Handle "%" is reserved', new.handle using errcode = '23514';
  end if;
  return new;
end $$;
create trigger imaket_creators_reserved_handle before insert or update of handle on public.imaket_creators
  for each row execute function imaket_private.check_reserved_handle();

-- Creators can't verify / unsuspend themselves
create or replace function imaket_private.guard_creator_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not imaket_private.is_admin() then
    new.status := old.status;
    new.verified := old.verified;
    new.user_id := old.user_id;
  end if;
  return new;
end $$;
create trigger imaket_creators_guard before update on public.imaket_creators for each row execute function imaket_private.guard_creator_update();

-- Product moderation workflow: creators save drafts / submit; admins publish.
create or replace function imaket_private.guard_product_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_auto boolean;
begin
  if current_setting('imaket.system_write', true) = 'on' then return new; end if;

  if auth.uid() is null or imaket_private.is_admin() then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
      new.published_at := coalesce(new.published_at, now());
    end if;
    return new;
  end if;

  select coalesce((value #>> '{}')::boolean, false) into v_auto
  from public.imaket_platform_settings where key = 'auto_approve_products';
  v_auto := coalesce(v_auto, false);

  if tg_op = 'UPDATE' then
    new.featured := old.featured;
    new.rating_avg := old.rating_avg; new.rating_count := old.rating_count;
    new.sales_count := old.sales_count; new.view_count := old.view_count;
    new.creator_id := old.creator_id;
  else
    new.featured := false;
    new.rating_avg := 0; new.rating_count := 0; new.sales_count := 0; new.view_count := 0;
  end if;

  if new.status in ('published','pending_review') and (tg_op = 'INSERT' or old.status <> 'published') then
    if v_auto then new.status := 'published'; new.published_at := coalesce(new.published_at, now());
    else new.status := 'pending_review'; end if;
  elsif new.status = 'rejected' then
    new.status := case when tg_op = 'UPDATE' then old.status else 'draft' end;
  end if;

  -- Material edits to a live product go back to review (unless auto-approve)
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published' and not v_auto
     and (new.title is distinct from old.title or new.description is distinct from old.description
          or new.cover_url is distinct from old.cover_url) then
    new.status := 'pending_review';
  end if;
  return new;
end $$;
create trigger imaket_products_guard before insert or update on public.imaket_products
  for each row execute function imaket_private.guard_product_status();

-- Rating aggregates
create or replace function imaket_private.refresh_product_rating() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := coalesce(new.product_id, old.product_id);
begin
  perform set_config('imaket.system_write', 'on', true);
  update public.imaket_products p set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.imaket_reviews where product_id = v_pid and status = 'published'), 0),
    rating_count = (select count(*) from public.imaket_reviews where product_id = v_pid and status = 'published')
  where p.id = v_pid;
  perform set_config('imaket.system_write', 'off', true);
  return null;
end $$;
create trigger imaket_reviews_rating after insert or update or delete on public.imaket_reviews
  for each row execute function imaket_private.refresh_product_rating();

-- Notify creator of moderation decisions
create or replace function imaket_private.notify_product_moderation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if new.status is distinct from old.status and new.status in ('published','rejected') then
    select user_id into v_user from public.imaket_creators where id = new.creator_id;
    insert into public.imaket_notifications (user_id, type, title, body, link)
    values (v_user, 'product.' || new.status,
            case when new.status = 'published' then 'Product approved' else 'Product needs changes' end,
            case when new.status = 'published' then new.title || ' is now live.'
                 else new.title || ': ' || coalesce(new.rejection_reason, 'see moderation notes') end,
            '/creator/products');
  end if;
  return new;
end $$;
create trigger imaket_products_moderation_notify after update of status on public.imaket_products
  for each row execute function imaket_private.notify_product_moderation();

-- Creators may only change fulfilment fields on order lines
create or replace function imaket_private.guard_order_item_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not imaket_private.is_admin() then
    if (new.unit_price, new.quantity, new.discount, new.line_total, new.platform_fee, new.affiliate_fee,
        new.creator_earnings, new.creator_id, new.order_id, new.product_id, new.title)
       is distinct from
       (old.unit_price, old.quantity, old.discount, old.line_total, old.platform_fee, old.affiliate_fee,
        old.creator_earnings, old.creator_id, old.order_id, old.product_id, old.title) then
      raise exception 'Only fulfilment fields can be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger imaket_order_items_guard before update on public.imaket_order_items
  for each row execute function imaket_private.guard_order_item_update();

-- Reviews: buyers edit their words; creators only reply / flag
create or replace function imaket_private.guard_review_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not imaket_private.is_admin() then
    if old.customer_id = auth.uid() then
      new.creator_reply := old.creator_reply; new.status := old.status;
    else
      new.rating := old.rating; new.title := old.title; new.body := old.body;
      if new.status not in ('published','flagged') then new.status := old.status; end if;
    end if;
    new.customer_id := old.customer_id; new.product_id := old.product_id;
  end if;
  return new;
end $$;
create trigger imaket_reviews_guard before update on public.imaket_reviews
  for each row execute function imaket_private.guard_review_update();

-- ════════════════════════════════════════════════════════════════════
-- Business functions (private) + public wrappers
-- ════════════════════════════════════════════════════════════════════

-- Marks an order paid after a VERIFIED provider result. Idempotent.
create or replace function imaket_private.finalize_order(p_order_id uuid, p_provider text, p_reference text, p_raw jsonb default null)
returns public.imaket_orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.imaket_orders;
  v_item record;
  v_creator_user uuid;
begin
  select * into v_order from public.imaket_orders where id = p_order_id for update;
  if not found then raise exception 'Order % not found', p_order_id; end if;
  if v_order.status in ('paid','fulfilled') then return v_order; end if;
  perform set_config('imaket.system_write', 'on', true);

  update public.imaket_payments set status = 'succeeded', raw = coalesce(p_raw, raw)
   where order_id = p_order_id and provider = p_provider and (provider_reference = p_reference or provider_reference is null);

  update public.imaket_orders set status = 'paid', paid_at = now(), payment_provider = p_provider
   where id = p_order_id returning * into v_order;

  for v_item in
    select oi.*, p.download_limit, p.access_days, p.type as ptype
    from public.imaket_order_items oi join public.imaket_products p on p.id = oi.product_id
    where oi.order_id = p_order_id
  loop
    if v_item.ptype in ('digital','course','membership','ticket') then
      insert into public.imaket_downloads (order_id, order_item_id, product_id, customer_id, customer_email, max_downloads, expires_at)
      values (p_order_id, v_item.id, v_item.product_id, v_order.customer_id, v_order.customer_email, v_item.download_limit,
              case when v_item.access_days is not null then now() + make_interval(days => v_item.access_days) end);
      update public.imaket_order_items set fulfillment_status = 'delivered' where id = v_item.id;
    end if;

    -- QR tickets when the product has an imaket event record and the buyer has an account
    if v_item.ptype = 'ticket' and v_order.customer_id is not null
       and exists (select 1 from public.imaket_events e where e.product_id = v_item.product_id and not e.cancelled) then
      insert into public.imaket_tickets (order_item_id, product_id, creator_id, customer_id, sequence)
      select v_item.id, v_item.product_id, v_item.creator_id, v_order.customer_id, n from generate_series(1, v_item.quantity) n
      on conflict (order_item_id, sequence) do nothing;
    end if;

    update public.imaket_products
       set sales_count = sales_count + v_item.quantity,
           inventory_qty = case when track_inventory and inventory_qty is not null then greatest(inventory_qty - v_item.quantity, 0) else inventory_qty end
     where id = v_item.product_id;

    insert into public.imaket_analytics_events (event, creator_id, product_id, value)
    values ('purchase', v_item.creator_id, v_item.product_id, v_item.line_total);

    select user_id into v_creator_user from public.imaket_creators where id = v_item.creator_id;
    insert into public.imaket_notifications (user_id, type, title, body, link)
    values (v_creator_user, 'order.paid', 'New sale',
            v_item.title || ' — ' || v_order.currency || ' ' || to_char(v_item.creator_earnings, 'FM999G999G990D00'),
            '/creator/orders');
  end loop;

  if v_order.coupon_id is not null then
    update public.imaket_coupons set used_count = used_count + 1 where id = v_order.coupon_id;
  end if;
  if v_order.affiliate_id is not null then
    update public.imaket_affiliates a set conversions = conversions + 1,
      earnings = earnings + (select coalesce(sum(affiliate_fee), 0) from public.imaket_order_items where order_id = p_order_id)
    where a.id = v_order.affiliate_id;
  end if;
  if v_order.customer_id is not null then
    insert into public.imaket_notifications (user_id, type, title, body, link)
    values (v_order.customer_id, 'order.confirmed', 'Payment received', 'Order ' || v_order.order_number || ' is confirmed.', '/dashboard/orders');
  end if;

  perform set_config('imaket.system_write', 'off', true);
  return v_order;
end $$;

create or replace function public.imaket_finalize_order(p_order_id uuid, p_provider text, p_reference text, p_raw jsonb default null)
returns public.imaket_orders language sql set search_path = '' as $$
  select * from imaket_private.finalize_order(p_order_id, p_provider, p_reference, p_raw)
$$;
revoke all on function imaket_private.finalize_order(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.imaket_finalize_order(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function imaket_private.finalize_order(uuid, text, text, jsonb) to service_role;
grant execute on function public.imaket_finalize_order(uuid, text, text, jsonb) to service_role;

-- Daily earnings for a creator (own store or admin)
create or replace function imaket_private.creator_daily_sales(p_creator_id uuid, p_days int default 30)
returns table (day date, revenue numeric, orders bigint)
language sql stable security definer set search_path = '' as $$
  select d::date, coalesce(sum(oi.creator_earnings), 0), count(distinct oi.order_id)
  from generate_series(current_date - (least(greatest(p_days, 1), 366) - 1), current_date, interval '1 day') d
  left join public.imaket_order_items oi
    on oi.creator_id = p_creator_id and oi.created_at::date = d::date
   and exists (select 1 from public.imaket_orders o where o.id = oi.order_id and o.status in ('paid','fulfilled'))
  where p_creator_id = imaket_private.current_creator_id() or imaket_private.is_admin()
     or (select auth.role()) = 'service_role'
  group by d order by d
$$;
create or replace function public.imaket_creator_daily_sales(p_creator_id uuid, p_days int default 30)
returns table (day date, revenue numeric, orders bigint) language sql stable set search_path = '' as $$
  select * from imaket_private.creator_daily_sales(p_creator_id, p_days)
$$;

create or replace function imaket_private.platform_daily_revenue(p_days int default 30)
returns table (day date, gmv numeric, fees numeric, orders bigint)
language sql stable security definer set search_path = '' as $$
  select d::date, coalesce(sum(o.total), 0), coalesce(sum(f.fees), 0), count(o.id)
  from generate_series(current_date - (least(greatest(p_days, 1), 366) - 1), current_date, interval '1 day') d
  left join public.imaket_orders o on o.paid_at::date = d::date and o.status in ('paid','fulfilled')
  left join lateral (select sum(platform_fee) fees from public.imaket_order_items where order_id = o.id) f on true
  where imaket_private.is_admin() or (select auth.role()) = 'service_role'
  group by d order by d
$$;
create or replace function public.imaket_platform_daily_revenue(p_days int default 30)
returns table (day date, gmv numeric, fees numeric, orders bigint) language sql stable set search_path = '' as $$
  select * from imaket_private.platform_daily_revenue(p_days)
$$;

create or replace function imaket_private.increment_product_view(p_product_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('imaket.system_write', 'on', true);
  update public.imaket_products set view_count = view_count + 1 where id = p_product_id and status = 'published';
  perform set_config('imaket.system_write', 'off', true);
end $$;
create or replace function public.imaket_increment_product_view(p_product_id uuid) returns void
language sql set search_path = '' as $$ select imaket_private.increment_product_view(p_product_id) $$;

-- Public reviewer names/avatars only (never emails)
create or replace function imaket_private.public_profiles(p_ids uuid[])
returns table (id uuid, full_name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select id, full_name, avatar_url from public.imaket_users where id = any (p_ids) and not is_banned limit 200
$$;
create or replace function public.imaket_public_profiles(p_ids uuid[])
returns table (id uuid, full_name text, avatar_url text) language sql stable set search_path = '' as $$
  select * from imaket_private.public_profiles(p_ids)
$$;

revoke all on function
  imaket_private.creator_daily_sales(uuid, int), public.imaket_creator_daily_sales(uuid, int),
  imaket_private.platform_daily_revenue(int), public.imaket_platform_daily_revenue(int),
  imaket_private.increment_product_view(uuid), public.imaket_increment_product_view(uuid),
  imaket_private.public_profiles(uuid[]), public.imaket_public_profiles(uuid[])
  from public;
grant execute on function imaket_private.creator_daily_sales(uuid, int), public.imaket_creator_daily_sales(uuid, int),
  imaket_private.platform_daily_revenue(int), public.imaket_platform_daily_revenue(int) to authenticated, service_role;
grant execute on function imaket_private.increment_product_view(uuid), public.imaket_increment_product_view(uuid),
  imaket_private.public_profiles(uuid[]), public.imaket_public_profiles(uuid[]) to anon, authenticated, service_role;

-- Keep imaket ticketing/booking functions working with the new type values
create or replace function imaket_private.issue_tickets(p_product uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare added integer;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  insert into public.imaket_tickets (order_item_id, product_id, creator_id, customer_id, sequence)
  select i.id, i.product_id, i.creator_id, o.customer_id, n
  from public.imaket_order_items i
  join public.imaket_orders o on o.id = i.order_id
  join public.imaket_events e on e.product_id = i.product_id
  join public.imaket_products p on p.id = i.product_id
  cross join lateral generate_series(1, i.quantity) n
  where i.product_id = p_product and o.customer_id = auth.uid() and o.status in ('paid','fulfilled')
    and p.type = 'ticket' and not e.cancelled
  on conflict (order_item_id, sequence) do nothing;
  get diagnostics added = row_count;
  return added;
end $$;

create or replace function imaket_private.check_ticket(p_token uuid, p_confirm boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.imaket_tickets; valid_order boolean; event_cancelled boolean;
begin
  select * into t from public.imaket_tickets where token = p_token for update;
  if t.id is null or not imaket_private.creator_can_sell(t.creator_id) then raise exception 'ticket not available for this creator'; end if;
  select o.status in ('paid','fulfilled') into valid_order
    from public.imaket_order_items i join public.imaket_orders o on o.id = i.order_id where i.id = t.order_item_id for update of o;
  select cancelled into event_cancelled from public.imaket_events where product_id = t.product_id for update;
  if not valid_order or event_cancelled then raise exception 'ticket is not valid for admission'; end if;
  if p_confirm and t.checked_in_at is null then
    update public.imaket_tickets set checked_in_at = now(), checked_in_by = auth.uid() where id = t.id returning * into t;
  end if;
  return jsonb_build_object('id', t.id, 'product_id', t.product_id, 'sequence', t.sequence, 'checked_in_at', t.checked_in_at);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Views
-- ════════════════════════════════════════════════════════════════════
-- available = cleared earnings (older than the hold period) − payouts not rejected
create or replace view public.imaket_creator_balances with (security_invoker = true) as
with hold as (
  select make_interval(days => coalesce((select (value #>> '{}')::int from public.imaket_platform_settings where key = 'payout_hold_days'), 7)) as h
)
select
  c.id as creator_id,
  c.currency,
  coalesce(sum(oi.creator_earnings) filter (where o.status in ('paid','fulfilled')), 0) as lifetime_earnings,
  coalesce(sum(oi.creator_earnings) filter (where o.status in ('paid','fulfilled') and o.paid_at < now() - (select h from hold)), 0)
    - coalesce((select sum(amount) from public.imaket_payouts p where p.creator_id = c.id and p.status <> 'rejected'), 0) as available,
  coalesce(sum(oi.creator_earnings) filter (where o.status in ('paid','fulfilled') and o.paid_at >= now() - (select h from hold)), 0) as pending,
  coalesce((select sum(amount) from public.imaket_payouts p where p.creator_id = c.id and p.status = 'paid'), 0) as paid_out
from public.imaket_creators c
left join public.imaket_order_items oi on oi.creator_id = c.id
left join public.imaket_orders o on o.id = oi.order_id
where c.id = (select imaket_private.current_creator_id())
   or (select imaket_private.is_admin())
   or (select auth.role()) = 'service_role'
group by c.id, c.currency;

-- ════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════
alter table public.imaket_product_files enable row level security;
alter table public.imaket_course_modules enable row level security;
alter table public.imaket_wishlists enable row level security;
alter table public.imaket_platform_settings enable row level security;

-- users
create policy users_read on public.imaket_users for select to authenticated
  using (id = (select auth.uid()) or (select imaket_private.is_admin()));
create policy users_update on public.imaket_users for update to authenticated
  using (id = (select auth.uid()) or (select imaket_private.is_admin()))
  with check (id = (select auth.uid()) or (select imaket_private.is_admin()));

-- creators
create policy creators_read on public.imaket_creators for select to anon, authenticated
  using (status = 'active' or user_id = (select auth.uid()) or (select imaket_private.is_admin()));
create policy creators_insert on public.imaket_creators for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy creators_update on public.imaket_creators for update to authenticated
  using (user_id = (select auth.uid()) or (select imaket_private.is_admin()))
  with check (user_id = (select auth.uid()) or (select imaket_private.is_admin()));
create policy creators_delete on public.imaket_creators for delete to authenticated using ((select imaket_private.is_admin()));

-- categories / settings
create policy categories_read on public.imaket_categories for select to anon, authenticated using (true);
create policy categories_admin on public.imaket_categories for all to authenticated
  using ((select imaket_private.is_admin())) with check ((select imaket_private.is_admin()));
create policy settings_read on public.imaket_platform_settings for select to anon, authenticated using (true);
create policy settings_admin on public.imaket_platform_settings for all to authenticated
  using ((select imaket_private.is_admin())) with check ((select imaket_private.is_admin()));

-- products
create policy products_read on public.imaket_products for select to anon, authenticated
  using (
    (status = 'published' and exists (select 1 from public.imaket_creators c where c.id = creator_id and c.status = 'active'))
    or creator_id = (select imaket_private.current_creator_id())
    or (select imaket_private.is_admin())
    or imaket_private.has_purchase(id)
  );
create policy products_insert on public.imaket_products for insert to authenticated
  with check (imaket_private.creator_can_sell(creator_id));
create policy products_update on public.imaket_products for update to authenticated
  using (imaket_private.creator_can_sell(creator_id) or (select imaket_private.is_admin()))
  with check (imaket_private.creator_can_sell(creator_id) or (select imaket_private.is_admin()));
create policy products_delete on public.imaket_products for delete to authenticated
  using (creator_id = (select imaket_private.current_creator_id()) or (select imaket_private.is_admin()));

-- product files: owner only. Buyers get 60-second signed URLs from the server.
create policy product_files_owner on public.imaket_product_files for all to authenticated
  using (exists (select 1 from public.imaket_products p where p.id = product_id
                 and (p.creator_id = (select imaket_private.current_creator_id()) or (select imaket_private.is_admin()))))
  with check (exists (select 1 from public.imaket_products p where p.id = product_id
                      and p.creator_id = (select imaket_private.current_creator_id())));

-- courses: outline is public for published products; videos are fetched via signed URLs
create policy modules_read on public.imaket_course_modules for select to anon, authenticated
  using (exists (select 1 from public.imaket_products p where p.id = product_id
                 and (p.status = 'published' or p.creator_id = (select imaket_private.current_creator_id()) or (select imaket_private.is_admin()))));
create policy modules_write on public.imaket_course_modules for all to authenticated
  using (exists (select 1 from public.imaket_products p where p.id = product_id and p.creator_id = (select imaket_private.current_creator_id())))
  with check (exists (select 1 from public.imaket_products p where p.id = product_id and p.creator_id = (select imaket_private.current_creator_id())));
create policy lessons_read on public.imaket_course_lessons for select to anon, authenticated
  using (exists (select 1 from public.imaket_products p where p.id = product_id
                 and (p.status = 'published' or p.creator_id = (select imaket_private.current_creator_id()) or (select imaket_private.is_admin()))));
create policy lessons_write on public.imaket_course_lessons for all to authenticated
  using (exists (select 1 from public.imaket_products p where p.id = product_id and p.creator_id = (select imaket_private.current_creator_id())))
  with check (exists (select 1 from public.imaket_products p where p.id = product_id and p.creator_id = (select imaket_private.current_creator_id())));
create policy progress_read on public.imaket_lesson_progress for select to authenticated using (user_id = (select auth.uid()));
create policy progress_write on public.imaket_lesson_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.imaket_course_lessons l where l.id = lesson_id and imaket_private.has_purchase(l.product_id)));
create policy progress_update on public.imaket_lesson_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.imaket_course_lessons l where l.id = lesson_id and imaket_private.has_purchase(l.product_id)));

-- coupons (validated server-side; never publicly listable)
create policy coupons_owner on public.imaket_coupons for all to authenticated
  using (creator_id = (select imaket_private.current_creator_id()) or (select imaket_private.is_admin()))
  with check (creator_id = (select imaket_private.current_creator_id()));

-- affiliates
create policy affiliates_read on public.imaket_affiliates for select to authenticated
  using (user_id = (select auth.uid()) or creator_id = (select imaket_private.current_creator_id()) or (select imaket_private.is_admin()));
create policy affiliates_join on public.imaket_affiliates for insert to authenticated
  with check (user_id = (select auth.uid()) and creator_id is distinct from (select imaket_private.current_creator_id()));
create policy affiliates_manage on public.imaket_affiliates for update to authenticated
  using (creator_id = (select imaket_private.current_creator_id()) or (select imaket_private.is_admin()))
  with check (creator_id = (select imaket_private.current_creator_id()) or (select imaket_private.is_admin()));
create policy affiliates_remove on public.imaket_affiliates for delete to authenticated
  using (creator_id = (select imaket_private.current_creator_id()) or user_id = (select auth.uid()) or (select imaket_private.is_admin()));

-- orders / items / payments: written only by the server (service role)
create policy orders_read on public.imaket_orders for select to authenticated
  using (customer_id = (select auth.uid()) or imaket_private.is_order_seller(id) or (select imaket_private.is_admin()));
create policy items_read on public.imaket_order_items for select to authenticated
  using (creator_id = (select imaket_private.current_creator_id()) or imaket_private.order_is_mine(order_id) or (select imaket_private.is_admin()));
create policy items_fulfil on public.imaket_order_items for update to authenticated
  using (creator_id = (select imaket_private.current_creator_id()))
  with check (creator_id = (select imaket_private.current_creator_id()));
create policy payments_read on public.imaket_payments for select to authenticated
  using (imaket_private.order_is_mine(order_id) or (select imaket_private.is_admin()));

-- downloads
create policy downloads_read on public.imaket_downloads for select to authenticated
  using (customer_id = (select auth.uid()) or (select imaket_private.is_admin()));

-- reviews
create policy reviews_read on public.imaket_reviews for select to anon, authenticated
  using (status = 'published' or customer_id = (select auth.uid()) or (select imaket_private.is_admin())
         or exists (select 1 from public.imaket_products p where p.id = product_id and p.creator_id = (select imaket_private.current_creator_id())));
create policy reviews_insert on public.imaket_reviews for insert to authenticated
  with check (customer_id = (select auth.uid()) and imaket_private.has_purchase(product_id));
create policy reviews_update on public.imaket_reviews for update to authenticated
  using (customer_id = (select auth.uid()) or (select imaket_private.is_admin())
         or exists (select 1 from public.imaket_products p where p.id = product_id and p.creator_id = (select imaket_private.current_creator_id())));
create policy reviews_delete on public.imaket_reviews for delete to authenticated
  using (customer_id = (select auth.uid()) or (select imaket_private.is_admin()));

-- payouts (created via /api/payouts with a balance check; processed by admins)
create policy payouts_read on public.imaket_payouts for select to authenticated
  using (creator_id = (select imaket_private.current_creator_id()) or (select imaket_private.is_admin()));
create policy payouts_admin on public.imaket_payouts for update to authenticated
  using ((select imaket_private.is_admin())) with check ((select imaket_private.is_admin()));

-- notifications / wishlists
create policy notifications_read on public.imaket_notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.imaket_notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.imaket_notifications for delete to authenticated using (user_id = (select auth.uid()));
create policy wishlist_own on public.imaket_wishlists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- analytics / reports
create policy analytics_read on public.imaket_analytics_events for select to authenticated
  using (creator_id = (select imaket_private.current_creator_id()) or (select imaket_private.is_admin()));
create policy reports_insert on public.imaket_reports for insert to authenticated with check (user_id = (select auth.uid()));
create policy reports_read on public.imaket_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select imaket_private.is_admin()));
create policy reports_review on public.imaket_reports for update to authenticated
  using ((select imaket_private.is_admin())) with check ((select imaket_private.is_admin()));

-- imaket extras: events, services, bookings, tickets, shipments, shipping rates
create policy events_read on public.imaket_events for select to anon, authenticated
  using (exists (select 1 from public.imaket_products p where p.id = product_id and p.status = 'published')
         or imaket_private.owns_creator(creator_id) or imaket_private.has_purchase(product_id));
create policy events_insert on public.imaket_events for insert to authenticated
  with check (imaket_private.creator_can_sell(creator_id) and exists (
    select 1 from public.imaket_products p where p.id = product_id and p.creator_id = imaket_events.creator_id and p.type = 'ticket'));
create policy events_update on public.imaket_events for update to authenticated
  using (imaket_private.owns_creator(creator_id))
  with check (imaket_private.creator_can_sell(creator_id) and exists (
    select 1 from public.imaket_products p where p.id = product_id and p.creator_id = imaket_events.creator_id and p.type = 'ticket'));
create policy services_read on public.imaket_services for select to anon, authenticated
  using (exists (select 1 from public.imaket_products p where p.id = product_id and p.status = 'published') or imaket_private.owns_creator(creator_id));
create policy services_insert on public.imaket_services for insert to authenticated
  with check (imaket_private.creator_can_sell(creator_id) and exists (
    select 1 from public.imaket_products p where p.id = product_id and p.creator_id = imaket_services.creator_id and p.type = 'service'));
create policy services_update on public.imaket_services for update to authenticated
  using (imaket_private.owns_creator(creator_id))
  with check (imaket_private.creator_can_sell(creator_id) and exists (
    select 1 from public.imaket_products p where p.id = product_id and p.creator_id = imaket_services.creator_id and p.type = 'service'));
create policy bookings_read on public.imaket_bookings for select to authenticated
  using (customer_id = (select auth.uid()) or imaket_private.owns_creator(creator_id));
create policy tickets_read on public.imaket_tickets for select to authenticated
  using (customer_id = (select auth.uid()) or imaket_private.owns_creator(creator_id));
create policy shipments_read on public.imaket_shipments for select to authenticated
  using (imaket_private.owns_creator(creator_id) or imaket_private.order_is_mine(order_id));
create policy shipments_insert on public.imaket_shipments for insert to authenticated
  with check (imaket_private.creator_can_sell(creator_id) and exists (
    select 1 from public.imaket_order_items i join public.imaket_orders o on o.id = i.order_id
    where i.order_id = imaket_shipments.order_id and i.creator_id = imaket_shipments.creator_id
      and o.status in ('paid','fulfilled') and i.product_type = 'physical'));
create policy shipments_update on public.imaket_shipments for update to authenticated
  using (imaket_private.owns_creator(creator_id))
  with check (imaket_private.creator_can_sell(creator_id));
create policy shipping_rates_read on public.imaket_shipping_rates for select to anon, authenticated
  using (active or imaket_private.owns_creator(creator_id));
create policy shipping_rates_owner on public.imaket_shipping_rates for all to authenticated
  using (imaket_private.owns_creator(creator_id)) with check (imaket_private.creator_can_sell(creator_id));

-- ════════════════════════════════════════════════════════════════════
-- Grants (explicit, imaket style)
-- ════════════════════════════════════════════════════════════════════
revoke all on public.imaket_users, public.imaket_creators, public.imaket_categories, public.imaket_products,
  public.imaket_product_files, public.imaket_course_modules, public.imaket_course_lessons, public.imaket_coupons,
  public.imaket_affiliates, public.imaket_orders, public.imaket_order_items, public.imaket_payments, public.imaket_downloads,
  public.imaket_reviews, public.imaket_payouts, public.imaket_notifications, public.imaket_wishlists,
  public.imaket_analytics_events, public.imaket_platform_settings, public.imaket_creator_balances
  from anon, authenticated;

grant select on public.imaket_categories, public.imaket_creators, public.imaket_products, public.imaket_reviews,
  public.imaket_course_modules, public.imaket_platform_settings to anon, authenticated;
-- lesson outline is public; video_path/content stay server-only
grant select (id, product_id, module_id, title, summary, sort_order, duration_seconds, is_preview)
  on public.imaket_course_lessons to anon, authenticated;

grant select on public.imaket_users to authenticated;
grant update (full_name, avatar_url, phone, country, role, email_notifications) on public.imaket_users to authenticated;
grant insert, update on public.imaket_creators to authenticated;
grant insert, update, delete on public.imaket_products to authenticated;
grant select, insert, update, delete on public.imaket_product_files, public.imaket_course_modules to authenticated;
grant insert, update, delete on public.imaket_course_lessons to authenticated;
grant select, insert, update, delete on public.imaket_coupons, public.imaket_affiliates to authenticated;
grant select on public.imaket_orders, public.imaket_payments, public.imaket_downloads, public.imaket_payouts,
  public.imaket_analytics_events, public.imaket_creator_balances to authenticated;
grant select, update (fulfillment_status, tracking_number) on public.imaket_order_items to authenticated;
grant insert, update, delete on public.imaket_reviews to authenticated;
grant update (status, reference, note, processed_by, processed_at) on public.imaket_payouts to authenticated;
grant select, update (read_at), delete on public.imaket_notifications to authenticated;
grant select, insert, update, delete on public.imaket_wishlists to authenticated;
grant insert on public.imaket_reports to authenticated;

grant all on public.imaket_users, public.imaket_creators, public.imaket_categories, public.imaket_products,
  public.imaket_product_files, public.imaket_course_modules, public.imaket_course_lessons, public.imaket_coupons,
  public.imaket_affiliates, public.imaket_orders, public.imaket_order_items, public.imaket_payments, public.imaket_downloads,
  public.imaket_reviews, public.imaket_payouts, public.imaket_notifications, public.imaket_wishlists,
  public.imaket_analytics_events, public.imaket_platform_settings, public.imaket_creator_balances to service_role;
grant usage, select on sequence public.imaket_order_number_seq to service_role;

-- ════════════════════════════════════════════════════════════════════
-- Storage: reuse imaket buckets
--   imaket-covers         public images (covers, avatars, banners)
--   imaket-product-files  private paid files (signed URLs only)
-- Path convention: <creator_id>/… (or <user_id>/… for personal images)
-- ════════════════════════════════════════════════════════════════════
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/avif']
  where id = 'imaket-covers';
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('imaket-covers', 'imaket-covers', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif','image/avif'])
  on conflict (id) do nothing;
-- 50 MB = Supabase free-plan upload cap; raise on Pro
update storage.buckets set file_size_limit = 52428800, allowed_mime_types = null where id = 'imaket-product-files';

create policy imaket_covers_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'imaket-covers');
create policy imaket_covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'imaket-covers'
              and (storage.foldername(name))[1] in ((select imaket_private.current_creator_id())::text, (select auth.uid())::text));
create policy imaket_covers_update on storage.objects for update to authenticated
  using (bucket_id = 'imaket-covers'
         and (storage.foldername(name))[1] in ((select imaket_private.current_creator_id())::text, (select auth.uid())::text));
create policy imaket_covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'imaket-covers'
         and (storage.foldername(name))[1] in ((select imaket_private.current_creator_id())::text, (select auth.uid())::text));
create policy imaket_files_read_own on storage.objects for select to authenticated
  using (bucket_id = 'imaket-product-files' and (storage.foldername(name))[1] = (select imaket_private.current_creator_id())::text);
create policy imaket_files_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'imaket-product-files' and (storage.foldername(name))[1] = (select imaket_private.current_creator_id())::text);
create policy imaket_files_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'imaket-product-files' and (storage.foldername(name))[1] = (select imaket_private.current_creator_id())::text);

-- ─── Realtime ───────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'imaket_order_items') then
    alter publication supabase_realtime add table public.imaket_order_items;
  end if;
end $$;
