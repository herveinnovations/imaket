-- ════════════════════════════════════════════════════════════════════
-- iMaket: FRESH INSTALL (empty Supabase project)
-- Final state of: imaket base migrations + 20261021000001_sokoni_merge_into_imaket
-- Generated from the tested schema (40 DB checks + 46-step browser run).
-- For a project that already has the old imaket tables, use the merge
-- migration in supabase/migrations instead.
-- ════════════════════════════════════════════════════════════════════
--
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', true);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

--
-- Name: imaket_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA imaket_private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
--



--
-- Name: check_reserved_handle(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.check_reserved_handle() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.handle = any (array[
    'admin','api','auth','cart','checkout','creator','dashboard','login','register','logout','marketplace','p',
    'settings','signup','store','support','help','about','terms','privacy','forgot-password','reset-password',
    'verify-email','sokoni','imaket']) then
    raise exception 'Handle "%" is reserved', new.handle using errcode = '23514';
  end if;
  return new;
end $$;


--
-- Name: check_ticket(uuid, boolean); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.check_ticket(p_token uuid, p_confirm boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: creator_can_sell(uuid); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.creator_can_sell(cid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select auth.uid() is not null and exists (
    select 1 from public.imaket_creators c join public.imaket_users u on u.id = c.user_id
    where c.id = cid and c.user_id = auth.uid() and c.status = 'active'
      and u.role in ('creator','admin') and not u.is_banned)
$$;


--
-- Name: creator_daily_sales(uuid, integer); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.creator_daily_sales(p_creator_id uuid, p_days integer DEFAULT 30) RETURNS TABLE(day date, revenue numeric, orders bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select d::date, coalesce(sum(oi.creator_earnings), 0), count(distinct oi.order_id)
  from generate_series(current_date - (least(greatest(p_days, 1), 366) - 1), current_date, interval '1 day') d
  left join public.imaket_order_items oi
    on oi.creator_id = p_creator_id and oi.created_at::date = d::date
   and exists (select 1 from public.imaket_orders o where o.id = oi.order_id and o.status in ('paid','fulfilled'))
  where p_creator_id = imaket_private.current_creator_id() or imaket_private.is_admin()
     or (select auth.role()) = 'service_role'
  group by d order by d
$$;


--
-- Name: current_creator_id(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.current_creator_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select id from public.imaket_creators where user_id = auth.uid()
$$;


--
-- Name: imaket_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.imaket_order_number_seq
    START WITH 100001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: imaket_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'ZMW'::text NOT NULL,
    idempotency_key text DEFAULT (gen_random_uuid())::text NOT NULL,
    shipping_address jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    order_number text DEFAULT ('SK-'::text || nextval('public.imaket_order_number_seq'::regclass)) NOT NULL,
    customer_email text NOT NULL,
    customer_name text,
    customer_phone text,
    discount_total numeric(12,2) DEFAULT 0 NOT NULL,
    shipping_total numeric(12,2) DEFAULT 0 NOT NULL,
    coupon_id uuid,
    affiliate_id uuid,
    payment_provider text,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_orders_amounts_check CHECK (((subtotal >= (0)::numeric) AND (total >= (0)::numeric))),
    CONSTRAINT imaket_orders_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT imaket_orders_payment_provider_check CHECK ((payment_provider = ANY (ARRAY['stripe'::text, 'paypal'::text, 'flutterwave'::text, 'dusupay'::text, 'mobile_money'::text]))),
    CONSTRAINT imaket_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'fulfilled'::text, 'cancelled'::text, 'refunded'::text, 'failed'::text])))
);


