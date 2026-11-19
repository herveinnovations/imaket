-- ════════════════════════════════════════════════════════════════════
-- Row Level Security
-- Principle: the browser (anon/authenticated keys) can only read what it
-- owns or what is public. Money-moving writes (orders, payments,
-- downloads, payouts approval) go through server routes using the
-- service-role key, which bypasses RLS.
-- ════════════════════════════════════════════════════════════════════

alter table public.users             enable row level security;
alter table public.creators          enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.product_files     enable row level security;
alter table public.course_modules    enable row level security;
alter table public.course_lessons    enable row level security;
alter table public.lesson_progress   enable row level security;
alter table public.coupons           enable row level security;
alter table public.affiliates        enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.payments          enable row level security;
alter table public.downloads         enable row level security;
alter table public.reviews           enable row level security;
alter table public.payouts           enable row level security;
alter table public.notifications     enable row level security;
alter table public.wishlists         enable row level security;
alter table public.analytics_events  enable row level security;
alter table public.reports           enable row level security;
alter table public.platform_settings enable row level security;

-- ─── users ──────────────────────────────────────────────────────────
create policy "users: read self" on public.users for select using (id = auth.uid() or public.is_admin());
create policy "users: update self" on public.users for update using (id = auth.uid() or public.is_admin());

-- Minimal public profile for reviews (name + avatar only)
create or replace view public.public_profiles with (security_invoker = false) as
  select id, full_name, avatar_url from public.users where not is_banned;
grant select on public.public_profiles to anon, authenticated;

-- ─── creators ───────────────────────────────────────────────────────
create policy "creators: public read active" on public.creators for select
  using (status = 'active' or user_id = auth.uid() or public.is_admin());
create policy "creators: insert own" on public.creators for insert
  with check (user_id = auth.uid());
create policy "creators: update own" on public.creators for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "creators: admin delete" on public.creators for delete using (public.is_admin());

-- Creators cannot self-verify / unsuspend
create or replace function public.guard_creator_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := old.status;
    new.verified := old.verified;
  end if;
  return new;
end $$;
create trigger creators_guard before update on public.creators
  for each row execute function public.guard_creator_update();

-- ─── categories / settings (public read, admin write) ───────────────
create policy "categories: read" on public.categories for select using (true);
create policy "categories: admin write" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "settings: read" on public.platform_settings for select using (true);
create policy "settings: admin write" on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());

-- ─── products ───────────────────────────────────────────────────────
create policy "products: public read published" on public.products for select
  using (
    (status = 'published' and exists (select 1 from public.creators c where c.id = creator_id and c.status = 'active'))
    or creator_id = public.current_creator_id()
    or public.is_admin()
  );
create policy "products: creator insert" on public.products for insert
  with check (creator_id = public.current_creator_id());
create policy "products: creator update" on public.products for update
  using (creator_id = public.current_creator_id() or public.is_admin())
  with check (creator_id = public.current_creator_id() or public.is_admin());
create policy "products: creator delete" on public.products for delete
  using (creator_id = public.current_creator_id() or public.is_admin());

-- Files are NEVER readable by buyers directly — downloads are issued as
-- short-lived signed URLs by /api/downloads/[id] after an entitlement check.
create policy "product_files: owner all" on public.product_files for all
  using (exists (select 1 from public.products p where p.id = product_id and (p.creator_id = public.current_creator_id() or public.is_admin())))
  with check (exists (select 1 from public.products p where p.id = product_id and p.creator_id = public.current_creator_id()));

-- ─── courses ────────────────────────────────────────────────────────
create policy "modules: read" on public.course_modules for select
  using (exists (select 1 from public.products p where p.id = product_id
                 and (p.status = 'published' or p.creator_id = public.current_creator_id() or public.is_admin())));
create policy "modules: owner write" on public.course_modules for all
  using (exists (select 1 from public.products p where p.id = product_id and p.creator_id = public.current_creator_id()))
  with check (exists (select 1 from public.products p where p.id = product_id and p.creator_id = public.current_creator_id()));

create policy "lessons: read preview or purchased" on public.course_lessons for select
  using (exists (
    select 1 from public.course_modules m join public.products p on p.id = m.product_id
    where m.id = module_id
      and (course_lessons.is_preview
           or p.creator_id = public.current_creator_id()
           or public.is_admin()
           or public.has_purchased(p.id))
  ));
create policy "lessons: owner write" on public.course_lessons for all
  using (exists (select 1 from public.course_modules m join public.products p on p.id = m.product_id
                 where m.id = module_id and p.creator_id = public.current_creator_id()))
  with check (exists (select 1 from public.course_modules m join public.products p on p.id = m.product_id
                 where m.id = module_id and p.creator_id = public.current_creator_id()));

