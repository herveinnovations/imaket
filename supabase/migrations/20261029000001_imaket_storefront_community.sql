-- ============================================================================
-- iMaket storefront & community (matches the iMaket Wix site)
--   • Men / Women / unisex audience on products        (nav: Men, Women)
--   • Sitewide discount codes (e.g. TEES25, WELCOME10)  + creator opt-out
--   • Newsletter sign-ups ("Get 10% off your first order")
--   • Groups with posts and comments                    (nav: Groups)
--   • Member directory with follows                     (nav: Members)
-- Additive only: no existing column, policy or row is removed.
-- ============================================================================

-- ─── 1. Product audience ────────────────────────────────────────────────────
alter table public.imaket_products
  add column if not exists audience text check (audience in ('men', 'women', 'unisex'));
create index if not exists imaket_products_audience_idx
  on public.imaket_products (audience, published_at desc) where status = 'published';

-- ─── 1b. Reserve the new top-level paths as store links ────────────────────
create or replace function imaket_private.check_reserved_handle() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.handle = any (array[
    'admin','api','auth','cart','checkout','creator','dashboard','login','register','logout','marketplace','p',
    'settings','signup','store','support','help','about','terms','privacy','forgot-password','reset-password',
    'verify-email','sokoni','imaket','groups','members','policies','faq','shop','new','men','women']) then
    raise exception 'Handle "%" is reserved', new.handle using errcode = '23514';
  end if;
  return new;
end $$;

-- ─── 2. Member profiles ─────────────────────────────────────────────────────
alter table public.imaket_users
  add column if not exists public_profile boolean not null default true,
  add column if not exists bio text check (length(bio) <= 300);
grant update (public_profile, bio) on public.imaket_users to authenticated;

-- ─── 3. Sitewide discount codes ─────────────────────────────────────────────
alter table public.imaket_creators
  add column if not exists join_sitewide_sales boolean not null default true;

create table if not exists public.imaket_platform_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Za-z0-9_-]{3,40}$'),
  description text check (length(description) <= 200),
  type text not null default 'percent' check (type in ('percent', 'fixed')),
  value numeric(12,2) not null check (value > 0 and (type <> 'percent' or value <= 100)),
  first_order_only boolean not null default false,
  min_order numeric(12,2) not null default 0 check (min_order >= 0),
  max_uses integer check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists imaket_platform_coupons_code_key on public.imaket_platform_coupons (lower(code));
revoke all on public.imaket_platform_coupons from anon, authenticated;
alter table public.imaket_platform_coupons enable row level security;
create policy platform_coupons_admin on public.imaket_platform_coupons for all to authenticated
  using ((select imaket_private.is_admin())) with check ((select imaket_private.is_admin()));
grant select, insert, update, delete on public.imaket_platform_coupons to authenticated;
grant all on public.imaket_platform_coupons to service_role;

alter table public.imaket_orders
  add column if not exists platform_coupon_id uuid references public.imaket_platform_coupons(id) on delete set null;
create index if not exists imaket_orders_platform_coupon_idx on public.imaket_orders (platform_coupon_id);

-- ─── 4. Newsletter ──────────────────────────────────────────────────────────
create table if not exists public.imaket_newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  user_id uuid references public.imaket_users(id) on delete set null,
  consent boolean not null,
  source text check (length(source) <= 40),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
create unique index if not exists imaket_newsletter_email_key on public.imaket_newsletter_subscribers (lower(email));
create index if not exists imaket_newsletter_user_idx on public.imaket_newsletter_subscribers (user_id);
revoke all on public.imaket_newsletter_subscribers from anon, authenticated;
alter table public.imaket_newsletter_subscribers enable row level security;
-- written by the server (service role); admins can read
create policy newsletter_admin_read on public.imaket_newsletter_subscribers for select to authenticated
  using ((select imaket_private.is_admin()));
grant select on public.imaket_newsletter_subscribers to authenticated;
grant all on public.imaket_newsletter_subscribers to service_role;

