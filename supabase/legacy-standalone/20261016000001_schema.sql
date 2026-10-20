-- ════════════════════════════════════════════════════════════════════
-- Sokoni — creator marketplace schema
-- Tables, enums, indexes, helper functions and business-logic triggers.
-- RLS policies live in 20261016000002_rls.sql, storage in ..._storage.sql
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

-- ─── Enums ──────────────────────────────────────────────────────────
create type public.user_role       as enum ('admin', 'creator', 'customer');
create type public.creator_status  as enum ('pending', 'active', 'suspended');
create type public.product_type    as enum ('digital', 'course', 'service', 'ticket', 'physical', 'membership');
create type public.product_status  as enum ('draft', 'pending_review', 'published', 'rejected', 'archived');
create type public.order_status    as enum ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded', 'failed');
create type public.payment_status  as enum ('initiated', 'pending', 'succeeded', 'failed', 'refunded');
create type public.payment_provider as enum ('stripe', 'paypal', 'flutterwave', 'dusupay', 'mobile_money');
create type public.payout_status   as enum ('requested', 'processing', 'paid', 'rejected');
create type public.coupon_type     as enum ('percent', 'fixed');
create type public.fulfillment_status as enum ('unfulfilled', 'delivered', 'shipped', 'completed');

-- ─── Generic updated_at trigger ─────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── users (public profile mirror of auth.users) ────────────────────
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext not null unique,
  full_name   text,
  avatar_url  text,
  phone       text,
  country     text default 'ZM',
  role        public.user_role not null default 'customer',
  is_banned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger users_updated before update on public.users
  for each row execute function public.set_updated_at();