--
-- Name: finalize_order(uuid, text, text, jsonb); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.finalize_order(p_order_id uuid, p_provider text, p_reference text, p_raw jsonb DEFAULT NULL::jsonb) RETURNS public.imaket_orders
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: guard_creator_update(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.guard_creator_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.uid() is not null and not imaket_private.is_admin() then
    new.status := old.status;
    new.verified := old.verified;
    new.user_id := old.user_id;
  end if;
  return new;
end $$;


--
-- Name: guard_order_item_update(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.guard_order_item_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: guard_product_status(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.guard_product_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: guard_review_update(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.guard_review_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: guard_user_update(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.guard_user_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
end $_$;


--
-- Name: handle_user_email_change(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.handle_user_email_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin update public.imaket_users set email = lower(new.email) where id = new.id; return new; end $$;


--
-- Name: has_purchase(uuid); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.has_purchase(pid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select auth.uid() is not null and exists (
    select 1 from public.imaket_order_items i join public.imaket_orders o on o.id = i.order_id
    where i.product_id = pid and o.status in ('paid','fulfilled')
      and (o.customer_id = auth.uid()
           or lower(o.customer_email) = (select lower(email) from public.imaket_users where id = auth.uid())))
$$;


--
-- Name: imaket_review_creator(uuid, text); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.imaket_review_creator(creator_uuid uuid, decision text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare target_user uuid;
begin
 if not imaket_private.is_admin() then raise exception 'not authorized'; end if;
 if decision not in ('active','suspended') then raise exception 'invalid decision'; end if;
 select user_id into target_user from public.imaket_creators where id=creator_uuid for update;
 if target_user is null then raise exception 'creator not found'; end if;
 update public.imaket_creators set status=decision where id=creator_uuid;
 if decision='active' then update public.imaket_users set role='creator' where id=target_user and role='customer';end if;
 insert into public.imaket_notifications(user_id,title,body) values(target_user,'Creator application update',case when decision='active' then 'Your storefront is approved. You can add products from your creator dashboard.' else 'Your application or storefront needs review. Contact the platform owner for guidance.' end);
end $$;


--
-- Name: increment_product_view(uuid); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.increment_product_view(p_product_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform set_config('imaket.system_write', 'on', true);
  update public.imaket_products set view_count = view_count + 1 where id = p_product_id and status = 'published';
  perform set_config('imaket.system_write', 'off', true);
end $$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select auth.uid() is not null and exists (
    select 1 from public.imaket_users where id = auth.uid() and role = 'admin' and not is_banned)
$$;


--
-- Name: is_order_seller(uuid); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.is_order_seller(oid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select auth.uid() is not null and exists (
    select 1 from public.imaket_order_items i join public.imaket_creators c on c.id = i.creator_id
    where i.order_id = oid and c.user_id = auth.uid())
$$;


--
-- Name: issue_tickets(uuid); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.issue_tickets(p_product uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: notify_product_moderation(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.notify_product_moderation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: order_is_mine(uuid); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.order_is_mine(oid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select auth.uid() is not null and exists (select 1 from public.imaket_orders where id = oid and customer_id = auth.uid())
$$;


--
-- Name: owns_creator(uuid); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.owns_creator(cid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select auth.uid() is not null and exists (select 1 from public.imaket_creators where id = cid and user_id = auth.uid())
$$;


--
-- Name: platform_daily_revenue(integer); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.platform_daily_revenue(p_days integer DEFAULT 30) RETURNS TABLE(day date, gmv numeric, fees numeric, orders bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select d::date, coalesce(sum(o.total), 0), coalesce(sum(f.fees), 0), count(o.id)
  from generate_series(current_date - (least(greatest(p_days, 1), 366) - 1), current_date, interval '1 day') d
  left join public.imaket_orders o on o.paid_at::date = d::date and o.status in ('paid','fulfilled')
  left join lateral (select sum(platform_fee) fees from public.imaket_order_items where order_id = o.id) f on true
  where imaket_private.is_admin() or (select auth.role()) = 'service_role'
  group by d order by d
$$;


--
-- Name: public_profiles(uuid[]); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.public_profiles(p_ids uuid[]) RETURNS TABLE(id uuid, full_name text, avatar_url text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select id, full_name, avatar_url from public.imaket_users where id = any (p_ids) and not is_banned limit 200
$$;


--
-- Name: refresh_product_rating(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.refresh_product_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: request_booking(uuid, timestamp with time zone, text); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.request_booking(p_product uuid, p_start timestamp with time zone, p_note text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare s public.imaket_services; new_id uuid;
begin
 if auth.uid() is null then raise exception 'sign in required';end if;
 select * into s from public.imaket_services where product_id=p_product;
 if s.product_id is null or not s.accepting_requests or length(p_note)>2000 or not exists(select 1 from public.imaket_products p join public.imaket_creators c on c.id=p.creator_id where p.id=p_product and p.status='published' and c.status='active') then raise exception 'service is unavailable';end if;
 if p_start < now()+make_interval(hours=>s.minimum_notice_hours) or p_start>now()+interval '365 days' then raise exception 'choose a future time within one year and allow the required notice';end if;
 if (select count(*) from public.imaket_bookings where customer_id=auth.uid() and status='pending')>=10 then raise exception 'you already have 10 pending requests';end if;
 insert into public.imaket_bookings(product_id,creator_id,customer_id,starts_at,ends_at,note) values(p_product,s.creator_id,auth.uid(),p_start,p_start+make_interval(mins=>s.duration_minutes),coalesce(p_note,'')) returning id into new_id;
 insert into public.imaket_notifications(user_id,title,body) select user_id,'New booking request','Review a proposed service session in Bookings.' from public.imaket_creators where id=s.creator_id;
 return new_id;
end $$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ begin new.updated_at = now(); return new; end $$;


--
-- Name: tags_to_text(text[]); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.tags_to_text(text[]) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $_$ select coalesce(array_to_string($1, ' '), '') $_$;


--
-- Name: update_booking(uuid, text, text); Type: FUNCTION; Schema: imaket_private; Owner: -
--

CREATE FUNCTION imaket_private.update_booking(p_booking uuid, p_status text, p_note text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare b public.imaket_bookings;
begin
 select * into b from public.imaket_bookings where id=p_booking for update;
 if b.id is null or length(p_note)>2000 then raise exception 'booking not found';end if;
 if imaket_private.owns_creator(b.creator_id) then
   if not imaket_private.creator_can_sell(b.creator_id) then raise exception 'creator is not active';end if;
   perform 1 from public.imaket_creators where id=b.creator_id for update;
   if p_status not in ('accepted','declined','cancelled','completed') then raise exception 'invalid status';end if;
   if p_status='accepted' then
    if b.status<>'pending' or b.starts_at<now() then raise exception 'this request cannot be accepted';end if;
    if exists(select 1 from public.imaket_bookings x where x.creator_id=b.creator_id and x.id<>b.id and x.status='accepted' and x.starts_at<b.ends_at and x.ends_at>b.starts_at) then raise exception 'another accepted booking overlaps this time';end if;
   elsif p_status='completed' then if b.status<>'accepted' or b.ends_at>now() then raise exception 'only past accepted sessions can be completed';end if;
   elsif b.status not in ('pending','accepted') then raise exception 'this booking is closed';end if;
   update public.imaket_bookings set status=p_status,creator_note=coalesce(p_note,'') where id=b.id;
 elsif b.customer_id=auth.uid() and p_status='cancelled' and b.status in ('pending','accepted') then
   update public.imaket_bookings set status='cancelled' where id=b.id;
 else raise exception 'not authorized';end if;
 insert into public.imaket_notifications(user_id,title,body) values(b.customer_id,'Booking update','Booking status: '||p_status||'. Open Bookings for details.');
end $$;


--
-- Name: imaket_approve_creator(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_approve_creator(creator_uuid uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare target_user uuid;
begin
 select user_id into target_user from public.imaket_creators where id=creator_uuid for update;
 if target_user is null then raise exception 'creator not found'; end if;
 update public.imaket_creators set status='active' where id=creator_uuid;
 update public.imaket_users set role='creator' where id=target_user and role='customer';
end $$;


--
-- Name: imaket_check_ticket(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_check_ticket(p_token uuid, p_confirm boolean) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$select imaket_private.check_ticket(p_token,p_confirm)$$;


--
-- Name: imaket_creator_daily_sales(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_creator_daily_sales(p_creator_id uuid, p_days integer DEFAULT 30) RETURNS TABLE(day date, revenue numeric, orders bigint)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select * from imaket_private.creator_daily_sales(p_creator_id, p_days)
$$;


--
-- Name: imaket_finalize_order(uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_finalize_order(p_order_id uuid, p_provider text, p_reference text, p_raw jsonb DEFAULT NULL::jsonb) RETURNS public.imaket_orders
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  select * from imaket_private.finalize_order(p_order_id, p_provider, p_reference, p_raw)
$$;


--
-- Name: imaket_increment_product_view(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_increment_product_view(p_product_id uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$ select imaket_private.increment_product_view(p_product_id) $$;


--
-- Name: imaket_issue_tickets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_issue_tickets(p_product uuid) RETURNS integer
    LANGUAGE sql
    SET search_path TO ''
    AS $$select imaket_private.issue_tickets(p_product)$$;


--
-- Name: imaket_platform_daily_revenue(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_platform_daily_revenue(p_days integer DEFAULT 30) RETURNS TABLE(day date, gmv numeric, fees numeric, orders bigint)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select * from imaket_private.platform_daily_revenue(p_days)
$$;


--
-- Name: imaket_public_profiles(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_public_profiles(p_ids uuid[]) RETURNS TABLE(id uuid, full_name text, avatar_url text)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select * from imaket_private.public_profiles(p_ids)
$$;


--
-- Name: imaket_request_booking(uuid, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_request_booking(p_product uuid, p_start timestamp with time zone, p_note text) RETURNS uuid
    LANGUAGE sql
    SET search_path TO ''
    AS $$select imaket_private.request_booking(p_product,p_start,p_note)$$;


--
-- Name: imaket_review_creator(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_review_creator(creator_uuid uuid, decision text) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$select imaket_private.imaket_review_creator(creator_uuid,decision)$$;


--
-- Name: imaket_update_booking(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.imaket_update_booking(p_booking uuid, p_status text, p_note text) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$select imaket_private.update_booking(p_booking,p_status,p_note)$$;


--
-- Name: imaket_affiliates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_affiliates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    user_id uuid NOT NULL,
    code text NOT NULL,
    commission_percent numeric(5,2) DEFAULT 10 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    conversions integer DEFAULT 0 NOT NULL,
    earnings numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_affiliates_commission_check CHECK (((commission_percent >= (0)::numeric) AND (commission_percent <= (90)::numeric))),
    CONSTRAINT imaket_affiliates_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text])))
);


--
-- Name: imaket_analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_analytics_events (
    id bigint NOT NULL,
    creator_id uuid NOT NULL,
    product_id uuid,
    event text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id text,
    referrer text,
    country text,
    value numeric(12,2),
    CONSTRAINT imaket_analytics_events_event_check CHECK ((event = ANY (ARRAY['store_view'::text, 'product_view'::text, 'add_to_cart'::text, 'checkout_start'::text, 'purchase'::text, 'affiliate_click'::text])))
);


--
-- Name: imaket_analytics_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.imaket_analytics_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.imaket_analytics_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: imaket_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    creator_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    creator_note text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_bookings_check CHECK ((ends_at > starts_at)),
    CONSTRAINT imaket_bookings_creator_note_check CHECK ((length(creator_note) <= 2000)),
    CONSTRAINT imaket_bookings_note_check CHECK ((length(note) <= 2000)),
    CONSTRAINT imaket_bookings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text, 'completed'::text])))
);


--
-- Name: imaket_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    icon text,
    parent_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: imaket_coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    code text NOT NULL,
    value numeric(12,2) NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    ends_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    type text DEFAULT 'percent'::text NOT NULL,
    min_order numeric(12,2) DEFAULT 0 NOT NULL,
    product_ids uuid[],
    starts_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_coupons_max_uses_check CHECK ((max_uses > 0)),
    CONSTRAINT imaket_coupons_type_check CHECK ((type = ANY (ARRAY['percent'::text, 'fixed'::text]))),
    CONSTRAINT imaket_coupons_uses_check CHECK ((used_count >= 0)),
    CONSTRAINT imaket_coupons_value_check CHECK (((value > (0)::numeric) AND ((type <> 'percent'::text) OR (value <= (100)::numeric))))
);


--
-- Name: imaket_course_lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_course_lessons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    title text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    video_path text,
    summary text DEFAULT ''::text NOT NULL,
    module_id uuid,
    content text,
    duration_seconds integer,
    is_preview boolean DEFAULT false NOT NULL,
    CONSTRAINT imaket_course_lessons_position_check CHECK ((sort_order >= 0)),
    CONSTRAINT imaket_course_lessons_summary_check CHECK ((length(summary) <= 5000))
);


--
-- Name: imaket_course_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_course_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    title text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: imaket_creators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_creators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    handle text NOT NULL,
    store_name text NOT NULL,
    bio text,
    banner_url text,
    avatar_url text,
    socials jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tagline text,
    brand_color text DEFAULT '#0B7A56'::text,
    country text DEFAULT 'ZM'::text,
    currency text DEFAULT 'ZMW'::text NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    featured_product_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    payout_method jsonb,
    custom_domain text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_creators_handle_check CHECK ((handle ~ '^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$'::text)),
    CONSTRAINT imaket_creators_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text])))
);


--
-- Name: imaket_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    creator_id uuid NOT NULL,
    title text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    product_type text NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    line_total numeric(12,2) NOT NULL,
    platform_fee numeric(12,2) DEFAULT 0 NOT NULL,
    affiliate_fee numeric(12,2) DEFAULT 0 NOT NULL,
    creator_earnings numeric(12,2) DEFAULT 0 NOT NULL,
    fulfillment_status text DEFAULT 'unfulfilled'::text NOT NULL,
    tracking_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_order_items_fulfillment_status_check CHECK ((fulfillment_status = ANY (ARRAY['unfulfilled'::text, 'delivered'::text, 'shipped'::text, 'completed'::text]))),
    CONSTRAINT imaket_order_items_product_type_check CHECK ((product_type = ANY (ARRAY['digital'::text, 'course'::text, 'service'::text, 'ticket'::text, 'physical'::text, 'membership'::text]))),
    CONSTRAINT imaket_order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT imaket_order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: imaket_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'ZMW'::text NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    reference text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    method text NOT NULL,
    destination jsonb NOT NULL,
    note text,
    processed_by uuid,
    processed_at timestamp with time zone,
    CONSTRAINT imaket_payouts_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT imaket_payouts_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'processing'::text, 'paid'::text, 'rejected'::text])))
);


--
-- Name: imaket_platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_platform_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: imaket_creator_balances; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.imaket_creator_balances WITH (security_invoker='true') AS
 WITH hold AS (
         SELECT make_interval(days => COALESCE(( SELECT ((imaket_platform_settings.value #>> '{}'::text[]))::integer AS int4
                   FROM public.imaket_platform_settings
                  WHERE (imaket_platform_settings.key = 'payout_hold_days'::text)), 7)) AS h
        )
 SELECT c.id AS creator_id,
    c.currency,
    COALESCE(sum(oi.creator_earnings) FILTER (WHERE (o.status = ANY (ARRAY['paid'::text, 'fulfilled'::text]))), (0)::numeric) AS lifetime_earnings,
    (COALESCE(sum(oi.creator_earnings) FILTER (WHERE ((o.status = ANY (ARRAY['paid'::text, 'fulfilled'::text])) AND (o.paid_at < (now() - ( SELECT hold.h
           FROM hold))))), (0)::numeric) - COALESCE(( SELECT sum(p.amount) AS sum
           FROM public.imaket_payouts p
          WHERE ((p.creator_id = c.id) AND (p.status <> 'rejected'::text))), (0)::numeric)) AS available,
    COALESCE(sum(oi.creator_earnings) FILTER (WHERE ((o.status = ANY (ARRAY['paid'::text, 'fulfilled'::text])) AND (o.paid_at >= (now() - ( SELECT hold.h
           FROM hold))))), (0)::numeric) AS pending,
    COALESCE(( SELECT sum(p.amount) AS sum
           FROM public.imaket_payouts p
          WHERE ((p.creator_id = c.id) AND (p.status = 'paid'::text))), (0)::numeric) AS paid_out
   FROM ((public.imaket_creators c
     LEFT JOIN public.imaket_order_items oi ON ((oi.creator_id = c.id)))
     LEFT JOIN public.imaket_orders o ON ((o.id = oi.order_id)))
  WHERE ((c.id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin) OR (( SELECT auth.role() AS role) = 'service_role'::text))
  GROUP BY c.id, c.currency;


--
-- Name: imaket_downloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    product_id uuid NOT NULL,
    order_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    order_item_id uuid,
    customer_email text NOT NULL,
    access_token text DEFAULT (replace((gen_random_uuid())::text, '-'::text, ''::text) || replace((gen_random_uuid())::text, '-'::text, ''::text)) NOT NULL,
    download_count integer DEFAULT 0 NOT NULL,
    max_downloads integer,
    expires_at timestamp with time zone,
    last_downloaded_at timestamp with time zone
);


--
-- Name: imaket_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_events (
    product_id uuid NOT NULL,
    creator_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    venue text NOT NULL,
    instructions text DEFAULT ''::text NOT NULL,
    cancelled boolean DEFAULT false NOT NULL,
    CONSTRAINT imaket_events_check CHECK ((ends_at > starts_at)),
    CONSTRAINT imaket_events_instructions_check CHECK ((length(instructions) <= 3000)),
    CONSTRAINT imaket_events_venue_check CHECK (((length(venue) >= 1) AND (length(venue) <= 400)))
);


--
-- Name: imaket_lesson_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_lesson_progress (
    user_id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    position_seconds integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_lesson_progress_position_seconds_check CHECK (((position_seconds >= 0) AND (position_seconds <= 86400)))
);


--
-- Name: imaket_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    body text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    link text
);


--
-- Name: imaket_payment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_payment_events (
    id text NOT NULL,
    provider text NOT NULL,
    payment_id uuid,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: imaket_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    provider text NOT NULL,
    provider_reference text,
    status text DEFAULT 'initiated'::text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'ZMW'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    checkout_url text,
    method text,
    failure_reason text,
    raw jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_payments_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT imaket_payments_provider_check CHECK ((provider = ANY (ARRAY['stripe'::text, 'paypal'::text, 'flutterwave'::text, 'dusupay'::text, 'mobile_money'::text]))),
    CONSTRAINT imaket_payments_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'pending'::text, 'succeeded'::text, 'failed'::text, 'refunded'::text])))
);


--
-- Name: imaket_product_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_product_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    size_bytes bigint,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: imaket_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    category_id uuid,
    slug text NOT NULL,
    title text NOT NULL,
    description text,
    type text DEFAULT 'digital'::text NOT NULL,
    format text DEFAULT ''::text NOT NULL,
    delivery text DEFAULT ''::text NOT NULL,
    refund text DEFAULT ''::text NOT NULL,
    price numeric(12,2) NOT NULL,
    currency text DEFAULT 'ZMW'::text NOT NULL,
    inventory_qty integer,
    status text DEFAULT 'draft'::text NOT NULL,
    file_path text,
    cover_url text,
    featured boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    summary text,
    compare_at_price numeric(12,2),
    pay_what_you_want boolean DEFAULT false NOT NULL,
    min_price numeric(12,2),
    gallery text[] DEFAULT '{}'::text[] NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    track_inventory boolean DEFAULT false NOT NULL,
    sku text,
    requires_shipping boolean DEFAULT false NOT NULL,
    shipping_fee numeric(12,2) DEFAULT 0 NOT NULL,
    weight_grams integer,
    event_starts_at timestamp with time zone,
    event_ends_at timestamp with time zone,
    event_venue text,
    event_online_url text,
    service_duration_minutes integer,
    booking_url text,
    download_limit integer DEFAULT 5,
    access_days integer,
    affiliate_enabled boolean DEFAULT false NOT NULL,
    affiliate_commission_percent numeric(5,2) DEFAULT 10,
    rating_avg numeric(3,2) DEFAULT 0 NOT NULL,
    rating_count integer DEFAULT 0 NOT NULL,
    sales_count integer DEFAULT 0 NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    published_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search tsvector GENERATED ALWAYS AS ((((setweight(to_tsvector('simple'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('simple'::regconfig, COALESCE(summary, ''::text)), 'B'::"char")) || setweight(to_tsvector('simple'::regconfig, imaket_private.tags_to_text(tags)), 'B'::"char")) || setweight(to_tsvector('simple'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED,
    CONSTRAINT imaket_products_affiliate_commission_percent_check CHECK (((affiliate_commission_percent >= (0)::numeric) AND (affiliate_commission_percent <= (90)::numeric))),
    CONSTRAINT imaket_products_compare_at_price_check CHECK (((compare_at_price IS NULL) OR (compare_at_price >= (0)::numeric))),
    CONSTRAINT imaket_products_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT imaket_products_price_check CHECK (((price >= (0)::numeric) AND (price <= (100000000)::numeric))),
    CONSTRAINT imaket_products_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'published'::text, 'rejected'::text, 'archived'::text]))),
    CONSTRAINT imaket_products_stock_check CHECK ((inventory_qty >= 0)),
    CONSTRAINT imaket_products_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 140))),
    CONSTRAINT imaket_products_type_check CHECK ((type = ANY (ARRAY['digital'::text, 'course'::text, 'service'::text, 'ticket'::text, 'physical'::text, 'membership'::text])))
);


--
-- Name: imaket_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    listing text NOT NULL,
    reason text NOT NULL,
    details text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_reports_details_check CHECK (((length(details) >= 1) AND (length(details) <= 3000))),
    CONSTRAINT imaket_reports_listing_check CHECK (((length(listing) >= 1) AND (length(listing) <= 1000))),
    CONSTRAINT imaket_reports_reason_check CHECK (((length(reason) >= 1) AND (length(reason) <= 100))),
    CONSTRAINT imaket_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])))
);