-- ─── 5. Groups ──────────────────────────────────────────────────────────────
create table if not exists public.imaket_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  name text not null check (char_length(name) between 3 and 80),
  description text not null default '' check (length(description) <= 1000),
  cover_url text check (length(cover_url) <= 1000),
  privacy text not null default 'public' check (privacy in ('public', 'private')),
  created_by uuid references public.imaket_users(id) on delete set null,
  member_count integer not null default 0,
  post_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists imaket_groups_created_by_idx on public.imaket_groups (created_by);

create table if not exists public.imaket_group_members (
  group_id uuid not null references public.imaket_groups(id) on delete cascade,
  user_id uuid not null references public.imaket_users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'active' check (status in ('active', 'pending')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists imaket_group_members_user_idx on public.imaket_group_members (user_id);

create table if not exists public.imaket_group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.imaket_groups(id) on delete cascade,
  author_id uuid not null references public.imaket_users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists imaket_group_posts_group_idx on public.imaket_group_posts (group_id, created_at desc);
create index if not exists imaket_group_posts_author_idx on public.imaket_group_posts (author_id);

create table if not exists public.imaket_group_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.imaket_group_posts(id) on delete cascade,
  author_id uuid not null references public.imaket_users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists imaket_group_comments_post_idx on public.imaket_group_comments (post_id, created_at);
create index if not exists imaket_group_comments_author_idx on public.imaket_group_comments (author_id);

-- helpers (security definer so policies don't recurse)
create or replace function imaket_private.is_group_member(gid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.imaket_group_members m
    where m.group_id = gid and m.user_id = auth.uid() and m.status = 'active')
$$;
create or replace function imaket_private.is_group_admin(gid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.imaket_group_members m
    where m.group_id = gid and m.user_id = auth.uid() and m.status = 'active' and m.role = 'admin')
$$;
create or replace function imaket_private.can_read_group(gid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.imaket_groups g where g.id = gid and g.privacy = 'public')
      or imaket_private.is_group_member(gid) or imaket_private.is_admin()
$$;
create or replace function imaket_private.is_public_member(uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.imaket_users where id = uid and public_profile and not is_banned)
$$;
create or replace function imaket_private.is_active_user() returns boolean
  language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.imaket_users where id = auth.uid() and not is_banned)
$$;

-- triggers: creator becomes admin; join status follows privacy; counters
create or replace function imaket_private.group_after_insert() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.imaket_group_members (group_id, user_id, role, status)
    values (new.id, new.created_by, 'admin', 'active') on conflict do nothing;
  end if;
  return new;
end $$;

create or replace function imaket_private.guard_group_update() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('imaket.system_write', true) = 'on' then return new; end if;
  new.created_by := old.created_by;
  new.member_count := old.member_count;
  new.post_count := old.post_count;
  new.created_at := old.created_at;
  return new;
end $$;

create or replace function imaket_private.guard_group_member() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare v_privacy text;
begin
  if auth.uid() is null or imaket_private.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if imaket_private.is_group_admin(new.group_id) and new.user_id <> auth.uid() then
      return new;                                   -- group admin adding someone
    end if;
    select privacy into v_privacy from public.imaket_groups where id = new.group_id;
    new.role := case when exists (select 1 from public.imaket_groups where id = new.group_id and created_by = auth.uid())
                     then 'admin' else 'member' end;
    new.status := case when v_privacy = 'public' or new.role = 'admin' then 'active' else 'pending' end;
  else
    -- only group admins update membership; they can't demote themselves out of the last admin seat here
    new.user_id := old.user_id; new.group_id := old.group_id;
  end if;
  return new;
end $$;

create or replace function imaket_private.refresh_group_counts() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare v_gid uuid := coalesce(new.group_id, old.group_id);
begin
  perform set_config('imaket.system_write', 'on', true);
  update public.imaket_groups g set
    member_count = (select count(*) from public.imaket_group_members where group_id = v_gid and status = 'active'),
    post_count = (select count(*) from public.imaket_group_posts where group_id = v_gid)
  where g.id = v_gid;
  perform set_config('imaket.system_write', 'off', true);
  return null;
end $$;

create or replace function imaket_private.refresh_comment_count() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := coalesce(new.post_id, old.post_id);
begin
  perform set_config('imaket.system_write', 'on', true);
  update public.imaket_group_posts p
     set comment_count = (select count(*) from public.imaket_group_comments where post_id = v_pid)
   where p.id = v_pid;
  perform set_config('imaket.system_write', 'off', true);
  return null;
end $$;

create or replace function imaket_private.guard_group_post() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if current_setting('imaket.system_write', true) = 'on' or auth.uid() is null then return new; end if;
    new.group_id := old.group_id; new.author_id := old.author_id; new.created_at := old.created_at;
    new.comment_count := old.comment_count;
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger imaket_groups_after_insert after insert on public.imaket_groups
  for each row execute function imaket_private.group_after_insert();
create trigger imaket_groups_guard before update on public.imaket_groups
  for each row execute function imaket_private.guard_group_update();
create trigger imaket_group_members_guard before insert or update on public.imaket_group_members
  for each row execute function imaket_private.guard_group_member();
create trigger imaket_group_members_count after insert or update or delete on public.imaket_group_members
  for each row execute function imaket_private.refresh_group_counts();
create trigger imaket_group_posts_count after insert or delete on public.imaket_group_posts
  for each row execute function imaket_private.refresh_group_counts();
create trigger imaket_group_posts_guard before update on public.imaket_group_posts
  for each row execute function imaket_private.guard_group_post();
create trigger imaket_group_comments_count after insert or delete on public.imaket_group_comments
  for each row execute function imaket_private.refresh_comment_count();

revoke all on public.imaket_groups, public.imaket_group_members, public.imaket_group_posts, public.imaket_group_comments from anon, authenticated;
alter table public.imaket_groups enable row level security;
alter table public.imaket_group_members enable row level security;
alter table public.imaket_group_posts enable row level security;
alter table public.imaket_group_comments enable row level security;

create policy groups_read on public.imaket_groups for select to anon, authenticated using (true);
create policy groups_insert on public.imaket_groups for insert to authenticated
  with check (created_by = (select auth.uid()) and (select imaket_private.is_active_user()));
create policy groups_update on public.imaket_groups for update to authenticated
  using (imaket_private.is_group_admin(id) or (select imaket_private.is_admin()))
  with check (imaket_private.is_group_admin(id) or (select imaket_private.is_admin()));
create policy groups_delete on public.imaket_groups for delete to authenticated
  using (imaket_private.is_group_admin(id) or (select imaket_private.is_admin()));

create policy group_members_read on public.imaket_group_members for select to authenticated
  using (user_id = (select auth.uid()) or imaket_private.is_group_member(group_id) or (select imaket_private.is_admin()));
create policy group_members_join on public.imaket_group_members for insert to authenticated
  with check ((user_id = (select auth.uid()) and (select imaket_private.is_active_user()))
              or imaket_private.is_group_admin(group_id) or (select imaket_private.is_admin()));
create policy group_members_manage on public.imaket_group_members for update to authenticated
  using (imaket_private.is_group_admin(group_id) or (select imaket_private.is_admin()))
  with check (imaket_private.is_group_admin(group_id) or (select imaket_private.is_admin()));
create policy group_members_leave on public.imaket_group_members for delete to authenticated
  using (user_id = (select auth.uid()) or imaket_private.is_group_admin(group_id) or (select imaket_private.is_admin()));

create policy group_posts_read on public.imaket_group_posts for select to anon, authenticated
  using (imaket_private.can_read_group(group_id));
create policy group_posts_insert on public.imaket_group_posts for insert to authenticated
  with check (author_id = (select auth.uid()) and imaket_private.is_group_member(group_id) and (select imaket_private.is_active_user()));
create policy group_posts_update on public.imaket_group_posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy group_posts_delete on public.imaket_group_posts for delete to authenticated
  using (author_id = (select auth.uid()) or imaket_private.is_group_admin(group_id) or (select imaket_private.is_admin()));

create policy group_comments_read on public.imaket_group_comments for select to anon, authenticated
  using (exists (select 1 from public.imaket_group_posts p where p.id = post_id and imaket_private.can_read_group(p.group_id)));
create policy group_comments_insert on public.imaket_group_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (select imaket_private.is_active_user())
              and exists (select 1 from public.imaket_group_posts p where p.id = post_id and imaket_private.is_group_member(p.group_id)));
create policy group_comments_delete on public.imaket_group_comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select imaket_private.is_admin())
         or exists (select 1 from public.imaket_group_posts p where p.id = post_id and imaket_private.is_group_admin(p.group_id)));