-- ─── creators (one store per creator account) ───────────────────────
create table public.creators (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.users(id) on delete cascade,
  handle            citext not null unique
                    check (handle ~ '^[a-z0-9](?:[a-z0-9_-]{1,30})[a-z0-9]$'),
  store_name        text not null,
  tagline           text,
  bio               text,
  avatar_url        text,
  banner_url        text,
  brand_color       text default '#E8590C',
  socials           jsonb not null default '{}'::jsonb,   -- {instagram, x, tiktok, youtube, website, whatsapp}
  country           text default 'ZM',
  currency          text not null default 'ZMW',
  status            public.creator_status not null default 'active',
  verified          boolean not null default false,
  featured_product_ids uuid[] not null default '{}',
  payout_method     jsonb,                                  -- {type:'mobile_money', network:'MTN', number:'…'} | {type:'bank', …}
  custom_domain     citext unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger creators_updated before update on public.creators
  for each row execute function public.set_updated_at();

-- Handles that would collide with app routes
create or replace function public.check_reserved_handle() returns trigger
language plpgsql as $$
begin
  if lower(new.handle::text) = any (array[
    'admin','api','auth','cart','checkout','creator','dashboard','login','register',
    'logout','marketplace','p','settings','signup','store','support','help','about',
    'terms','privacy','forgot-password','reset-password','verify-email','sokoni'
  ]) then
    raise exception 'Handle "%" is reserved', new.handle using errcode = '23514';
  end if;
  return new;
end $$;
create trigger creators_reserved_handle before insert or update of handle on public.creators
  for each row execute function public.check_reserved_handle();

-- ─── categories ─────────────────────────────────────────────────────
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       citext not null unique,
  name       text not null,
  icon       text,                 -- lucide icon name
  parent_id  uuid references public.categories(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ─── products ───────────────────────────────────────────────────────
-- array_to_string is STABLE; generated columns need IMMUTABLE.
create or replace function public.tags_to_text(text[]) returns text
language sql immutable parallel safe as $$ select coalesce(array_to_string($1, ' '), '') $$;

create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references public.creators(id) on delete cascade,
  category_id        uuid references public.categories(id) on delete set null,
  type               public.product_type not null default 'digital',
  status             public.product_status not null default 'draft',
  title              text not null check (char_length(title) between 3 and 140),
  slug               citext not null unique,
  summary            text,
  description        text,
  price              numeric(12,2) not null default 0 check (price >= 0),
  compare_at_price   numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  currency           text not null default 'ZMW',
  pay_what_you_want  boolean not null default false,
  min_price          numeric(12,2),
  cover_url          text,
  gallery            text[] not null default '{}',
  tags               text[] not null default '{}',
  featured           boolean not null default false,       -- platform-featured (admin)
  -- inventory / physical
  track_inventory    boolean not null default false,
  inventory_qty      int check (inventory_qty is null or inventory_qty >= 0),
  sku                text,
  requires_shipping  boolean not null default false,
  shipping_fee       numeric(12,2) not null default 0,
  weight_grams       int,
  -- events / tickets
  event_starts_at    timestamptz,
  event_ends_at      timestamptz,
  event_venue        text,
  event_online_url   text,
  -- services
  service_duration_minutes int,
  booking_url        text,
  -- digital delivery
  download_limit     int default 5,
  access_days        int,                                  -- null = lifetime
  -- affiliates
  affiliate_enabled  boolean not null default false,
  affiliate_commission_percent numeric(5,2) default 10 check (affiliate_commission_percent between 0 and 90),
  -- counters
  rating_avg         numeric(3,2) not null default 0,
  rating_count       int not null default 0,
  sales_count        int not null default 0,
  view_count         int not null default 0,
  -- moderation
  rejection_reason   text,
  reviewed_by        uuid references public.users(id),
  reviewed_at        timestamptz,
  published_at       timestamptz,
  search             tsvector generated always as (
                       setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
                       setweight(to_tsvector('simple', coalesce(summary,'')), 'B') ||
                       setweight(to_tsvector('simple', public.tags_to_text(tags)), 'B') ||
                       setweight(to_tsvector('simple', coalesce(description,'')), 'C')
                     ) stored,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index products_creator_idx   on public.products(creator_id);
create index products_status_idx    on public.products(status, published_at desc);
create index products_category_idx  on public.products(category_id);
create index products_type_idx      on public.products(type);
create index products_search_idx    on public.products using gin(search);
create index products_title_trgm    on public.products using gin(title gin_trgm_ops);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- Files delivered after purchase (private bucket "product-files")
create table public.product_files (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index product_files_product_idx on public.product_files(product_id);

-- Courses
create table public.course_modules (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  title       text not null,
  sort_order  int not null default 0
);
create table public.course_lessons (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid not null references public.course_modules(id) on delete cascade,
  title             text not null,
  content           text,
  video_path        text,           -- path in product-files bucket
  duration_seconds  int,
  is_preview        boolean not null default false,
  sort_order        int not null default 0
);
create table public.lesson_progress (
  user_id      uuid not null references public.users(id) on delete cascade,
  lesson_id    uuid not null references public.course_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- ─── coupons ────────────────────────────────────────────────────────
create table public.coupons (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references public.creators(id) on delete cascade,
  code         citext not null,
  type         public.coupon_type not null default 'percent',
  value        numeric(12,2) not null check (value > 0),
  min_order    numeric(12,2) not null default 0,
  max_uses     int,
  used_count   int not null default 0,
  product_ids  uuid[],              -- null = all of creator's products
  starts_at    timestamptz,
  ends_at      timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (creator_id, code),
  check (type <> 'percent' or value <= 100)
);

-- ─── affiliates ─────────────────────────────────────────────────────
create table public.affiliates (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references public.creators(id) on delete cascade,
  user_id            uuid not null references public.users(id) on delete cascade,
  code               citext not null unique,
  commission_percent numeric(5,2) not null default 10,
  clicks             int not null default 0,
  conversions        int not null default 0,
  earnings           numeric(12,2) not null default 0,
  status             text not null default 'active' check (status in ('active','paused')),
  created_at         timestamptz not null default now(),
  unique (creator_id, user_id)
);

-- ─── orders ─────────────────────────────────────────────────────────
create sequence public.order_number_seq start 100001;

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique default ('SK-' || nextval('public.order_number_seq')),
  customer_id      uuid references public.users(id) on delete set null,   -- null for guest checkout
  customer_email   citext not null,
  customer_name    text,
  customer_phone   text,
  status           public.order_status not null default 'pending',
  currency         text not null default 'ZMW',
  subtotal         numeric(12,2) not null default 0,
  discount_total   numeric(12,2) not null default 0,
  shipping_total   numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  coupon_id        uuid references public.coupons(id) on delete set null,
  affiliate_id     uuid references public.affiliates(id) on delete set null,
  shipping_address jsonb,
  payment_provider public.payment_provider,
  notes            text,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_email_idx    on public.orders(customer_email);
create index orders_status_idx   on public.orders(status, created_at desc);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  product_id         uuid references public.products(id) on delete set null,
  creator_id         uuid not null references public.creators(id) on delete restrict,
  title              text not null,
  product_type       public.product_type not null,
  unit_price         numeric(12,2) not null,
  quantity           int not null default 1 check (quantity > 0),
  discount           numeric(12,2) not null default 0,
  line_total         numeric(12,2) not null,
  platform_fee       numeric(12,2) not null default 0,
  affiliate_fee      numeric(12,2) not null default 0,
  creator_earnings   numeric(12,2) not null default 0,
  fulfillment_status public.fulfillment_status not null default 'unfulfilled',
  tracking_number    text,
  created_at         timestamptz not null default now()
);
create index order_items_order_idx   on public.order_items(order_id);
create index order_items_creator_idx on public.order_items(creator_id, created_at desc);
create index order_items_product_idx on public.order_items(product_id);

-- ─── payments ───────────────────────────────────────────────────────
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  provider           public.payment_provider not null,
  provider_reference text,
  checkout_url       text,
  amount             numeric(12,2) not null,
  currency           text not null,
  status             public.payment_status not null default 'initiated',
  method             text,              -- card | mobile_money | paypal | bank
  failure_reason     text,
  raw                jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (provider, provider_reference)
);
create index payments_order_idx on public.payments(order_id);
create trigger payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

-- ─── downloads (entitlements for digital goods) ─────────────────────
create table public.downloads (
  id                 uuid primary key default gen_random_uuid(),
  order_item_id      uuid not null references public.order_items(id) on delete cascade,
  product_id         uuid not null references public.products(id) on delete cascade,
  customer_id        uuid references public.users(id) on delete cascade,
  customer_email     citext not null,
  access_token       text not null unique default encode(gen_random_bytes(24), 'hex'),
  download_count     int not null default 0,
  max_downloads      int,                 -- null = unlimited
  expires_at         timestamptz,
  last_downloaded_at timestamptz,
  created_at         timestamptz not null default now()
);
create index downloads_customer_idx on public.downloads(customer_id);
create index downloads_email_idx    on public.downloads(customer_email);

-- ─── reviews ────────────────────────────────────────────────────────
create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  customer_id   uuid not null references public.users(id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  title         text,
  body          text,
  status        text not null default 'published' check (status in ('published','hidden','flagged')),
  creator_reply text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (product_id, customer_id)
);
create index reviews_product_idx on public.reviews(product_id, created_at desc);
create trigger reviews_updated before update on public.reviews
  for each row execute function public.set_updated_at();

-- ─── payouts ────────────────────────────────────────────────────────
create table public.payouts (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.creators(id) on delete cascade,
  amount        numeric(12,2) not null check (amount > 0),
  currency      text not null,
  method        text not null,        -- mobile_money | bank | paypal
  destination   jsonb not null,
  status        public.payout_status not null default 'requested',
  reference     text,
  note          text,
  processed_by  uuid references public.users(id),
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz
);
create index payouts_creator_idx on public.payouts(creator_id, requested_at desc);

-- ─── notifications ──────────────────────────────────────────────────
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null,          -- order.paid | product.approved | payout.paid | review.new …
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

-- ─── wishlists ──────────────────────────────────────────────────────
create table public.wishlists (
  user_id    uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ─── analytics events ───────────────────────────────────────────────
create table public.analytics_events (
  id          bigint generated always as identity primary key,
  event       text not null check (event in ('store_view','product_view','add_to_cart','checkout_start','purchase','affiliate_click')),
  creator_id  uuid references public.creators(id) on delete cascade,
  product_id  uuid references public.products(id) on delete cascade,
  session_id  text,
  referrer    text,
  country     text,
  value       numeric(12,2),
  created_at  timestamptz not null default now()
);
create index analytics_creator_idx on public.analytics_events(creator_id, created_at desc);
create index analytics_product_idx on public.analytics_events(product_id, created_at desc);

-- ─── moderation reports ─────────────────────────────────────────────
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid references public.users(id) on delete set null,
  target_type  text not null check (target_type in ('product','creator','review')),
  target_id    uuid not null,
  reason       text not null,
  details      text,
  status       text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolved_by  uuid references public.users(id),
  created_at   timestamptz not null default now()
);

-- ─── platform settings (key/value) ──────────────────────────────────
create table public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (key, value) values
  ('fee_percent',          '5'::jsonb),
  ('payout_hold_days',     '7'::jsonb),
  ('min_payout',           '{"ZMW":100,"NGN":5000,"KES":500,"GHS":50,"UGX":20000,"USD":10}'::jsonb),
  ('auto_approve_products','false'::jsonb),
  ('enabled_providers',    '["flutterwave","dusupay","mobile_money","stripe","paypal"]'::jsonb),
  ('maintenance_mode',     'false'::jsonb);

-- ════════════════════════════════════════════════════════════════════
-- Helper functions
-- ════════════════════════════════════════════════════════════════════

create or replace function public.current_role_name() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin' and not is_banned)
$$;

create or replace function public.current_creator_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.creators where user_id = auth.uid()
$$;

-- Has the current user bought this product (paid order)?
create or replace function public.has_purchased(p_product_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = p_product_id
      and o.status in ('paid','fulfilled')
      and (o.customer_id = auth.uid()
           or o.customer_email = (select email from public.users where id = auth.uid()))
  )
$$;

-- ─── New auth user → profile (+ creator store) ──────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := 'customer';
  v_handle text;
begin
  -- Only 'creator' or 'customer' can be self-selected. Admins are promoted manually.
  if coalesce(new.raw_user_meta_data->>'role', '') = 'creator' then
    v_role := 'creator';
  end if;

  insert into public.users (id, email, full_name, avatar_url, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'avatar_url',
          v_role);

  if v_role = 'creator' then
    v_handle := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'handle', split_part(new.email,'@',1)), '[^a-z0-9_-]', '', 'gi'));
    if char_length(v_handle) < 3 then v_handle := v_handle || substr(md5(new.id::text), 1, 4); end if;
    -- de-duplicate
    while exists (select 1 from public.creators where handle = v_handle) loop
      v_handle := v_handle || substr(md5(random()::text), 1, 2);
    end loop;
    insert into public.creators (user_id, handle, store_name)
    values (new.id, v_handle,
            coalesce(new.raw_user_meta_data->>'store_name', new.raw_user_meta_data->>'full_name', v_handle));
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep email in sync
create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ─── Guard: users cannot escalate their own role / unban themselves ─
create or replace function public.guard_user_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      -- allow customer → creator upgrade only
      if not (old.role = 'customer' and new.role = 'creator') then
        raise exception 'Not allowed to change role';
      end if;
    end if;
    if new.is_banned is distinct from old.is_banned then
      raise exception 'Not allowed to change ban status';
    end if;
  end if;
  return new;