create policy "progress: own" on public.lesson_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── coupons (validated server-side; never publicly listable) ───────
create policy "coupons: owner all" on public.coupons for all
  using (creator_id = public.current_creator_id() or public.is_admin())
  with check (creator_id = public.current_creator_id());

-- ─── affiliates ─────────────────────────────────────────────────────
create policy "affiliates: read own" on public.affiliates for select
  using (user_id = auth.uid() or creator_id = public.current_creator_id() or public.is_admin());
create policy "affiliates: join program" on public.affiliates for insert
  with check (user_id = auth.uid());
create policy "affiliates: creator manage" on public.affiliates for update
  using (creator_id = public.current_creator_id() or public.is_admin());
create policy "affiliates: creator remove" on public.affiliates for delete
  using (creator_id = public.current_creator_id() or user_id = auth.uid() or public.is_admin());

-- ─── orders & items ─────────────────────────────────────────────────
-- Security-definer helpers break the orders ⇄ order_items policy cycle.
create or replace function public.order_has_my_items(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.order_items
                 where order_id = p_order_id and creator_id = public.current_creator_id())
$$;
create or replace function public.order_is_mine(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where id = p_order_id and customer_id = auth.uid())
$$;

create policy "orders: read own or sold" on public.orders for select
  using (customer_id = auth.uid() or public.is_admin() or public.order_has_my_items(id));
-- inserts/updates only via service role (no policy = denied)

create policy "order_items: read" on public.order_items for select
  using (creator_id = public.current_creator_id() or public.is_admin() or public.order_is_mine(order_id));
create policy "order_items: creator fulfil" on public.order_items for update
  using (creator_id = public.current_creator_id())
  with check (creator_id = public.current_creator_id());

-- Creators may only change fulfilment fields — never money columns.
create or replace function public.guard_order_item_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
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
create trigger order_items_guard before update on public.order_items
  for each row execute function public.guard_order_item_update();

-- Same idea for reviews: creators may only write creator_reply / moderate status on their products.
create or replace function public.guard_review_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and old.customer_id <> auth.uid() then
    new.rating := old.rating; new.title := old.title; new.body := old.body; new.customer_id := old.customer_id;
    if new.status not in ('published', 'flagged') then new.status := old.status; end if;
  end if;
  if auth.uid() = old.customer_id and not public.is_admin() then
    new.creator_reply := old.creator_reply; new.status := old.status;
  end if;
  return new;
end $$;
create trigger reviews_guard before update on public.reviews
  for each row execute function public.guard_review_update();

-- ─── payments ───────────────────────────────────────────────────────
create policy "payments: read own" on public.payments for select
  using (public.is_admin() or public.order_is_mine(order_id));

-- ─── downloads ──────────────────────────────────────────────────────
create policy "downloads: read own" on public.downloads for select
  using (customer_id = auth.uid() or public.is_admin());

-- ─── reviews ────────────────────────────────────────────────────────
create policy "reviews: public read" on public.reviews for select
  using (status = 'published' or customer_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.products p where p.id = product_id and p.creator_id = public.current_creator_id()));
create policy "reviews: buyers write" on public.reviews for insert
  with check (customer_id = auth.uid() and public.has_purchased(product_id));
create policy "reviews: edit own" on public.reviews for update
  using (customer_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.products p where p.id = product_id and p.creator_id = public.current_creator_id()));
create policy "reviews: delete own" on public.reviews for delete
  using (customer_id = auth.uid() or public.is_admin());

-- ─── payouts ────────────────────────────────────────────────────────
create policy "payouts: creator read" on public.payouts for select
  using (creator_id = public.current_creator_id() or public.is_admin());
create policy "payouts: admin update" on public.payouts for update using (public.is_admin());
-- creation goes through /api/payouts (balance check) using service role

-- ─── notifications / wishlist ───────────────────────────────────────
create policy "notifications: own" on public.notifications for select using (user_id = auth.uid());
create policy "notifications: mark read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: delete own" on public.notifications for delete using (user_id = auth.uid());

create policy "wishlist: own" on public.wishlists for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── analytics / reports ────────────────────────────────────────────
create policy "analytics: creator read" on public.analytics_events for select
  using (creator_id = public.current_creator_id() or public.is_admin());

create policy "reports: create" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports: admin" on public.reports for select using (public.is_admin() or reporter_id = auth.uid());
create policy "reports: admin update" on public.reports for update using (public.is_admin());