--
-- Name: imaket_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    product_id uuid NOT NULL,
    rating integer NOT NULL,
    body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text,
    status text DEFAULT 'published'::text NOT NULL,
    creator_reply text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_reviews_body_check CHECK ((length(body) <= 2000)),
    CONSTRAINT imaket_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT imaket_reviews_status_check CHECK ((status = ANY (ARRAY['published'::text, 'hidden'::text, 'flagged'::text])))
);


--
-- Name: imaket_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_services (
    product_id uuid NOT NULL,
    creator_id uuid NOT NULL,
    duration_minutes integer NOT NULL,
    booking_instructions text DEFAULT ''::text NOT NULL,
    minimum_notice_hours integer DEFAULT 24 NOT NULL,
    accepting_requests boolean DEFAULT true NOT NULL,
    CONSTRAINT imaket_services_booking_instructions_check CHECK ((length(booking_instructions) <= 3000)),
    CONSTRAINT imaket_services_duration_minutes_check CHECK (((duration_minutes >= 15) AND (duration_minutes <= 480))),
    CONSTRAINT imaket_services_minimum_notice_hours_check CHECK (((minimum_notice_hours >= 0) AND (minimum_notice_hours <= 720)))
);


--
-- Name: imaket_shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_shipments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    creator_id uuid NOT NULL,
    carrier text NOT NULL,
    tracking_number text NOT NULL,
    tracking_url text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_shipments_carrier_check CHECK (((length(carrier) >= 1) AND (length(carrier) <= 100))),
    CONSTRAINT imaket_shipments_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'shipped'::text, 'delivered'::text]))),
    CONSTRAINT imaket_shipments_tracking_number_check CHECK (((length(tracking_number) >= 1) AND (length(tracking_number) <= 200))),
    CONSTRAINT imaket_shipments_tracking_url_check CHECK ((length(tracking_url) <= 2000))
);


--
-- Name: imaket_shipping_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_shipping_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    country_code text NOT NULL,
    currency text NOT NULL,
    amount_cents bigint NOT NULL,
    delivery_estimate text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT imaket_shipping_rates_amount_cents_check CHECK (((amount_cents >= 0) AND (amount_cents <= 10000000))),
    CONSTRAINT imaket_shipping_rates_country_code_check CHECK ((country_code ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT imaket_shipping_rates_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT imaket_shipping_rates_delivery_estimate_check CHECK ((length(delivery_estimate) <= 200))
);


--
-- Name: imaket_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_item_id uuid NOT NULL,
    product_id uuid NOT NULL,
    creator_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    sequence integer NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    checked_in_at timestamp with time zone,
    checked_in_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_tickets_sequence_check CHECK ((sequence > 0))
);


--
-- Name: imaket_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_users (
    id uuid NOT NULL,
    full_name text,
    role text DEFAULT 'customer'::text NOT NULL,
    email_notifications boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text NOT NULL,
    avatar_url text,
    phone text,
    country text DEFAULT 'ZM'::text,
    is_banned boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imaket_users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'creator'::text, 'customer'::text])))
);