end $$;
create trigger users_guard before update on public.users
  for each row execute function public.guard_user_update();

-- ─── Guard: product moderation workflow ─────────────────────────────
-- Creators can save drafts, submit for review, or archive. Only admins
-- (or auto-approve) move a product to 'published'/'rejected', set featured.
create or replace function public.guard_product_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_auto boolean;
begin
  -- trusted internal writers (rating/view/sales counters) set this flag
  if current_setting('sokoni.system_write', true) = 'on' then
    return new;
  end if;
  if auth.uid() is null or public.is_admin() then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
      new.published_at := coalesce(new.published_at, now());
    end if;
    return new;
  end if;

  select coalesce((value)::text::boolean, false) into v_auto
  from public.platform_settings where key = 'auto_approve_products';

  if tg_op = 'UPDATE' then
    new.featured := old.featured;
    new.rating_avg := old.rating_avg; new.rating_count := old.rating_count;
    new.sales_count := old.sales_count; new.view_count := old.view_count;
  else
    new.featured := false;
  end if;

  if new.status in ('published', 'pending_review')
     and (tg_op = 'INSERT' or old.status not in ('published')) then
    if v_auto then
      new.status := 'published';
      new.published_at := coalesce(new.published_at, now());
    else
      new.status := 'pending_review';
    end if;
  elsif new.status = 'rejected' then
    new.status := coalesce(old.status, 'draft');
  end if;

  -- Material edits to a live product send it back to review (unless auto-approve)
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published' and not v_auto
     and (new.title is distinct from old.title or new.description is distinct from old.description
          or new.cover_url is distinct from old.cover_url) then
    new.status := 'pending_review';
  end if;
  return new;
