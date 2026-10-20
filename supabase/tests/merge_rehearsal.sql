-- Behaviour + security checks for the merged schema.
-- Run AFTER the merge migration, inside a transaction that is rolled back.
-- Ends by raising an exception that carries the results (and aborts everything).
create temp table _r (n serial, k text, v text);
grant all on _r to anon, authenticated;
grant usage on sequence _r_n_seq to anon, authenticated;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claims', case when uid is null then '{"role":"anon"}' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
end $$;

-- 1. signups
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'Amara@Example.com', '{"role":"creator","full_name":"Amara Phiri","handle":"amara"}', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'buyer@example.com', '{"role":"admin","full_name":"Bwalya"}', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'ops@example.com', '{"full_name":"Ops"}', 'authenticated', 'authenticated');
update public.imaket_users set role = 'admin' where id = 'c0000000-0000-0000-0000-00000000000c';
insert into _r (k, v) select 'users', string_agg(email || ':' || role, ', ' order by email) from public.imaket_users;
insert into _r (k, v) select 'store', handle || '/' || store_name || '/' || status || '/' || currency from public.imaket_creators;

-- 2. creator creates a product and tries to self-publish + feature it
set local role authenticated;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.imaket_products (creator_id, title, slug, price, status, featured, type, currency, summary, tags)
values (imaket_private.current_creator_id(), 'Lusaka Budget Planner', 'lusaka-budget-planner', 150, 'published', true, 'course', 'ZMW', 'Budget better', '{budget,excel}');
insert into public.imaket_product_files (product_id, storage_path, file_name, size_bytes)
  select id, imaket_private.current_creator_id() || '/planner.zip', 'planner.zip', 1000 from public.imaket_products;
insert into public.imaket_course_modules (product_id, title) select id, 'Module 1' from public.imaket_products;
insert into public.imaket_course_lessons (product_id, module_id, title, is_preview, video_path)
  select p.id, m.id, 'Lesson 1', true, 'secret/video.mp4' from public.imaket_products p, public.imaket_course_modules m;
insert into _r (k, v) select 'self-publish', status || ' featured=' || featured from public.imaket_products;
do $$ begin
  update public.imaket_users set role = 'admin' where id = auth.uid();
  insert into _r (k, v) values ('role escalation', 'ALLOWED (BAD)');
exception when others then insert into _r (k, v) values ('role escalation', 'blocked'); end $$;
do $$ begin
  update public.imaket_creators set verified = true, status = 'active' where user_id = auth.uid();
  insert into _r (k, v) select 'self-verify', case when verified then 'ALLOWED (BAD)' else 'ignored' end from public.imaket_creators;
end $$;
do $$ begin
  insert into public.imaket_creators (user_id, handle, store_name) values (auth.uid(), 'admin', 'x');
  insert into _r (k, v) values ('reserved handle', 'ALLOWED (BAD)');
exception when others then insert into _r (k, v) values ('reserved handle', 'blocked'); end $$;

-- 3. anon cannot see the unapproved product
reset role; set local role anon; select pg_temp.as_user(null);
insert into _r (k, v) select 'anon sees pending', count(*)::text from public.imaket_products;

-- 4. admin approves (server context)
reset role; select pg_temp.as_user(null);
update public.imaket_products set status = 'published';
insert into _r (k, v) select 'approved', status || ' published_at=' || (published_at is not null) from public.imaket_products;
insert into _r (k, v) select 'creator notified', title from public.imaket_notifications where type = 'product.published';

-- 5. anon browsing
set local role anon; select pg_temp.as_user(null);
insert into _r (k, v) select 'anon sees published', count(*)::text from public.imaket_products;
insert into _r (k, v) select 'anon search', count(*)::text from public.imaket_products where search @@ to_tsquery('simple', 'budg:*');
insert into _r (k, v) select 'anon lesson outline', count(*)::text from public.imaket_course_lessons;
do $$ begin
  perform video_path from public.imaket_course_lessons;
  insert into _r (k, v) values ('anon video_path', 'READABLE (BAD)');
exception when others then insert into _r (k, v) values ('anon video_path', 'blocked'); end $$;
do $$ begin
  perform 1 from public.imaket_product_files;
  insert into _r (k, v) values ('anon product_files', 'READABLE (BAD)');
exception when others then insert into _r (k, v) values ('anon product_files', 'blocked'); end $$;
insert into _r (k, v) select 'anon profiles rpc', string_agg(full_name, ',') from public.imaket_public_profiles(array['a0000000-0000-0000-0000-00000000000a'::uuid]);
do $$ begin
  perform 1 from public.imaket_users;
  insert into _r (k, v) values ('anon users table', 'READABLE (BAD)');
exception when others then insert into _r (k, v) values ('anon users table', 'blocked'); end $$;
select public.imaket_increment_product_view(id) from public.imaket_products;

