-- IMAKET additive shared-project installation. Does not alter legacy public tables.
-- Authorization roles are assigned by trusted administrators, never signup metadata.
begin;
create extension if not exists pgcrypto;
create schema if not exists imaket_private;
revoke all on schema imaket_private from public;
grant usage on schema imaket_private to authenticated;
create table public.imaket_users (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 role text not null default 'customer' check(role in ('admin','creator','customer')),
 email_notifications boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.imaket_creators (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.imaket_users(id) on delete cascade,
 slug text not null unique check(slug ~ '^[a-z0-9-]{3,50}$'), display_name text not null,
 bio text not null default '', banner_url text, avatar_url text, social_links jsonb not null default '{}',
 status text not null default 'pending' check(status in ('pending','active','suspended')), created_at timestamptz not null default now()
);
create table public.imaket_categories(id uuid primary key default gen_random_uuid(),name text not null unique,slug text not null unique);
create table public.imaket_products (
 id uuid primary key default gen_random_uuid(),creator_id uuid not null references public.imaket_creators(id),category_id uuid references public.imaket_categories(id),
 slug text not null unique,title text not null check(length(title) between 1 and 150),description text not null default '',
 type text not null check(type in ('Digital product','Physical product','Course','Service','Event ticket')),
 format text not null default '', delivery text not null default '', refund text not null default '',
 price_cents bigint not null check(price_cents between 1 and 10000000),currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
 stock integer check(stock>=0), status text not null default 'draft' check(status in ('draft','pending','published','rejected','archived')),
 file_path text,cover_url text,featured boolean not null default false,created_at timestamptz not null default now()
);
create table public.imaket_orders (
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.imaket_users(id),
 status text not null default 'pending' check(status in ('pending','paid','failed','refunded','cancelled')),
 subtotal_cents bigint not null check(subtotal_cents>=0),total_cents bigint not null check(total_cents>=0),
 currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),idempotency_key text not null unique,
 shipping_address jsonb,created_at timestamptz not null default now(),paid_at timestamptz
);
create table public.imaket_order_items (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.imaket_orders(id) on delete cascade,
 product_id uuid not null references public.imaket_products(id),creator_id uuid not null references public.imaket_creators(id),
 title text not null,quantity integer not null check(quantity>0),unit_price_cents bigint not null check(unit_price_cents>=0),
 unique(order_id,product_id)
);
create table public.imaket_payments (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.imaket_orders(id),
 provider text not null check(provider in ('stripe','paypal','flutterwave','dusupay','mobile-money')),
 external_id text unique,status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),
 amount_cents bigint not null check(amount_cents>=0),currency text not null default 'USD',created_at timestamptz not null default now()
);
create table public.imaket_downloads(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.imaket_users(id),product_id uuid not null references public.imaket_products(id),order_id uuid not null references public.imaket_orders(id),created_at timestamptz not null default now());
create table public.imaket_reviews(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.imaket_users(id),product_id uuid not null references public.imaket_products(id),rating integer not null check(rating between 1 and 5),body text not null check(length(body)<=2000),approved boolean not null default false,created_at timestamptz not null default now(),unique(user_id,product_id));
create table public.imaket_coupons(id uuid primary key default gen_random_uuid(),creator_id uuid not null references public.imaket_creators(id),code text not null,percent_off integer not null check(percent_off between 1 and 100),max_uses integer check(max_uses>0),uses integer not null default 0 check(uses>=0),expires_at timestamptz,active boolean not null default true,unique(creator_id,code));
create table public.imaket_payouts(id uuid primary key default gen_random_uuid(),creator_id uuid not null references public.imaket_creators(id),amount_cents bigint not null check(amount_cents>0),currency text not null default 'USD',status text not null default 'pending' check(status in ('pending','processing','paid','failed')),external_id text unique,created_at timestamptz not null default now());
create table public.imaket_notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.imaket_users(id),title text not null,body text not null,read_at timestamptz,created_at timestamptz not null default now());
create table public.imaket_course_lessons(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.imaket_products(id) on delete cascade,title text not null,position integer not null check(position>=0),file_path text not null,unique(product_id,position));
create table public.imaket_affiliates(id uuid primary key default gen_random_uuid(),creator_id uuid not null references public.imaket_creators(id),user_id uuid not null references public.imaket_users(id),code text not null unique,commission_percent integer not null check(commission_percent between 0 and 100),active boolean not null default false);
create table public.imaket_payment_events(id text primary key,provider text not null,payment_id uuid references public.imaket_payments(id),processed_at timestamptz not null default now());
create table public.imaket_analytics_events(id bigint generated always as identity primary key,creator_id uuid not null references public.imaket_creators(id),product_id uuid references public.imaket_products(id),event text not null check(event in ('view','checkout','purchase')),created_at timestamptz not null default now());
-- Helper functions live outside exposed schemas. Their only authority is auth.uid().
create function imaket_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.imaket_users where id=auth.uid() and role='admin')$$;
create function imaket_private.owns_creator(cid uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.imaket_creators where id=cid and user_id=auth.uid())$$;
create function imaket_private.creator_can_sell(cid uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.imaket_creators c join public.imaket_users u on u.id=c.user_id where c.id=cid and c.user_id=auth.uid() and c.status='active' and u.role='creator')$$;
create function imaket_private.has_purchase(pid uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.imaket_order_items i join public.imaket_orders o on o.id=i.order_id where i.product_id=pid and o.customer_id=auth.uid() and o.status='paid')$$;
create function imaket_private.is_order_seller(oid uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.imaket_order_items i join public.imaket_creators c on c.id=i.creator_id where i.order_id=oid and c.user_id=auth.uid())$$;
revoke all on all functions in schema imaket_private from public;
grant execute on function imaket_private.is_admin(),imaket_private.owns_creator(uuid),imaket_private.creator_can_sell(uuid),imaket_private.has_purchase(uuid),imaket_private.is_order_seller(uuid) to authenticated;
-- Safe signup trigger: every account begins as a customer.
create function imaket_private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.imaket_users(id,display_name,role) values(new.id,left(coalesce(new.raw_user_meta_data->>'name',''),100),'customer'); return new; end$$;
revoke all on function imaket_private.handle_new_user() from public;
create trigger imaket_new_user after insert on auth.users for each row execute function imaket_private.handle_new_user();
-- RLS everywhere, explicit grants, no browser financial writes.
alter table public.imaket_users enable row level security;
alter table public.imaket_creators enable row level security;
alter table public.imaket_categories enable row level security;
alter table public.imaket_products enable row level security;
alter table public.imaket_orders enable row level security;
alter table public.imaket_order_items enable row level security;
alter table public.imaket_payments enable row level security;
alter table public.imaket_downloads enable row level security;
alter table public.imaket_reviews enable row level security;
alter table public.imaket_coupons enable row level security;
alter table public.imaket_payouts enable row level security;
alter table public.imaket_notifications enable row level security;
alter table public.imaket_course_lessons enable row level security;
alter table public.imaket_affiliates enable row level security;
alter table public.imaket_payment_events enable row level security;
alter table public.imaket_analytics_events enable row level security;
revoke all on public.imaket_users,public.imaket_creators,public.imaket_categories,public.imaket_products,public.imaket_orders,public.imaket_order_items,public.imaket_payments,public.imaket_downloads,public.imaket_reviews,public.imaket_coupons,public.imaket_payouts,public.imaket_notifications,public.imaket_course_lessons,public.imaket_affiliates,public.imaket_payment_events,public.imaket_analytics_events from anon,authenticated;
grant select on public.imaket_categories,public.imaket_creators,public.imaket_products,public.imaket_reviews to anon,authenticated;
grant select on public.imaket_users,public.imaket_orders,public.imaket_order_items,public.imaket_payments,public.imaket_downloads,public.imaket_coupons,public.imaket_payouts,public.imaket_notifications,public.imaket_course_lessons,public.imaket_affiliates,public.imaket_analytics_events to authenticated;
grant update(display_name,email_notifications) on public.imaket_users to authenticated;
grant update(display_name,slug,bio,banner_url,avatar_url,social_links) on public.imaket_creators to authenticated;
grant insert,update,delete on public.imaket_products,public.imaket_coupons,public.imaket_course_lessons to authenticated;
grant insert on public.imaket_reviews to authenticated;
grant update(read_at) on public.imaket_notifications to authenticated;
create policy users_own on public.imaket_users for select to authenticated using(id=(select auth.uid()) or (select imaket_private.is_admin()));
create policy users_edit on public.imaket_users for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy creators_public on public.imaket_creators for select to anon using(status='active');
create policy creators_visible on public.imaket_creators for select to authenticated using(status='active' or user_id=(select auth.uid()) or (select imaket_private.is_admin()));
create policy creators_edit on public.imaket_creators for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy categories_read on public.imaket_categories for select to anon,authenticated using(true);
create policy products_public on public.imaket_products for select to anon using(status='published');
create policy products_visible on public.imaket_products for select to authenticated using(status='published' or imaket_private.owns_creator(creator_id) or (select imaket_private.is_admin()));
create policy products_insert on public.imaket_products for insert to authenticated with check(imaket_private.creator_can_sell(creator_id) and status in ('draft','pending'));
create policy products_edit on public.imaket_products for update to authenticated using(imaket_private.creator_can_sell(creator_id) or (select imaket_private.is_admin())) with check((imaket_private.creator_can_sell(creator_id) and status in ('draft','pending','archived')) or (select imaket_private.is_admin()));
create policy products_delete on public.imaket_products for delete to authenticated using(imaket_private.creator_can_sell(creator_id) and status='draft');
create policy orders_visible on public.imaket_orders for select to authenticated using(customer_id=(select auth.uid()) or imaket_private.is_order_seller(id) or (select imaket_private.is_admin()));
create policy items_visible on public.imaket_order_items for select to authenticated using(imaket_private.owns_creator(creator_id) or exists(select 1 from public.imaket_orders o where o.id=order_id and o.customer_id=(select auth.uid())) or (select imaket_private.is_admin()));
create policy payments_visible on public.imaket_payments for select to authenticated using(exists(select 1 from public.imaket_orders o where o.id=order_id and o.customer_id=(select auth.uid())) or (select imaket_private.is_admin()));
create policy downloads_visible on public.imaket_downloads for select to authenticated using(user_id=(select auth.uid()) or (select imaket_private.is_admin()));
create policy reviews_public on public.imaket_reviews for select to anon using(approved);
create policy reviews_visible on public.imaket_reviews for select to authenticated using(approved or user_id=(select auth.uid()) or (select imaket_private.is_admin()));
create policy reviews_insert on public.imaket_reviews for insert to authenticated with check(user_id=(select auth.uid()) and imaket_private.has_purchase(product_id) and approved=false);
create policy coupons_owner on public.imaket_coupons for all to authenticated using(imaket_private.owns_creator(creator_id)) with check(imaket_private.creator_can_sell(creator_id));
create policy payouts_visible on public.imaket_payouts for select to authenticated using(imaket_private.owns_creator(creator_id) or (select imaket_private.is_admin()));
create policy notifications_visible on public.imaket_notifications for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_read on public.imaket_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy lessons_read on public.imaket_course_lessons for select to authenticated using(imaket_private.has_purchase(product_id) or exists(select 1 from public.imaket_products p where p.id=product_id and imaket_private.owns_creator(p.creator_id)));
create policy lessons_manage on public.imaket_course_lessons for all to authenticated using(exists(select 1 from public.imaket_products p where p.id=product_id and imaket_private.creator_can_sell(p.creator_id))) with check(exists(select 1 from public.imaket_products p where p.id=product_id and imaket_private.creator_can_sell(p.creator_id)));
create policy affiliates_visible on public.imaket_affiliates for select to authenticated using(user_id=(select auth.uid()) or imaket_private.owns_creator(creator_id) or (select imaket_private.is_admin()));
create policy analytics_visible on public.imaket_analytics_events for select to authenticated using(imaket_private.owns_creator(creator_id) or (select imaket_private.is_admin()));
-- Indexed ownership predicates and catalogue lookups.
create index imaket_products_creator_idx on public.imaket_products(creator_id);
create index imaket_products_category_idx on public.imaket_products(category_id);
create index imaket_products_public_idx on public.imaket_products(created_at desc) where status='published';
create index imaket_orders_customer_idx on public.imaket_orders(customer_id,created_at desc);
create index imaket_order_items_order_idx on public.imaket_order_items(order_id);
create index imaket_order_items_product_idx on public.imaket_order_items(product_id);
create index imaket_order_items_creator_idx on public.imaket_order_items(creator_id);
create index imaket_payments_order_idx on public.imaket_payments(order_id);
create index imaket_downloads_user_idx on public.imaket_downloads(user_id,created_at desc);
create index imaket_downloads_product_idx on public.imaket_downloads(product_id);
create index imaket_downloads_order_idx on public.imaket_downloads(order_id);
create index imaket_reviews_product_idx on public.imaket_reviews(product_id);
create index imaket_coupons_creator_idx on public.imaket_coupons(creator_id);
create index imaket_payouts_creator_idx on public.imaket_payouts(creator_id);
create index imaket_notifications_user_idx on public.imaket_notifications(user_id,created_at desc);
create index imaket_course_lessons_product_idx on public.imaket_course_lessons(product_id);
create index imaket_affiliates_creator_idx on public.imaket_affiliates(creator_id);
create index imaket_affiliates_user_idx on public.imaket_affiliates(user_id);
create index imaket_analytics_creator_idx on public.imaket_analytics_events(creator_id,created_at desc);
create index imaket_analytics_product_idx on public.imaket_analytics_events(product_id);
create index imaket_payment_events_payment_idx on public.imaket_payment_events(payment_id);
insert into public.imaket_categories(name,slug) values ('Business','business'),('Design','design'),('Marketing','marketing'),('Personal growth','personal-growth'),('Lifestyle','lifestyle'),('Community','community');
-- Private product files. Public covers need a separate restricted image bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('imaket-product-files','imaket-product-files',false,52428800,array['application/pdf','application/zip','application/x-zip-compressed','video/mp4','video/webm','image/png','image/jpeg']);
create policy product_files_insert on storage.objects for insert to authenticated with check(bucket_id='imaket-product-files' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.imaket_users where id=(select auth.uid()) and role='creator'));
create policy product_files_select on storage.objects for select to authenticated using(bucket_id='imaket-product-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy product_files_delete on storage.objects for delete to authenticated using(bucket_id='imaket-product-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Purchased customers receive 60-second signed URLs only through /api/downloads.
-- Enable only supported realtime tables; RLS still governs subscribers.
alter publication supabase_realtime add table public.imaket_orders,public.imaket_notifications;
grant select,insert,update,delete on public.imaket_users,public.imaket_creators,public.imaket_categories,public.imaket_products,public.imaket_orders,public.imaket_order_items,public.imaket_payments,public.imaket_downloads,public.imaket_reviews,public.imaket_coupons,public.imaket_payouts,public.imaket_notifications,public.imaket_course_lessons,public.imaket_affiliates,public.imaket_payment_events,public.imaket_analytics_events to service_role;


-- Optional creator onboarding. Apply after schema.sql.
-- Requests do not grant seller status; trusted admins approve them.
grant insert(user_id,slug,display_name,bio) on public.imaket_creators to authenticated;
create policy creator_request on public.imaket_creators for insert to authenticated with check(user_id=(select auth.uid()) and status='pending');
-- Transactional promotion; only a trusted backend service can execute this.
create function public.imaket_approve_creator(creator_uuid uuid) returns void language plpgsql security invoker set search_path='' as $$
declare target_user uuid;
begin
 select user_id into target_user from public.imaket_creators where id=creator_uuid for update;
 if target_user is null then raise exception 'creator not found'; end if;
 update public.imaket_creators set status='active' where id=creator_uuid;
 update public.imaket_users set role='creator' where id=target_user and role='customer';
end $$;
revoke all on function public.imaket_approve_creator(uuid) from public,anon,authenticated;
grant execute on function public.imaket_approve_creator(uuid) to service_role;
grant select,insert,update,delete on public.imaket_users,public.imaket_creators,public.imaket_categories,public.imaket_products,public.imaket_orders,public.imaket_order_items,public.imaket_payments,public.imaket_downloads,public.imaket_reviews,public.imaket_coupons,public.imaket_payouts,public.imaket_notifications,public.imaket_course_lessons,public.imaket_affiliates,public.imaket_payment_events,public.imaket_analytics_events to service_role;

commit;