end $$;
create trigger products_guard before insert or update on public.products
  for each row execute function public.guard_product_status();

-- ─── Review aggregates ──────────────────────────────────────────────
create or replace function public.refresh_product_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pid uuid := coalesce(new.product_id, old.product_id);
begin
  perform set_config('sokoni.system_write', 'on', true);
  update public.products p set
    rating_avg   = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where product_id = v_pid and status = 'published'), 0),
    rating_count = (select count(*) from public.reviews where product_id = v_pid and status = 'published')
  where p.id = v_pid;
  perform set_config('sokoni.system_write', 'off', true);
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- ─── Notify on product moderation decision ──────────────────────────
create or replace function public.notify_product_moderation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if new.status is distinct from old.status and new.status in ('published','rejected') then
    select user_id into v_user from public.creators where id = new.creator_id;
    insert into public.notifications (user_id, type, title, body, link)
    values (v_user,
            'product.' || new.status,
            case when new.status = 'published' then 'Product approved' else 'Product needs changes' end,
            case when new.status = 'published' then new.title || ' is now live.'
                 else new.title || ': ' || coalesce(new.rejection_reason, 'see moderation notes') end,
            '/creator/products');
  end if;
  return new;
end $$;
create trigger products_moderation_notify after update of status on public.products
  for each row execute function public.notify_product_moderation();