--
-- Name: imaket_wishlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaket_wishlists (
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: imaket_affiliates imaket_affiliates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_affiliates
    ADD CONSTRAINT imaket_affiliates_code_key UNIQUE (code);


--
-- Name: imaket_affiliates imaket_affiliates_creator_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_affiliates
    ADD CONSTRAINT imaket_affiliates_creator_user_key UNIQUE (creator_id, user_id);


--
-- Name: imaket_affiliates imaket_affiliates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_affiliates
    ADD CONSTRAINT imaket_affiliates_pkey PRIMARY KEY (id);


--
-- Name: imaket_analytics_events imaket_analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_analytics_events
    ADD CONSTRAINT imaket_analytics_events_pkey PRIMARY KEY (id);


--
-- Name: imaket_bookings imaket_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_bookings
    ADD CONSTRAINT imaket_bookings_pkey PRIMARY KEY (id);


--
-- Name: imaket_categories imaket_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_categories
    ADD CONSTRAINT imaket_categories_name_key UNIQUE (name);


--
-- Name: imaket_categories imaket_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_categories
    ADD CONSTRAINT imaket_categories_pkey PRIMARY KEY (id);


--
-- Name: imaket_categories imaket_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_categories
    ADD CONSTRAINT imaket_categories_slug_key UNIQUE (slug);


--
-- Name: imaket_coupons imaket_coupons_creator_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_coupons
    ADD CONSTRAINT imaket_coupons_creator_id_code_key UNIQUE (creator_id, code);


--
-- Name: imaket_coupons imaket_coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_coupons
    ADD CONSTRAINT imaket_coupons_pkey PRIMARY KEY (id);


--
-- Name: imaket_course_lessons imaket_course_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_course_lessons
    ADD CONSTRAINT imaket_course_lessons_pkey PRIMARY KEY (id);


--
-- Name: imaket_course_modules imaket_course_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_course_modules
    ADD CONSTRAINT imaket_course_modules_pkey PRIMARY KEY (id);


--
-- Name: imaket_creators imaket_creators_custom_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_creators
    ADD CONSTRAINT imaket_creators_custom_domain_key UNIQUE (custom_domain);


--
-- Name: imaket_creators imaket_creators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_creators
    ADD CONSTRAINT imaket_creators_pkey PRIMARY KEY (id);


--
-- Name: imaket_creators imaket_creators_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_creators
    ADD CONSTRAINT imaket_creators_slug_key UNIQUE (handle);


--
-- Name: imaket_creators imaket_creators_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_creators
    ADD CONSTRAINT imaket_creators_user_id_key UNIQUE (user_id);


--
-- Name: imaket_downloads imaket_downloads_access_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_downloads
    ADD CONSTRAINT imaket_downloads_access_token_key UNIQUE (access_token);


--
-- Name: imaket_downloads imaket_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_downloads
    ADD CONSTRAINT imaket_downloads_pkey PRIMARY KEY (id);


--
-- Name: imaket_events imaket_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_events
    ADD CONSTRAINT imaket_events_pkey PRIMARY KEY (product_id);


--
-- Name: imaket_lesson_progress imaket_lesson_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_lesson_progress
    ADD CONSTRAINT imaket_lesson_progress_pkey PRIMARY KEY (user_id, lesson_id);


--
-- Name: imaket_notifications imaket_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_notifications
    ADD CONSTRAINT imaket_notifications_pkey PRIMARY KEY (id);


--
-- Name: imaket_order_items imaket_order_items_order_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_order_items
    ADD CONSTRAINT imaket_order_items_order_id_product_id_key UNIQUE (order_id, product_id);


--
-- Name: imaket_order_items imaket_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_order_items
    ADD CONSTRAINT imaket_order_items_pkey PRIMARY KEY (id);


--
-- Name: imaket_orders imaket_orders_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_orders
    ADD CONSTRAINT imaket_orders_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: imaket_orders imaket_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_orders
    ADD CONSTRAINT imaket_orders_order_number_key UNIQUE (order_number);


--
-- Name: imaket_orders imaket_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_orders
    ADD CONSTRAINT imaket_orders_pkey PRIMARY KEY (id);


--
-- Name: imaket_payment_events imaket_payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_payment_events
    ADD CONSTRAINT imaket_payment_events_pkey PRIMARY KEY (id);


--
-- Name: imaket_payments imaket_payments_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_payments
    ADD CONSTRAINT imaket_payments_external_id_key UNIQUE (provider_reference);


--
-- Name: imaket_payments imaket_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_payments
    ADD CONSTRAINT imaket_payments_pkey PRIMARY KEY (id);


--
-- Name: imaket_payouts imaket_payouts_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_payouts
    ADD CONSTRAINT imaket_payouts_external_id_key UNIQUE (reference);


--
-- Name: imaket_payouts imaket_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_payouts
    ADD CONSTRAINT imaket_payouts_pkey PRIMARY KEY (id);


--
-- Name: imaket_platform_settings imaket_platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_platform_settings
    ADD CONSTRAINT imaket_platform_settings_pkey PRIMARY KEY (key);


--
-- Name: imaket_product_files imaket_product_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_product_files
    ADD CONSTRAINT imaket_product_files_pkey PRIMARY KEY (id);


--
-- Name: imaket_products imaket_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_products
    ADD CONSTRAINT imaket_products_pkey PRIMARY KEY (id);


--
-- Name: imaket_products imaket_products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_products
    ADD CONSTRAINT imaket_products_slug_key UNIQUE (slug);


--
-- Name: imaket_reports imaket_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_reports
    ADD CONSTRAINT imaket_reports_pkey PRIMARY KEY (id);


--
-- Name: imaket_reviews imaket_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_reviews
    ADD CONSTRAINT imaket_reviews_pkey PRIMARY KEY (id);


--
-- Name: imaket_reviews imaket_reviews_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_reviews
    ADD CONSTRAINT imaket_reviews_user_id_product_id_key UNIQUE (customer_id, product_id);


--
-- Name: imaket_services imaket_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_services
    ADD CONSTRAINT imaket_services_pkey PRIMARY KEY (product_id);


--
-- Name: imaket_shipments imaket_shipments_order_id_creator_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_shipments
    ADD CONSTRAINT imaket_shipments_order_id_creator_id_key UNIQUE (order_id, creator_id);


--
-- Name: imaket_shipments imaket_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_shipments
    ADD CONSTRAINT imaket_shipments_pkey PRIMARY KEY (id);


--
-- Name: imaket_shipping_rates imaket_shipping_rates_creator_id_country_code_currency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_shipping_rates
    ADD CONSTRAINT imaket_shipping_rates_creator_id_country_code_currency_key UNIQUE (creator_id, country_code, currency);


--
-- Name: imaket_shipping_rates imaket_shipping_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_shipping_rates
    ADD CONSTRAINT imaket_shipping_rates_pkey PRIMARY KEY (id);


--
-- Name: imaket_tickets imaket_tickets_order_item_id_sequence_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_tickets
    ADD CONSTRAINT imaket_tickets_order_item_id_sequence_key UNIQUE (order_item_id, sequence);


--
-- Name: imaket_tickets imaket_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_tickets
    ADD CONSTRAINT imaket_tickets_pkey PRIMARY KEY (id);


--
-- Name: imaket_tickets imaket_tickets_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_tickets
    ADD CONSTRAINT imaket_tickets_token_key UNIQUE (token);


--
-- Name: imaket_users imaket_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_users
    ADD CONSTRAINT imaket_users_pkey PRIMARY KEY (id);


--
-- Name: imaket_wishlists imaket_wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_wishlists
    ADD CONSTRAINT imaket_wishlists_pkey PRIMARY KEY (user_id, product_id);


--
-- Name: imaket_affiliates_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_affiliates_creator_idx ON public.imaket_affiliates USING btree (creator_id);


--
-- Name: imaket_affiliates_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_affiliates_user_idx ON public.imaket_affiliates USING btree (user_id);


--
-- Name: imaket_analytics_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_analytics_creator_idx ON public.imaket_analytics_events USING btree (creator_id, created_at DESC);


--
-- Name: imaket_analytics_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_analytics_product_idx ON public.imaket_analytics_events USING btree (product_id);


--
-- Name: imaket_booking_active_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX imaket_booking_active_request_idx ON public.imaket_bookings USING btree (product_id, customer_id, starts_at) WHERE (status = ANY (ARRAY['pending'::text, 'accepted'::text]));


--
-- Name: imaket_bookings_creator_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_bookings_creator_time_idx ON public.imaket_bookings USING btree (creator_id, starts_at, ends_at);


--
-- Name: imaket_bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_bookings_customer_idx ON public.imaket_bookings USING btree (customer_id);


--
-- Name: imaket_bookings_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_bookings_product_idx ON public.imaket_bookings USING btree (product_id);


--
-- Name: imaket_coupons_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_coupons_creator_idx ON public.imaket_coupons USING btree (creator_id);


--
-- Name: imaket_course_lessons_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_course_lessons_module_idx ON public.imaket_course_lessons USING btree (module_id);


--
-- Name: imaket_course_lessons_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_course_lessons_product_idx ON public.imaket_course_lessons USING btree (product_id);


--
-- Name: imaket_course_modules_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_course_modules_product_idx ON public.imaket_course_modules USING btree (product_id);


--
-- Name: imaket_downloads_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_downloads_email_idx ON public.imaket_downloads USING btree (lower(customer_email));


--
-- Name: imaket_downloads_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_downloads_order_idx ON public.imaket_downloads USING btree (order_id);


--
-- Name: imaket_downloads_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_downloads_product_idx ON public.imaket_downloads USING btree (product_id);


--
-- Name: imaket_downloads_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_downloads_user_idx ON public.imaket_downloads USING btree (customer_id, created_at DESC);


--
-- Name: imaket_events_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_events_creator_idx ON public.imaket_events USING btree (creator_id);


--
-- Name: imaket_notifications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_notifications_user_idx ON public.imaket_notifications USING btree (user_id, created_at DESC);


--
-- Name: imaket_order_items_creator_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_order_items_creator_created_idx ON public.imaket_order_items USING btree (creator_id, created_at DESC);


--
-- Name: imaket_order_items_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_order_items_creator_idx ON public.imaket_order_items USING btree (creator_id);


--
-- Name: imaket_order_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_order_items_order_idx ON public.imaket_order_items USING btree (order_id);


--
-- Name: imaket_order_items_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_order_items_product_idx ON public.imaket_order_items USING btree (product_id);


--
-- Name: imaket_orders_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_orders_customer_idx ON public.imaket_orders USING btree (customer_id, created_at DESC);


--
-- Name: imaket_orders_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_orders_email_idx ON public.imaket_orders USING btree (lower(customer_email));


--
-- Name: imaket_orders_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_orders_status_idx ON public.imaket_orders USING btree (status, created_at DESC);


--
-- Name: imaket_payment_events_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_payment_events_payment_idx ON public.imaket_payment_events USING btree (payment_id);


--
-- Name: imaket_payments_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_payments_order_idx ON public.imaket_payments USING btree (order_id);


--
-- Name: imaket_payouts_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_payouts_creator_idx ON public.imaket_payouts USING btree (creator_id);


--
-- Name: imaket_product_files_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_product_files_product_idx ON public.imaket_product_files USING btree (product_id);


--
-- Name: imaket_products_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_products_category_idx ON public.imaket_products USING btree (category_id);


--
-- Name: imaket_products_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_products_creator_idx ON public.imaket_products USING btree (creator_id);


--
-- Name: imaket_products_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_products_public_idx ON public.imaket_products USING btree (created_at DESC) WHERE (status = 'published'::text);


--
-- Name: imaket_products_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_products_search_idx ON public.imaket_products USING gin (search);


--
-- Name: imaket_products_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_products_status_idx ON public.imaket_products USING btree (status, published_at DESC);


--
-- Name: imaket_products_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_products_type_idx ON public.imaket_products USING btree (type);


--
-- Name: imaket_progress_lesson_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_progress_lesson_idx ON public.imaket_lesson_progress USING btree (lesson_id);


--
-- Name: imaket_reports_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_reports_open_idx ON public.imaket_reports USING btree (created_at DESC) WHERE (status = 'open'::text);


--
-- Name: imaket_reports_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_reports_user_idx ON public.imaket_reports USING btree (user_id);


--
-- Name: imaket_reviews_product_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_reviews_product_created_idx ON public.imaket_reviews USING btree (product_id, created_at DESC);


--
-- Name: imaket_reviews_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_reviews_product_idx ON public.imaket_reviews USING btree (product_id);


--
-- Name: imaket_services_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_services_creator_idx ON public.imaket_services USING btree (creator_id);


--
-- Name: imaket_shipments_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_shipments_creator_idx ON public.imaket_shipments USING btree (creator_id);


--
-- Name: imaket_shipments_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_shipments_order_idx ON public.imaket_shipments USING btree (order_id);


--
-- Name: imaket_tickets_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_tickets_creator_idx ON public.imaket_tickets USING btree (creator_id);


--
-- Name: imaket_tickets_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_tickets_customer_idx ON public.imaket_tickets USING btree (customer_id);


--
-- Name: imaket_tickets_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_tickets_product_idx ON public.imaket_tickets USING btree (product_id);


--
-- Name: imaket_users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX imaket_users_email_key ON public.imaket_users USING btree (lower(email));


--
-- Name: imaket_wishlists_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imaket_wishlists_product_idx ON public.imaket_wishlists USING btree (product_id);


--
-- Name: imaket_creators imaket_creators_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_creators_guard BEFORE UPDATE ON public.imaket_creators FOR EACH ROW EXECUTE FUNCTION imaket_private.guard_creator_update();


--
-- Name: imaket_creators imaket_creators_reserved_handle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_creators_reserved_handle BEFORE INSERT OR UPDATE OF handle ON public.imaket_creators FOR EACH ROW EXECUTE FUNCTION imaket_private.check_reserved_handle();


--
-- Name: imaket_creators imaket_creators_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_creators_updated BEFORE UPDATE ON public.imaket_creators FOR EACH ROW EXECUTE FUNCTION imaket_private.set_updated_at();


--
-- Name: imaket_order_items imaket_order_items_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_order_items_guard BEFORE UPDATE ON public.imaket_order_items FOR EACH ROW EXECUTE FUNCTION imaket_private.guard_order_item_update();


--
-- Name: imaket_orders imaket_orders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_orders_updated BEFORE UPDATE ON public.imaket_orders FOR EACH ROW EXECUTE FUNCTION imaket_private.set_updated_at();


--
-- Name: imaket_payments imaket_payments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_payments_updated BEFORE UPDATE ON public.imaket_payments FOR EACH ROW EXECUTE FUNCTION imaket_private.set_updated_at();


--
-- Name: imaket_products imaket_products_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_products_guard BEFORE INSERT OR UPDATE ON public.imaket_products FOR EACH ROW EXECUTE FUNCTION imaket_private.guard_product_status();


--
-- Name: imaket_products imaket_products_moderation_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_products_moderation_notify AFTER UPDATE OF status ON public.imaket_products FOR EACH ROW EXECUTE FUNCTION imaket_private.notify_product_moderation();


--
-- Name: imaket_products imaket_products_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_products_updated BEFORE UPDATE ON public.imaket_products FOR EACH ROW EXECUTE FUNCTION imaket_private.set_updated_at();


--
-- Name: imaket_reviews imaket_reviews_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_reviews_guard BEFORE UPDATE ON public.imaket_reviews FOR EACH ROW EXECUTE FUNCTION imaket_private.guard_review_update();


--
-- Name: imaket_reviews imaket_reviews_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_reviews_rating AFTER INSERT OR DELETE OR UPDATE ON public.imaket_reviews FOR EACH ROW EXECUTE FUNCTION imaket_private.refresh_product_rating();


--
-- Name: imaket_reviews imaket_reviews_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_reviews_updated BEFORE UPDATE ON public.imaket_reviews FOR EACH ROW EXECUTE FUNCTION imaket_private.set_updated_at();


--
-- Name: imaket_users imaket_users_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_users_guard BEFORE UPDATE ON public.imaket_users FOR EACH ROW EXECUTE FUNCTION imaket_private.guard_user_update();


--
-- Name: imaket_users imaket_users_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER imaket_users_updated BEFORE UPDATE ON public.imaket_users FOR EACH ROW EXECUTE FUNCTION imaket_private.set_updated_at();


--
-- Name: imaket_affiliates imaket_affiliates_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_affiliates
    ADD CONSTRAINT imaket_affiliates_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_affiliates imaket_affiliates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_affiliates
    ADD CONSTRAINT imaket_affiliates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.imaket_users(id) ON DELETE CASCADE;


--
-- Name: imaket_analytics_events imaket_analytics_events_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_analytics_events
    ADD CONSTRAINT imaket_analytics_events_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_analytics_events imaket_analytics_events_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_analytics_events
    ADD CONSTRAINT imaket_analytics_events_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_products(id);


--
-- Name: imaket_bookings imaket_bookings_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_bookings
    ADD CONSTRAINT imaket_bookings_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_bookings imaket_bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_bookings
    ADD CONSTRAINT imaket_bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.imaket_users(id) ON DELETE CASCADE;


--
-- Name: imaket_bookings imaket_bookings_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_bookings
    ADD CONSTRAINT imaket_bookings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_services(product_id);


--
-- Name: imaket_categories imaket_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_categories
    ADD CONSTRAINT imaket_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.imaket_categories(id) ON DELETE SET NULL;


--
-- Name: imaket_coupons imaket_coupons_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_coupons
    ADD CONSTRAINT imaket_coupons_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_course_lessons imaket_course_lessons_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_course_lessons
    ADD CONSTRAINT imaket_course_lessons_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.imaket_course_modules(id) ON DELETE CASCADE;


--
-- Name: imaket_course_lessons imaket_course_lessons_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_course_lessons
    ADD CONSTRAINT imaket_course_lessons_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_products(id) ON DELETE CASCADE;


--
-- Name: imaket_course_modules imaket_course_modules_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_course_modules
    ADD CONSTRAINT imaket_course_modules_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_products(id) ON DELETE CASCADE;


--
-- Name: imaket_creators imaket_creators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_creators
    ADD CONSTRAINT imaket_creators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.imaket_users(id) ON DELETE CASCADE;


--
-- Name: imaket_downloads imaket_downloads_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_downloads
    ADD CONSTRAINT imaket_downloads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.imaket_users(id) ON DELETE SET NULL;


--
-- Name: imaket_downloads imaket_downloads_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_downloads
    ADD CONSTRAINT imaket_downloads_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.imaket_orders(id);


--
-- Name: imaket_downloads imaket_downloads_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_downloads
    ADD CONSTRAINT imaket_downloads_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.imaket_order_items(id) ON DELETE CASCADE;


--
-- Name: imaket_downloads imaket_downloads_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_downloads
    ADD CONSTRAINT imaket_downloads_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_products(id);


--
-- Name: imaket_events imaket_events_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_events
    ADD CONSTRAINT imaket_events_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_events imaket_events_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_events
    ADD CONSTRAINT imaket_events_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_products(id) ON DELETE CASCADE;


--
-- Name: imaket_lesson_progress imaket_lesson_progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_lesson_progress
    ADD CONSTRAINT imaket_lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.imaket_course_lessons(id) ON DELETE CASCADE;


--
-- Name: imaket_lesson_progress imaket_lesson_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_lesson_progress
    ADD CONSTRAINT imaket_lesson_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.imaket_users(id) ON DELETE CASCADE;


--
-- Name: imaket_notifications imaket_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_notifications
    ADD CONSTRAINT imaket_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.imaket_users(id) ON DELETE CASCADE;


--
-- Name: imaket_order_items imaket_order_items_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_order_items
    ADD CONSTRAINT imaket_order_items_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_order_items imaket_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_order_items
    ADD CONSTRAINT imaket_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.imaket_orders(id) ON DELETE CASCADE;


--
-- Name: imaket_order_items imaket_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_order_items
    ADD CONSTRAINT imaket_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_products(id) ON DELETE SET NULL;


--
-- Name: imaket_orders imaket_orders_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_orders
    ADD CONSTRAINT imaket_orders_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.imaket_affiliates(id) ON DELETE SET NULL;


--
-- Name: imaket_orders imaket_orders_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_orders
    ADD CONSTRAINT imaket_orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.imaket_coupons(id) ON DELETE SET NULL;


--
-- Name: imaket_orders imaket_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_orders
    ADD CONSTRAINT imaket_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.imaket_users(id) ON DELETE SET NULL;


--
-- Name: imaket_payment_events imaket_payment_events_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_payment_events
    ADD CONSTRAINT imaket_payment_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.imaket_payments(id);


--
-- Name: imaket_payments imaket_payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_payments
    ADD CONSTRAINT imaket_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.imaket_orders(id);


--
-- Name: imaket_payouts imaket_payouts_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_payouts
    ADD CONSTRAINT imaket_payouts_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_payouts imaket_payouts_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_payouts
    ADD CONSTRAINT imaket_payouts_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.imaket_users(id) ON DELETE SET NULL;


--
-- Name: imaket_product_files imaket_product_files_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_product_files
    ADD CONSTRAINT imaket_product_files_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_products(id) ON DELETE CASCADE;


--
-- Name: imaket_products imaket_products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_products
    ADD CONSTRAINT imaket_products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.imaket_categories(id);


--
-- Name: imaket_products imaket_products_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_products
    ADD CONSTRAINT imaket_products_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_products imaket_products_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_products
    ADD CONSTRAINT imaket_products_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.imaket_users(id) ON DELETE SET NULL;


--
-- Name: imaket_reports imaket_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_reports
    ADD CONSTRAINT imaket_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.imaket_users(id) ON DELETE CASCADE;


--
-- Name: imaket_reviews imaket_reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_reviews
    ADD CONSTRAINT imaket_reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.imaket_users(id) ON DELETE CASCADE;


--
-- Name: imaket_reviews imaket_reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_reviews
    ADD CONSTRAINT imaket_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_products(id);


--
-- Name: imaket_services imaket_services_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_services
    ADD CONSTRAINT imaket_services_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_services imaket_services_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_services
    ADD CONSTRAINT imaket_services_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_products(id) ON DELETE CASCADE;


--
-- Name: imaket_shipments imaket_shipments_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_shipments
    ADD CONSTRAINT imaket_shipments_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_shipments imaket_shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_shipments
    ADD CONSTRAINT imaket_shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.imaket_orders(id);


--
-- Name: imaket_shipping_rates imaket_shipping_rates_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_shipping_rates
    ADD CONSTRAINT imaket_shipping_rates_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_tickets imaket_tickets_checked_in_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_tickets
    ADD CONSTRAINT imaket_tickets_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.imaket_users(id) ON DELETE SET NULL;


--
-- Name: imaket_tickets imaket_tickets_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_tickets
    ADD CONSTRAINT imaket_tickets_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.imaket_creators(id);


--
-- Name: imaket_tickets imaket_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_tickets
    ADD CONSTRAINT imaket_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.imaket_users(id) ON DELETE CASCADE;


--
-- Name: imaket_tickets imaket_tickets_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_tickets
    ADD CONSTRAINT imaket_tickets_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.imaket_order_items(id);


--
-- Name: imaket_tickets imaket_tickets_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_tickets
    ADD CONSTRAINT imaket_tickets_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_events(product_id);


--
-- Name: imaket_users imaket_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_users
    ADD CONSTRAINT imaket_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: imaket_wishlists imaket_wishlists_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_wishlists
    ADD CONSTRAINT imaket_wishlists_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.imaket_products(id) ON DELETE CASCADE;


--
-- Name: imaket_wishlists imaket_wishlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaket_wishlists
    ADD CONSTRAINT imaket_wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.imaket_users(id) ON DELETE CASCADE;


--
-- Name: imaket_affiliates affiliates_join; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY affiliates_join ON public.imaket_affiliates FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (creator_id IS DISTINCT FROM ( SELECT imaket_private.current_creator_id() AS current_creator_id))));