grant select on public.imaket_groups, public.imaket_group_posts, public.imaket_group_comments to anon;
grant select, insert, delete on public.imaket_groups, public.imaket_group_members, public.imaket_group_posts, public.imaket_group_comments to authenticated;
grant update (name, description, cover_url, privacy) on public.imaket_groups to authenticated;
grant update (role, status) on public.imaket_group_members to authenticated;
grant update (body) on public.imaket_group_posts to authenticated;
grant all on public.imaket_groups, public.imaket_group_members, public.imaket_group_posts, public.imaket_group_comments to service_role;

-- ─── 6. Follows ─────────────────────────────────────────────────────────────
create table if not exists public.imaket_follows (
  follower_id uuid not null references public.imaket_users(id) on delete cascade,
  followee_id uuid not null references public.imaket_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists imaket_follows_followee_idx on public.imaket_follows (followee_id);
revoke all on public.imaket_follows from anon, authenticated;
alter table public.imaket_follows enable row level security;
create policy follows_read on public.imaket_follows for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
create policy follows_insert on public.imaket_follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and (select imaket_private.is_active_user())
              and imaket_private.is_public_member(followee_id));
create policy follows_delete on public.imaket_follows for delete to authenticated
  using (follower_id = (select auth.uid()));
grant select, insert, delete on public.imaket_follows to authenticated;
grant all on public.imaket_follows to service_role;