-- ════════════════════════════════════════════════════════════════════
-- finalize_order — called ONLY by the server (service role) after a
-- payment provider confirms payment (webhook or verified redirect).
-- Idempotent: running twice does nothing the second time.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.finalize_order(
  p_order_id uuid, p_provider public.payment_provider, p_reference text, p_raw jsonb default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
  v_item  record;
  v_creator_user uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order % not found', p_order_id; end if;
  if v_order.status in ('paid', 'fulfilled') then return v_order; end if;
  perform set_config('sokoni.system_write', 'on', true);

  update public.payments
     set status = 'succeeded', raw = coalesce(p_raw, raw)
   where order_id = p_order_id and provider = p_provider
     and (provider_reference = p_reference or provider_reference is null);

  update public.orders
     set status = 'paid', paid_at = now(), payment_provider = p_provider
   where id = p_order_id
  returning * into v_order;

  for v_item in
    select oi.*, p.download_limit, p.access_days, p.track_inventory, p.type as ptype
    from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
  loop
    -- entitlements for anything deliverable online
    if v_item.ptype in ('digital','course','membership','ticket') then
      insert into public.downloads (order_item_id, product_id, customer_id, customer_email, max_downloads, expires_at)
      values (v_item.id, v_item.product_id, v_order.customer_id, v_order.customer_email,
              v_item.download_limit,
              case when v_item.access_days is not null then now() + make_interval(days => v_item.access_days) end);
      update public.order_items set fulfillment_status = 'delivered' where id = v_item.id;
    end if;

    update public.products
       set sales_count = sales_count + v_item.quantity,
           inventory_qty = case when track_inventory then greatest(inventory_qty - v_item.quantity, 0) else inventory_qty end
     where id = v_item.product_id;

    insert into public.analytics_events (event, creator_id, product_id, value)
    values ('purchase', v_item.creator_id, v_item.product_id, v_item.line_total);

    select user_id into v_creator_user from public.creators where id = v_item.creator_id;
    insert into public.notifications (user_id, type, title, body, link)
    values (v_creator_user, 'order.paid', 'New sale 🎉',
            v_item.title || ' — ' || v_order.currency || ' ' || to_char(v_item.creator_earnings, 'FM999G999G990D00'),
            '/creator/orders');
  end loop;

  if v_order.coupon_id is not null then
    update public.coupons set used_count = used_count + 1 where id = v_order.coupon_id;
  end if;

  if v_order.affiliate_id is not null then
    update public.affiliates a set
      conversions = conversions + 1,
      earnings = earnings + (select coalesce(sum(affiliate_fee),0) from public.order_items where order_id = p_order_id)
    where a.id = v_order.affiliate_id;
  end if;

  if v_order.customer_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_order.customer_id, 'order.confirmed', 'Payment received',
            'Order ' || v_order.order_number || ' is confirmed.', '/dashboard/orders');
  end if;

  perform set_config('sokoni.system_write', 'off', true);
  return v_order;