-- 6. server creates a paid order (service role path)
reset role; select pg_temp.as_user(null);
insert into public.imaket_orders (id, customer_id, customer_email, customer_name, currency, subtotal, total, payment_provider)
values ('d0000000-0000-0000-0000-00000000000d', 'b0000000-0000-0000-0000-00000000000b', 'buyer@example.com', 'Bwalya', 'ZMW', 150, 150, 'mobile_money');
insert into public.imaket_order_items (order_id, product_id, creator_id, title, product_type, unit_price, line_total, platform_fee, creator_earnings)
select 'd0000000-0000-0000-0000-00000000000d', id, creator_id, title, type, 150, 150, 7.5, 142.5 from public.imaket_products;
insert into public.imaket_payments (order_id, provider, provider_reference, amount, currency, status)
values ('d0000000-0000-0000-0000-00000000000d', 'mobile_money', 'MOMO-1', 150, 'ZMW', 'pending');
insert into _r (k, v) select 'finalize #1', order_number || ' ' || status from public.imaket_finalize_order('d0000000-0000-0000-0000-00000000000d', 'mobile_money', 'MOMO-1');
insert into _r (k, v) select 'finalize #2 (idempotent)', order_number || ' ' || status from public.imaket_finalize_order('d0000000-0000-0000-0000-00000000000d', 'mobile_money', 'MOMO-1');
insert into _r (k, v) select 'downloads', count(*)::text || ' token_len=' || max(length(access_token)) from public.imaket_downloads;
insert into _r (k, v) select 'payment', status from public.imaket_payments;
insert into _r (k, v) select 'sales/views', sales_count || '/' || view_count from public.imaket_products;

-- 7. buyer
set local role authenticated; select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into _r (k, v) select 'buyer orders/items/downloads',
  (select count(*) from public.imaket_orders) || '/' || (select count(*) from public.imaket_order_items) || '/' || (select count(*) from public.imaket_downloads);
insert into _r (k, v) select 'buyer sees coupons', count(*)::text from public.imaket_coupons;
insert into public.imaket_reviews (product_id, customer_id, rating, body) select id, auth.uid(), 5, 'Great' from public.imaket_products;
insert into _r (k, v) select 'rating', rating_avg || ' x' || rating_count from public.imaket_products;
do $$ begin
  insert into public.imaket_orders (customer_email, total) values ('x@x.com', 1);
  insert into _r (k, v) values ('buyer inserts order', 'ALLOWED (BAD)');
exception when others then insert into _r (k, v) values ('buyer inserts order', 'blocked'); end $$;
do $$ begin
  perform public.imaket_finalize_order('d0000000-0000-0000-0000-00000000000d', 'stripe', 'x');
  insert into _r (k, v) values ('buyer calls finalize', 'ALLOWED (BAD)');
exception when others then insert into _r (k, v) values ('buyer calls finalize', 'blocked'); end $$;
do $$ begin
  perform 1 from public.imaket_creator_balances;
  insert into _r (k, v) select 'buyer balances rows', count(*)::text from public.imaket_creator_balances;
end $$;
insert into public.imaket_wishlists (user_id, product_id) select auth.uid(), id from public.imaket_products;
insert into _r (k, v) select 'wishlist', count(*)::text from public.imaket_wishlists;

-- 8. creator money views + tamper attempts
reset role; set local role authenticated; select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into _r (k, v) select 'balance', 'lifetime=' || lifetime_earnings || ' pending=' || pending || ' available=' || available from public.imaket_creator_balances;
insert into _r (k, v) select 'daily sales today', revenue::text from public.imaket_creator_daily_sales(imaket_private.current_creator_id(), 3) where day = current_date;
insert into _r (k, v) select 'creator sees order', count(*)::text from public.imaket_orders;
do $$ begin
  update public.imaket_order_items set creator_earnings = 99999;
  insert into _r (k, v) values ('earnings tamper', 'ALLOWED (BAD)');
exception when others then insert into _r (k, v) values ('earnings tamper', 'blocked'); end $$;
update public.imaket_order_items set fulfillment_status = 'completed';
insert into _r (k, v) select 'fulfil', fulfillment_status from public.imaket_order_items;
do $$ begin
  update public.imaket_products set sales_count = 9999, rating_avg = 1;
  insert into _r (k, v) select 'counter tamper', sales_count || '/' || rating_avg from public.imaket_products;
end $$;
update public.imaket_reviews set creator_reply = 'Thanks!', rating = 1;
insert into _r (k, v) select 'creator reply', rating || ' ' || creator_reply from public.imaket_reviews;
do $$ begin
  perform * from public.imaket_platform_daily_revenue(7) limit 1;
  insert into _r (k, v) select 'creator platform revenue rows', count(*)::text from public.imaket_platform_daily_revenue(7);
end $$;
insert into public.imaket_coupons (creator_id, code, type, value) values (imaket_private.current_creator_id(), 'MONTHEND', 'percent', 20);
insert into _r (k, v) select 'coupon', code || ' ' || type || ' ' || value from public.imaket_coupons;

-- 9. admin
reset role; set local role authenticated; select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
insert into _r (k, v) select 'admin sees users/orders', (select count(*) from public.imaket_users) || '/' || (select count(*) from public.imaket_orders);
insert into _r (k, v) select 'admin platform revenue today', gmv || ' fees ' || fees from public.imaket_platform_daily_revenue(3) where day = current_date;

reset role; select pg_temp.as_user(null);
do $$ begin
  delete from auth.users where id = 'b0000000-0000-0000-0000-00000000000b';
  insert into _r (k, v) select 'delete buyer account', 'ok; order kept=' || (select count(*) from public.imaket_orders) || ' customer_id=' || coalesce((select customer_id::text from public.imaket_orders), 'null');
exception when others then insert into _r (k, v) values ('delete buyer account', 'FAILED (BAD): ' || sqlerrm); end $$;
reset role;
do $$ begin raise exception E'REHEARSAL RESULTS\n%', (select string_agg(n || '. ' || k || ': ' || coalesce(v, 'NULL'), E'\n' order by n) from _r); end $$;