-- ─── 7. Directory & profile lookups (names/avatars only; never emails) ─────
create or replace function imaket_private.member_directory(p_search text default null, p_limit integer default 24, p_offset integer default 0)
returns table (id uuid, full_name text, avatar_url text, bio text, handle text, store_name text,
               followers bigint, following boolean, joined_at timestamptz, total bigint)
  language sql stable security definer set search_path = '' as $$
  with base as (
    select u.id, u.full_name, u.avatar_url, u.bio, c.handle, c.store_name, u.created_at
    from public.imaket_users u
    left join public.imaket_creators c on c.user_id = u.id and c.status = 'active'
    where auth.uid() is not null and u.public_profile and not u.is_banned
      and (p_search is null or p_search = '' or u.full_name ilike '%' || p_search || '%' or c.store_name ilike '%' || p_search || '%')
  )
  select b.id, b.full_name, b.avatar_url, b.bio, b.handle, b.store_name,
         (select count(*) from public.imaket_follows f where f.followee_id = b.id),
         exists (select 1 from public.imaket_follows f where f.followee_id = b.id and f.follower_id = auth.uid()),
         b.created_at, count(*) over ()
  from base b
  order by (b.handle is not null) desc, b.created_at desc
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
$$;

create or replace function imaket_private.group_people(p_group uuid)
returns table (user_id uuid, full_name text, avatar_url text, role text, status text, joined_at timestamptz)
  language sql stable security definer set search_path = '' as $$
  select m.user_id, u.full_name, u.avatar_url, m.role, m.status, m.created_at
  from public.imaket_group_members m join public.imaket_users u on u.id = m.user_id
  where m.group_id = p_group
    and (imaket_private.can_read_group(p_group))
    and (m.status = 'active' or imaket_private.is_group_admin(p_group) or imaket_private.is_admin())
  order by (m.role = 'admin') desc, m.created_at
  limit 200