end $$;

revoke all on function public.finalize_order(uuid, public.payment_provider, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_order(uuid, public.payment_provider, text, jsonb) to service_role;

-- ─── Creator balances ───────────────────────────────────────────────
-- available = earnings from paid orders older than the hold period − payouts not rejected
create or replace view public.creator_balances
with (security_invoker = true) as
select
  c.id as creator_id,
  c.currency,
  coalesce(sum(oi.creator_earnings) filter (where o.status in ('paid','fulfilled')), 0) as lifetime_earnings,
  coalesce(sum(oi.creator_earnings) filter (
      where o.status in ('paid','fulfilled')
        and o.paid_at < now() - make_interval(days => coalesce((select (value)::text::int from public.platform_settings where key='payout_hold_days'), 7))
  ), 0)
  - coalesce((select sum(amount) from public.payouts p where p.creator_id = c.id and p.status <> 'rejected'), 0) as available,
  coalesce(sum(oi.creator_earnings) filter (
      where o.status in ('paid','fulfilled')
        and o.paid_at >= now() - make_interval(days => coalesce((select (value)::text::int from public.platform_settings where key='payout_hold_days'), 7))
  ), 0) as pending,
  coalesce((select sum(amount) from public.payouts p where p.creator_id = c.id and p.status = 'paid'), 0) as paid_out
from public.creators c
left join public.order_items oi on oi.creator_id = c.id
left join public.orders o on o.id = oi.order_id
group by c.id, c.currency;

-- Daily sales per creator (analytics charts)
create or replace function public.creator_daily_sales(p_creator_id uuid, p_days int default 30)
returns table(day date, revenue numeric, orders bigint)
language sql stable security definer set search_path = public as $$
  select d::date as day,
         coalesce(sum(oi.creator_earnings), 0) as revenue,
         count(distinct oi.order_id) as orders
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
  left join public.order_items oi
         on oi.creator_id = p_creator_id
        and oi.created_at::date = d::date
        and exists (select 1 from public.orders o where o.id = oi.order_id and o.status in ('paid','fulfilled'))
  where p_creator_id = public.current_creator_id() or public.is_admin()
  group by d order by d
$$;

create or replace function public.platform_daily_revenue(p_days int default 30)
returns table(day date, gmv numeric, fees numeric, orders bigint)
language sql stable security definer set search_path = public as $$
  select d::date, coalesce(sum(o.total),0), coalesce(sum(f.fees),0), count(o.id)
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
  left join public.orders o on o.paid_at::date = d::date and o.status in ('paid','fulfilled')
  left join lateral (select sum(platform_fee) fees from public.order_items where order_id = o.id) f on true
  where public.is_admin()
  group by d order by d
$$;

-- Atomic view counter (callable by anyone; cheap)
create or replace function public.increment_product_view(p_product_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('sokoni.system_write', 'on', true);
  update public.products set view_count = view_count + 1 where id = p_product_id and status = 'published';
  perform set_config('sokoni.system_write', 'off', true);
end $$;

-- ─── Realtime ───────────────────────────────────────────────────────
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