--
-- Name: imaket_affiliates affiliates_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY affiliates_manage ON public.imaket_affiliates FOR UPDATE TO authenticated USING (((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin))) WITH CHECK (((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_affiliates affiliates_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY affiliates_read ON public.imaket_affiliates FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_affiliates affiliates_remove; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY affiliates_remove ON public.imaket_affiliates FOR DELETE TO authenticated USING (((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR (user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_analytics_events analytics_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_read ON public.imaket_analytics_events FOR SELECT TO authenticated USING (((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_bookings bookings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_read ON public.imaket_bookings FOR SELECT TO authenticated USING (((customer_id = ( SELECT auth.uid() AS uid)) OR imaket_private.owns_creator(creator_id)));


--
-- Name: imaket_categories categories_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_admin ON public.imaket_categories TO authenticated USING (( SELECT imaket_private.is_admin() AS is_admin)) WITH CHECK (( SELECT imaket_private.is_admin() AS is_admin));


--
-- Name: imaket_categories categories_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_read ON public.imaket_categories FOR SELECT TO anon, authenticated USING (true);


--
-- Name: imaket_coupons coupons_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coupons_owner ON public.imaket_coupons TO authenticated USING (((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin))) WITH CHECK ((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)));


--
-- Name: imaket_creators creators_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY creators_delete ON public.imaket_creators FOR DELETE TO authenticated USING (( SELECT imaket_private.is_admin() AS is_admin));


--
-- Name: imaket_creators creators_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY creators_insert ON public.imaket_creators FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: imaket_creators creators_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY creators_read ON public.imaket_creators FOR SELECT TO anon, authenticated USING (((status = 'active'::text) OR (user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_creators creators_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY creators_update ON public.imaket_creators FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_downloads downloads_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY downloads_read ON public.imaket_downloads FOR SELECT TO authenticated USING (((customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_events events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_insert ON public.imaket_events FOR INSERT TO authenticated WITH CHECK ((imaket_private.creator_can_sell(creator_id) AND (EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_events.product_id) AND (p.creator_id = imaket_events.creator_id) AND (p.type = 'ticket'::text))))));


--
-- Name: imaket_events events_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_read ON public.imaket_events FOR SELECT TO anon, authenticated USING (((EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_events.product_id) AND (p.status = 'published'::text)))) OR imaket_private.owns_creator(creator_id) OR imaket_private.has_purchase(product_id)));


--
-- Name: imaket_events events_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_update ON public.imaket_events FOR UPDATE TO authenticated USING (imaket_private.owns_creator(creator_id)) WITH CHECK ((imaket_private.creator_can_sell(creator_id) AND (EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_events.product_id) AND (p.creator_id = imaket_events.creator_id) AND (p.type = 'ticket'::text))))));


--
-- Name: imaket_affiliates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_affiliates ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_course_lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_course_lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_course_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_course_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_creators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_creators ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_downloads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_downloads ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_events ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_lesson_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_lesson_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_payment_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_payment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_product_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_product_files ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_products ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_services ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_shipments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_shipments ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_shipping_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_shipping_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_users ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_wishlists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaket_wishlists ENABLE ROW LEVEL SECURITY;

--
-- Name: imaket_order_items items_fulfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY items_fulfil ON public.imaket_order_items FOR UPDATE TO authenticated USING ((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id))) WITH CHECK ((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)));


--
-- Name: imaket_order_items items_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY items_read ON public.imaket_order_items FOR SELECT TO authenticated USING (((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR imaket_private.order_is_mine(order_id) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_course_lessons lessons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_read ON public.imaket_course_lessons FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_course_lessons.product_id) AND ((p.status = 'published'::text) OR (p.creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin))))));


--
-- Name: imaket_course_lessons lessons_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_write ON public.imaket_course_lessons TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_course_lessons.product_id) AND (p.creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_course_lessons.product_id) AND (p.creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id))))));