$$;

create or replace function public.imaket_member_directory(p_search text default null, p_limit integer default 24, p_offset integer default 0)
returns table (id uuid, full_name text, avatar_url text, bio text, handle text, store_name text,
               followers bigint, following boolean, joined_at timestamptz, total bigint)
  language sql stable set search_path = '' as $$
  select * from imaket_private.member_directory(p_search, p_limit, p_offset)
$$;
create or replace function public.imaket_group_people(p_group uuid)
returns table (user_id uuid, full_name text, avatar_url text, role text, status text, joined_at timestamptz)
  language sql stable set search_path = '' as $$
  select * from imaket_private.group_people(p_group)
$$;

revoke all on function imaket_private.is_group_member(uuid), imaket_private.is_group_admin(uuid),
  imaket_private.can_read_group(uuid), imaket_private.is_active_user(), imaket_private.is_public_member(uuid),
  imaket_private.group_after_insert(), imaket_private.guard_group_update(), imaket_private.guard_group_member(),
  imaket_private.refresh_group_counts(), imaket_private.refresh_comment_count(), imaket_private.guard_group_post(),
  imaket_private.member_directory(text, integer, integer), imaket_private.group_people(uuid),
  public.imaket_member_directory(text, integer, integer), public.imaket_group_people(uuid)
  from public, anon, authenticated;
grant execute on function imaket_private.is_group_member(uuid), imaket_private.is_group_admin(uuid),
  imaket_private.can_read_group(uuid), imaket_private.is_active_user(), imaket_private.is_public_member(uuid) to anon, authenticated, service_role;
grant execute on function imaket_private.member_directory(text, integer, integer), public.imaket_member_directory(text, integer, integer)
  to authenticated, service_role;
grant execute on function imaket_private.group_people(uuid), public.imaket_group_people(uuid) to anon, authenticated, service_role;

-- ─── 8. finalize_order: also count sitewide code use ────────────────────────
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
  if v_order.platform_coupon_id is not null then
    update public.imaket_platform_coupons set used_count = used_count + 1 where id = v_order.platform_coupon_id;
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
revoke all on function imaket_private.finalize_order(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function imaket_private.finalize_order(uuid, text, text, jsonb) to service_role;

-- ─── 9. Seed: storefront content, codes and a starter group ────────────────
insert into public.imaket_platform_settings (key, value) values
  ('site_content', jsonb_build_object(
     'hero_title', 'The Latest in Streetwear Fashion',
     'hero_text', 'Clothing, prints and drops from independent creators, all in one marketplace.',
     'hero_cta', 'Shop Now',
     'sale_text', 'Sale is on! 25% off sitewide using TEES25 at checkout',
     'promo_title', '25% OFF',
     'promo_text', '25% off sitewide using TEES25 at checkout',
     'strip_text', 'Get 10% Off Your First Order',
     'newsletter_title', 'Get 10% Off Your First Order!',
     'newsletter_text', 'Sign up to our newsletter',
     'newsletter_code', 'WELCOME10',
     'hero_images', jsonb_build_array(),
     'promo_images', jsonb_build_array(),
     'address', 'Lusaka, Zambia', 'phone', '', 'email', '',
     'facebook', '', 'tiktok', '', 'instagram', ''))
on conflict (key) do nothing;

insert into public.imaket_platform_coupons (code, description, type, value, first_order_only) values
  ('TEES25', '25% off sitewide', 'percent', 25, false),
  ('WELCOME10', '10% off your first order (newsletter)', 'percent', 10, true)
on conflict do nothing;

insert into public.imaket_groups (slug, name, description, privacy, created_by)
values ('imaket-community', 'iMaket Community',
        'Say hello, share what you''re making and swap tips with other buyers and creators.', 'public', null)
on conflict (slug) do nothing;

-- realtime for live group feeds
alter publication supabase_realtime add table public.imaket_group_posts;