--
-- Name: imaket_course_modules modules_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_read ON public.imaket_course_modules FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_course_modules.product_id) AND ((p.status = 'published'::text) OR (p.creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin))))));


--
-- Name: imaket_course_modules modules_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_write ON public.imaket_course_modules TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_course_modules.product_id) AND (p.creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_course_modules.product_id) AND (p.creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id))))));


--
-- Name: imaket_notifications notifications_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_delete ON public.imaket_notifications FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: imaket_notifications notifications_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_read ON public.imaket_notifications FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: imaket_notifications notifications_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update ON public.imaket_notifications FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: imaket_orders orders_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_read ON public.imaket_orders FOR SELECT TO authenticated USING (((customer_id = ( SELECT auth.uid() AS uid)) OR imaket_private.is_order_seller(id) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_payments payments_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_read ON public.imaket_payments FOR SELECT TO authenticated USING ((imaket_private.order_is_mine(order_id) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_payouts payouts_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payouts_admin ON public.imaket_payouts FOR UPDATE TO authenticated USING (( SELECT imaket_private.is_admin() AS is_admin)) WITH CHECK (( SELECT imaket_private.is_admin() AS is_admin));


--
-- Name: imaket_payouts payouts_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payouts_read ON public.imaket_payouts FOR SELECT TO authenticated USING (((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_product_files product_files_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_files_owner ON public.imaket_product_files TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_product_files.product_id) AND ((p.creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_product_files.product_id) AND (p.creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id))))));


--
-- Name: imaket_products products_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_delete ON public.imaket_products FOR DELETE TO authenticated USING (((creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_products products_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_insert ON public.imaket_products FOR INSERT TO authenticated WITH CHECK (imaket_private.creator_can_sell(creator_id));


--
-- Name: imaket_products products_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_read ON public.imaket_products FOR SELECT TO anon, authenticated USING ((((status = 'published'::text) AND (EXISTS ( SELECT 1
   FROM public.imaket_creators c
  WHERE ((c.id = imaket_products.creator_id) AND (c.status = 'active'::text))))) OR (creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)) OR ( SELECT imaket_private.is_admin() AS is_admin) OR imaket_private.has_purchase(id)));


--
-- Name: imaket_products products_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_update ON public.imaket_products FOR UPDATE TO authenticated USING ((imaket_private.creator_can_sell(creator_id) OR ( SELECT imaket_private.is_admin() AS is_admin))) WITH CHECK ((imaket_private.creator_can_sell(creator_id) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_lesson_progress progress_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_read ON public.imaket_lesson_progress FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: imaket_lesson_progress progress_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_update ON public.imaket_lesson_progress FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.imaket_course_lessons l
  WHERE ((l.id = imaket_lesson_progress.lesson_id) AND imaket_private.has_purchase(l.product_id))))));


--
-- Name: imaket_lesson_progress progress_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_write ON public.imaket_lesson_progress FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.imaket_course_lessons l
  WHERE ((l.id = imaket_lesson_progress.lesson_id) AND imaket_private.has_purchase(l.product_id))))));


--
-- Name: imaket_reports reports_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_insert ON public.imaket_reports FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: imaket_reports reports_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_read ON public.imaket_reports FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_reports reports_review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_review ON public.imaket_reports FOR UPDATE TO authenticated USING (( SELECT imaket_private.is_admin() AS is_admin)) WITH CHECK (( SELECT imaket_private.is_admin() AS is_admin));


--
-- Name: imaket_reviews reviews_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_delete ON public.imaket_reviews FOR DELETE TO authenticated USING (((customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_reviews reviews_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_insert ON public.imaket_reviews FOR INSERT TO authenticated WITH CHECK (((customer_id = ( SELECT auth.uid() AS uid)) AND imaket_private.has_purchase(product_id)));


--
-- Name: imaket_reviews reviews_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_read ON public.imaket_reviews FOR SELECT TO anon, authenticated USING (((status = 'published'::text) OR (customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_reviews.product_id) AND (p.creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)))))));


--
-- Name: imaket_reviews reviews_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_update ON public.imaket_reviews FOR UPDATE TO authenticated USING (((customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_reviews.product_id) AND (p.creator_id = ( SELECT imaket_private.current_creator_id() AS current_creator_id)))))));


--
-- Name: imaket_services services_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_insert ON public.imaket_services FOR INSERT TO authenticated WITH CHECK ((imaket_private.creator_can_sell(creator_id) AND (EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_services.product_id) AND (p.creator_id = imaket_services.creator_id) AND (p.type = 'service'::text))))));


--
-- Name: imaket_services services_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_read ON public.imaket_services FOR SELECT TO anon, authenticated USING (((EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_services.product_id) AND (p.status = 'published'::text)))) OR imaket_private.owns_creator(creator_id)));


--
-- Name: imaket_services services_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_update ON public.imaket_services FOR UPDATE TO authenticated USING (imaket_private.owns_creator(creator_id)) WITH CHECK ((imaket_private.creator_can_sell(creator_id) AND (EXISTS ( SELECT 1
   FROM public.imaket_products p
  WHERE ((p.id = imaket_services.product_id) AND (p.creator_id = imaket_services.creator_id) AND (p.type = 'service'::text))))));


--
-- Name: imaket_platform_settings settings_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_admin ON public.imaket_platform_settings TO authenticated USING (( SELECT imaket_private.is_admin() AS is_admin)) WITH CHECK (( SELECT imaket_private.is_admin() AS is_admin));


--
-- Name: imaket_platform_settings settings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_read ON public.imaket_platform_settings FOR SELECT TO anon, authenticated USING (true);


--
-- Name: imaket_shipments shipments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipments_insert ON public.imaket_shipments FOR INSERT TO authenticated WITH CHECK ((imaket_private.creator_can_sell(creator_id) AND (EXISTS ( SELECT 1
   FROM (public.imaket_order_items i
     JOIN public.imaket_orders o ON ((o.id = i.order_id)))
  WHERE ((i.order_id = imaket_shipments.order_id) AND (i.creator_id = imaket_shipments.creator_id) AND (o.status = ANY (ARRAY['paid'::text, 'fulfilled'::text])) AND (i.product_type = 'physical'::text))))));


--
-- Name: imaket_shipments shipments_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipments_read ON public.imaket_shipments FOR SELECT TO authenticated USING ((imaket_private.owns_creator(creator_id) OR imaket_private.order_is_mine(order_id)));


--
-- Name: imaket_shipments shipments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipments_update ON public.imaket_shipments FOR UPDATE TO authenticated USING (imaket_private.owns_creator(creator_id)) WITH CHECK (imaket_private.creator_can_sell(creator_id));


--
-- Name: imaket_shipping_rates shipping_rates_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipping_rates_owner ON public.imaket_shipping_rates TO authenticated USING (imaket_private.owns_creator(creator_id)) WITH CHECK (imaket_private.creator_can_sell(creator_id));


--
-- Name: imaket_shipping_rates shipping_rates_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipping_rates_read ON public.imaket_shipping_rates FOR SELECT TO anon, authenticated USING ((active OR imaket_private.owns_creator(creator_id)));


--
-- Name: imaket_tickets tickets_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tickets_read ON public.imaket_tickets FOR SELECT TO authenticated USING (((customer_id = ( SELECT auth.uid() AS uid)) OR imaket_private.owns_creator(creator_id)));


--
-- Name: imaket_users users_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_read ON public.imaket_users FOR SELECT TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_users users_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update ON public.imaket_users FOR UPDATE TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin))) WITH CHECK (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT imaket_private.is_admin() AS is_admin)));


--
-- Name: imaket_wishlists wishlist_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wishlist_own ON public.imaket_wishlists TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: SCHEMA imaket_private; Type: ACL; Schema: -; Owner: -
--


-- ─── Reset privileges ───────────────────────────────────────────────
-- Supabase auto-grants new public objects to anon/authenticated. Strip
-- those first; the explicit grants below are the only access allowed.
DO $reset$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.oid::regclass AS obj FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname LIKE 'imaket\_%' AND c.relkind IN ('r','v','S') LOOP
    EXECUTE format('REVOKE ALL ON %s FROM anon, authenticated, PUBLIC', r.obj);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE (n.nspname = 'public' AND p.proname LIKE 'imaket\_%') OR n.nspname = 'imaket_private' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.fn);
  END LOOP;
END $reset$;

GRANT USAGE ON SCHEMA imaket_private TO authenticated;
GRANT USAGE ON SCHEMA imaket_private TO anon;
GRANT USAGE ON SCHEMA imaket_private TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION check_ticket(p_token uuid, p_confirm boolean); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.check_ticket(p_token uuid, p_confirm boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.check_ticket(p_token uuid, p_confirm boolean) TO authenticated;


--
-- Name: FUNCTION creator_can_sell(cid uuid); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.creator_can_sell(cid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.creator_can_sell(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION imaket_private.creator_can_sell(cid uuid) TO anon;
GRANT ALL ON FUNCTION imaket_private.creator_can_sell(cid uuid) TO service_role;


--
-- Name: FUNCTION creator_daily_sales(p_creator_id uuid, p_days integer); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.creator_daily_sales(p_creator_id uuid, p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.creator_daily_sales(p_creator_id uuid, p_days integer) TO authenticated;
GRANT ALL ON FUNCTION imaket_private.creator_daily_sales(p_creator_id uuid, p_days integer) TO service_role;


--
-- Name: FUNCTION current_creator_id(); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.current_creator_id() FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.current_creator_id() TO anon;
GRANT ALL ON FUNCTION imaket_private.current_creator_id() TO authenticated;
GRANT ALL ON FUNCTION imaket_private.current_creator_id() TO service_role;


--
-- Name: SEQUENCE imaket_order_number_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.imaket_order_number_seq TO anon;
GRANT ALL ON SEQUENCE public.imaket_order_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.imaket_order_number_seq TO service_role;


--
-- Name: TABLE imaket_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_orders TO service_role;
GRANT SELECT ON TABLE public.imaket_orders TO authenticated;


--
-- Name: FUNCTION finalize_order(p_order_id uuid, p_provider text, p_reference text, p_raw jsonb); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.finalize_order(p_order_id uuid, p_provider text, p_reference text, p_raw jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.finalize_order(p_order_id uuid, p_provider text, p_reference text, p_raw jsonb) TO service_role;


--
-- Name: FUNCTION has_purchase(pid uuid); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.has_purchase(pid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.has_purchase(pid uuid) TO authenticated;
GRANT ALL ON FUNCTION imaket_private.has_purchase(pid uuid) TO anon;
GRANT ALL ON FUNCTION imaket_private.has_purchase(pid uuid) TO service_role;


--
-- Name: FUNCTION imaket_review_creator(creator_uuid uuid, decision text); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.imaket_review_creator(creator_uuid uuid, decision text) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.imaket_review_creator(creator_uuid uuid, decision text) TO authenticated;


--
-- Name: FUNCTION increment_product_view(p_product_id uuid); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.increment_product_view(p_product_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.increment_product_view(p_product_id uuid) TO anon;
GRANT ALL ON FUNCTION imaket_private.increment_product_view(p_product_id uuid) TO authenticated;
GRANT ALL ON FUNCTION imaket_private.increment_product_view(p_product_id uuid) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.is_admin() TO authenticated;
GRANT ALL ON FUNCTION imaket_private.is_admin() TO anon;
GRANT ALL ON FUNCTION imaket_private.is_admin() TO service_role;


--
-- Name: FUNCTION is_order_seller(oid uuid); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.is_order_seller(oid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.is_order_seller(oid uuid) TO authenticated;
GRANT ALL ON FUNCTION imaket_private.is_order_seller(oid uuid) TO anon;
GRANT ALL ON FUNCTION imaket_private.is_order_seller(oid uuid) TO service_role;


--
-- Name: FUNCTION issue_tickets(p_product uuid); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.issue_tickets(p_product uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.issue_tickets(p_product uuid) TO authenticated;


--
-- Name: FUNCTION order_is_mine(oid uuid); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.order_is_mine(oid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.order_is_mine(oid uuid) TO anon;
GRANT ALL ON FUNCTION imaket_private.order_is_mine(oid uuid) TO authenticated;
GRANT ALL ON FUNCTION imaket_private.order_is_mine(oid uuid) TO service_role;


--
-- Name: FUNCTION owns_creator(cid uuid); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.owns_creator(cid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.owns_creator(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION imaket_private.owns_creator(cid uuid) TO anon;
GRANT ALL ON FUNCTION imaket_private.owns_creator(cid uuid) TO service_role;


--
-- Name: FUNCTION platform_daily_revenue(p_days integer); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.platform_daily_revenue(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.platform_daily_revenue(p_days integer) TO authenticated;
GRANT ALL ON FUNCTION imaket_private.platform_daily_revenue(p_days integer) TO service_role;


--
-- Name: FUNCTION public_profiles(p_ids uuid[]); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.public_profiles(p_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.public_profiles(p_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION imaket_private.public_profiles(p_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION imaket_private.public_profiles(p_ids uuid[]) TO service_role;


--
-- Name: FUNCTION request_booking(p_product uuid, p_start timestamp with time zone, p_note text); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.request_booking(p_product uuid, p_start timestamp with time zone, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.request_booking(p_product uuid, p_start timestamp with time zone, p_note text) TO authenticated;


--
-- Name: FUNCTION tags_to_text(text[]); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.tags_to_text(text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.tags_to_text(text[]) TO anon;
GRANT ALL ON FUNCTION imaket_private.tags_to_text(text[]) TO authenticated;
GRANT ALL ON FUNCTION imaket_private.tags_to_text(text[]) TO service_role;


--
-- Name: FUNCTION update_booking(p_booking uuid, p_status text, p_note text); Type: ACL; Schema: imaket_private; Owner: -
--

REVOKE ALL ON FUNCTION imaket_private.update_booking(p_booking uuid, p_status text, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION imaket_private.update_booking(p_booking uuid, p_status text, p_note text) TO authenticated;


--
-- Name: FUNCTION imaket_approve_creator(creator_uuid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_approve_creator(creator_uuid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_approve_creator(creator_uuid uuid) TO service_role;


--
-- Name: FUNCTION imaket_check_ticket(p_token uuid, p_confirm boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_check_ticket(p_token uuid, p_confirm boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_check_ticket(p_token uuid, p_confirm boolean) TO authenticated;


--
-- Name: FUNCTION imaket_creator_daily_sales(p_creator_id uuid, p_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_creator_daily_sales(p_creator_id uuid, p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_creator_daily_sales(p_creator_id uuid, p_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.imaket_creator_daily_sales(p_creator_id uuid, p_days integer) TO service_role;


--
-- Name: FUNCTION imaket_finalize_order(p_order_id uuid, p_provider text, p_reference text, p_raw jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_finalize_order(p_order_id uuid, p_provider text, p_reference text, p_raw jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_finalize_order(p_order_id uuid, p_provider text, p_reference text, p_raw jsonb) TO service_role;


--
-- Name: FUNCTION imaket_increment_product_view(p_product_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_increment_product_view(p_product_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_increment_product_view(p_product_id uuid) TO anon;
GRANT ALL ON FUNCTION public.imaket_increment_product_view(p_product_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.imaket_increment_product_view(p_product_id uuid) TO service_role;


--
-- Name: FUNCTION imaket_issue_tickets(p_product uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_issue_tickets(p_product uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_issue_tickets(p_product uuid) TO authenticated;


--
-- Name: FUNCTION imaket_platform_daily_revenue(p_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_platform_daily_revenue(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_platform_daily_revenue(p_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.imaket_platform_daily_revenue(p_days integer) TO service_role;


--
-- Name: FUNCTION imaket_public_profiles(p_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_public_profiles(p_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_public_profiles(p_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.imaket_public_profiles(p_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.imaket_public_profiles(p_ids uuid[]) TO service_role;


--
-- Name: FUNCTION imaket_request_booking(p_product uuid, p_start timestamp with time zone, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_request_booking(p_product uuid, p_start timestamp with time zone, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_request_booking(p_product uuid, p_start timestamp with time zone, p_note text) TO authenticated;


--
-- Name: FUNCTION imaket_review_creator(creator_uuid uuid, decision text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_review_creator(creator_uuid uuid, decision text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_review_creator(creator_uuid uuid, decision text) TO authenticated;


--
-- Name: FUNCTION imaket_update_booking(p_booking uuid, p_status text, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.imaket_update_booking(p_booking uuid, p_status text, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.imaket_update_booking(p_booking uuid, p_status text, p_note text) TO authenticated;


--
-- Name: TABLE imaket_affiliates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_affiliates TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.imaket_affiliates TO authenticated;


--
-- Name: TABLE imaket_analytics_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_analytics_events TO service_role;
GRANT SELECT ON TABLE public.imaket_analytics_events TO authenticated;


--
-- Name: SEQUENCE imaket_analytics_events_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.imaket_analytics_events_id_seq TO anon;
GRANT ALL ON SEQUENCE public.imaket_analytics_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.imaket_analytics_events_id_seq TO service_role;


--
-- Name: TABLE imaket_bookings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_bookings TO service_role;
GRANT SELECT ON TABLE public.imaket_bookings TO authenticated;


--
-- Name: TABLE imaket_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_categories TO service_role;
GRANT SELECT ON TABLE public.imaket_categories TO anon;
GRANT SELECT ON TABLE public.imaket_categories TO authenticated;


--
-- Name: TABLE imaket_coupons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_coupons TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.imaket_coupons TO authenticated;


--
-- Name: TABLE imaket_course_lessons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_course_lessons TO service_role;
GRANT INSERT,DELETE,UPDATE ON TABLE public.imaket_course_lessons TO authenticated;


--
-- Name: COLUMN imaket_course_lessons.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.imaket_course_lessons TO anon;
GRANT SELECT(id) ON TABLE public.imaket_course_lessons TO authenticated;


--
-- Name: COLUMN imaket_course_lessons.product_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(product_id) ON TABLE public.imaket_course_lessons TO anon;
GRANT SELECT(product_id) ON TABLE public.imaket_course_lessons TO authenticated;


--
-- Name: COLUMN imaket_course_lessons.title; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(title) ON TABLE public.imaket_course_lessons TO anon;
GRANT SELECT(title) ON TABLE public.imaket_course_lessons TO authenticated;


--
-- Name: COLUMN imaket_course_lessons.sort_order; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(sort_order) ON TABLE public.imaket_course_lessons TO anon;
GRANT SELECT(sort_order) ON TABLE public.imaket_course_lessons TO authenticated;


--
-- Name: COLUMN imaket_course_lessons.summary; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(summary) ON TABLE public.imaket_course_lessons TO anon;
GRANT SELECT(summary) ON TABLE public.imaket_course_lessons TO authenticated;


--
-- Name: COLUMN imaket_course_lessons.module_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(module_id) ON TABLE public.imaket_course_lessons TO anon;
GRANT SELECT(module_id) ON TABLE public.imaket_course_lessons TO authenticated;


--
-- Name: COLUMN imaket_course_lessons.duration_seconds; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(duration_seconds) ON TABLE public.imaket_course_lessons TO anon;
GRANT SELECT(duration_seconds) ON TABLE public.imaket_course_lessons TO authenticated;


--
-- Name: COLUMN imaket_course_lessons.is_preview; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_preview) ON TABLE public.imaket_course_lessons TO anon;
GRANT SELECT(is_preview) ON TABLE public.imaket_course_lessons TO authenticated;


--
-- Name: TABLE imaket_course_modules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_course_modules TO service_role;
GRANT SELECT ON TABLE public.imaket_course_modules TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.imaket_course_modules TO authenticated;


--
-- Name: TABLE imaket_creators; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_creators TO service_role;
GRANT SELECT ON TABLE public.imaket_creators TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE public.imaket_creators TO authenticated;


--
-- Name: TABLE imaket_order_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_order_items TO service_role;
GRANT SELECT ON TABLE public.imaket_order_items TO authenticated;


--
-- Name: COLUMN imaket_order_items.fulfillment_status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(fulfillment_status) ON TABLE public.imaket_order_items TO authenticated;


--
-- Name: COLUMN imaket_order_items.tracking_number; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(tracking_number) ON TABLE public.imaket_order_items TO authenticated;


--
-- Name: TABLE imaket_payouts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_payouts TO service_role;
GRANT SELECT ON TABLE public.imaket_payouts TO authenticated;


--
-- Name: COLUMN imaket_payouts.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.imaket_payouts TO authenticated;


--
-- Name: COLUMN imaket_payouts.reference; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(reference) ON TABLE public.imaket_payouts TO authenticated;


--
-- Name: COLUMN imaket_payouts.note; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(note) ON TABLE public.imaket_payouts TO authenticated;


--
-- Name: COLUMN imaket_payouts.processed_by; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(processed_by) ON TABLE public.imaket_payouts TO authenticated;


--
-- Name: COLUMN imaket_payouts.processed_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(processed_at) ON TABLE public.imaket_payouts TO authenticated;


--
-- Name: TABLE imaket_platform_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_platform_settings TO service_role;
GRANT SELECT ON TABLE public.imaket_platform_settings TO anon;
GRANT SELECT ON TABLE public.imaket_platform_settings TO authenticated;


--
-- Name: TABLE imaket_creator_balances; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_creator_balances TO service_role;
GRANT SELECT ON TABLE public.imaket_creator_balances TO authenticated;


--
-- Name: TABLE imaket_downloads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_downloads TO service_role;
GRANT SELECT ON TABLE public.imaket_downloads TO authenticated;


--
-- Name: TABLE imaket_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_events TO service_role;
GRANT SELECT ON TABLE public.imaket_events TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE public.imaket_events TO authenticated;


--
-- Name: TABLE imaket_lesson_progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_lesson_progress TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.imaket_lesson_progress TO authenticated;


--
-- Name: TABLE imaket_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_notifications TO service_role;
GRANT SELECT,DELETE ON TABLE public.imaket_notifications TO authenticated;


--
-- Name: COLUMN imaket_notifications.read_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(read_at) ON TABLE public.imaket_notifications TO authenticated;


--
-- Name: TABLE imaket_payment_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_payment_events TO service_role;


--
-- Name: TABLE imaket_payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_payments TO service_role;
GRANT SELECT ON TABLE public.imaket_payments TO authenticated;


--
-- Name: TABLE imaket_product_files; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_product_files TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.imaket_product_files TO authenticated;


--
-- Name: TABLE imaket_products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_products TO service_role;
GRANT SELECT ON TABLE public.imaket_products TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.imaket_products TO authenticated;


--
-- Name: TABLE imaket_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_reports TO service_role;
GRANT SELECT,INSERT ON TABLE public.imaket_reports TO authenticated;


--
-- Name: COLUMN imaket_reports.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(user_id) ON TABLE public.imaket_reports TO authenticated;


--
-- Name: COLUMN imaket_reports.listing; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(listing) ON TABLE public.imaket_reports TO authenticated;


--
-- Name: COLUMN imaket_reports.reason; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(reason) ON TABLE public.imaket_reports TO authenticated;


--
-- Name: COLUMN imaket_reports.details; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(details) ON TABLE public.imaket_reports TO authenticated;


--
-- Name: COLUMN imaket_reports.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.imaket_reports TO authenticated;


--
-- Name: TABLE imaket_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_reviews TO service_role;
GRANT SELECT ON TABLE public.imaket_reviews TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.imaket_reviews TO authenticated;


--
-- Name: TABLE imaket_services; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_services TO service_role;
GRANT SELECT ON TABLE public.imaket_services TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE public.imaket_services TO authenticated;


--
-- Name: TABLE imaket_shipments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_shipments TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.imaket_shipments TO authenticated;


--
-- Name: TABLE imaket_shipping_rates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_shipping_rates TO service_role;
GRANT SELECT ON TABLE public.imaket_shipping_rates TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.imaket_shipping_rates TO authenticated;


--
-- Name: TABLE imaket_tickets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_tickets TO service_role;
GRANT SELECT ON TABLE public.imaket_tickets TO authenticated;


--
-- Name: TABLE imaket_users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_users TO service_role;
GRANT SELECT ON TABLE public.imaket_users TO authenticated;


--
-- Name: COLUMN imaket_users.full_name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(full_name) ON TABLE public.imaket_users TO authenticated;


--
-- Name: COLUMN imaket_users.role; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(role) ON TABLE public.imaket_users TO authenticated;


--
-- Name: COLUMN imaket_users.email_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(email_notifications) ON TABLE public.imaket_users TO authenticated;


--
-- Name: COLUMN imaket_users.avatar_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(avatar_url) ON TABLE public.imaket_users TO authenticated;


--
-- Name: COLUMN imaket_users.phone; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(phone) ON TABLE public.imaket_users TO authenticated;


--
-- Name: COLUMN imaket_users.country; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(country) ON TABLE public.imaket_users TO authenticated;


--
-- Name: TABLE imaket_wishlists; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imaket_wishlists TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.imaket_wishlists TO authenticated;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
--



-- ─── Seed data ──────────────────────────────────────────────────────
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('bd6b169b-5287-42ab-b55b-2f30b5f13c8e', 'E-books & Guides', 'ebooks', 'BookOpen', NULL, 1, '2026-10-21 00:44:31.987215+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('d5ce084e-9d1a-433c-a0d8-0c8bc2597f03', 'Online Courses', 'courses', 'GraduationCap', NULL, 2, '2026-10-21 00:44:31.987215+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('73e8f501-1f1f-4683-8a5c-e9992baa1a33', 'Templates & Presets', 'templates', 'LayoutTemplate', NULL, 3, '2026-10-21 00:44:31.987215+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('7c8b2503-f3a8-4788-82d5-131429aa0bdd', 'Music & Audio', 'music', 'Music', NULL, 4, '2026-10-21 00:44:31.987215+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('17e97ac1-4e36-498c-aeb4-76815f40177c', 'Design', 'design', 'Palette', NULL, 5, '2026-10-21 00:44:31.986515+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('61e3632d-eadb-4630-aed1-d7299517b50e', 'Coaching & Services', 'coaching', 'Handshake', NULL, 6, '2026-10-21 00:44:31.987215+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('22ef1af3-cc32-435b-9640-a8f7db763001', 'Events & Tickets', 'events', 'Ticket', NULL, 7, '2026-10-21 00:44:31.987215+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('d6abad0c-c3ff-406a-9f72-093d22824f26', 'Fashion & Merch', 'fashion', 'Shirt', NULL, 8, '2026-10-21 00:44:31.987215+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('9913ca0a-38d6-4970-879d-6e8c65440988', 'Beauty & Wellness', 'beauty', 'Sparkles', NULL, 9, '2026-10-21 00:44:31.987215+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('c2c117d9-db4b-4d95-bb0e-f0108569d0a5', 'Software & Tools', 'software', 'Code', NULL, 10, '2026-10-21 00:44:31.987215+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('18f8a005-b0c9-4df7-b668-0abe6aa7a9ba', 'Photography', 'photography', 'Camera', NULL, 11, '2026-10-21 00:44:31.987215+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('5a9b961c-8dc6-4007-a93a-1bff0fda6552', 'Business', 'business', 'Briefcase', NULL, 12, '2026-10-21 00:44:31.986515+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('7b3f38dd-ee26-471f-9f91-625580b5aa40', 'Marketing', 'marketing', 'Megaphone', NULL, 13, '2026-10-21 00:44:31.986515+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('92ccdce0-5a08-4a40-bd50-16973fce0e0f', 'Personal growth', 'personal-growth', 'Sprout', NULL, 14, '2026-10-21 00:44:31.986515+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('fda00f15-01d8-492c-9de3-03a6d58c0d5a', 'Lifestyle', 'lifestyle', 'Coffee', NULL, 15, '2026-10-21 00:44:31.986515+02');
INSERT INTO public.imaket_categories (id, name, slug, icon, parent_id, sort_order, created_at) VALUES ('dd3d3d1b-16d8-459b-ad6e-f1bca1afedac', 'Community', 'community', 'Users', NULL, 16, '2026-10-21 00:44:31.986515+02');
INSERT INTO public.imaket_platform_settings (key, value, updated_at) VALUES ('fee_percent', '5', '2026-10-21 00:44:32.158694+02');
INSERT INTO public.imaket_platform_settings (key, value, updated_at) VALUES ('payout_hold_days', '7', '2026-10-21 00:44:32.158694+02');
INSERT INTO public.imaket_platform_settings (key, value, updated_at) VALUES ('min_payout', '{"GHS": 50, "KES": 500, "NGN": 5000, "UGX": 20000, "USD": 10, "ZMW": 100}', '2026-10-21 00:44:32.158694+02');
INSERT INTO public.imaket_platform_settings (key, value, updated_at) VALUES ('auto_approve_products', 'false', '2026-10-21 00:44:32.158694+02');
INSERT INTO public.imaket_platform_settings (key, value, updated_at) VALUES ('enabled_providers', '["flutterwave", "dusupay", "mobile_money", "stripe", "paypal"]', '2026-10-21 00:44:32.158694+02');
INSERT INTO public.imaket_platform_settings (key, value, updated_at) VALUES ('maintenance_mode', 'false', '2026-10-21 00:44:32.158694+02');

-- ─── Auth hooks ─────────────────────────────────────────────────────
CREATE TRIGGER imaket_new_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION imaket_private.handle_new_user();
CREATE TRIGGER imaket_user_email_changed AFTER UPDATE OF email ON auth.users FOR EACH ROW
  WHEN (old.email IS DISTINCT FROM new.email) EXECUTE FUNCTION imaket_private.handle_user_email_change();

-- ─── Storage ────────────────────────────────────────────────────────
-- imaket-covers: public images. imaket-product-files: private, signed URLs only.
-- 50 MB = Supabase free-plan upload cap; raise on Pro.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('imaket-covers', 'imaket-covers', true, 10485760, ARRAY['image/png','image/jpeg','image/webp','image/gif','image/avif']),
  ('imaket-product-files', 'imaket-product-files', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY imaket_covers_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'imaket-covers');
CREATE POLICY imaket_covers_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'imaket-covers'
              AND (storage.foldername(name))[1] IN ((SELECT imaket_private.current_creator_id())::text, (SELECT auth.uid())::text));
CREATE POLICY imaket_covers_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'imaket-covers'
         AND (storage.foldername(name))[1] IN ((SELECT imaket_private.current_creator_id())::text, (SELECT auth.uid())::text));
CREATE POLICY imaket_covers_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'imaket-covers'
         AND (storage.foldername(name))[1] IN ((SELECT imaket_private.current_creator_id())::text, (SELECT auth.uid())::text));
CREATE POLICY imaket_files_read_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'imaket-product-files' AND (storage.foldername(name))[1] = (SELECT imaket_private.current_creator_id())::text);
CREATE POLICY imaket_files_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'imaket-product-files' AND (storage.foldername(name))[1] = (SELECT imaket_private.current_creator_id())::text);
CREATE POLICY imaket_files_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'imaket-product-files' AND (storage.foldername(name))[1] = (SELECT imaket_private.current_creator_id())::text);

-- ─── Realtime ───────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.imaket_orders, public.imaket_order_items, public.imaket_notifications;
