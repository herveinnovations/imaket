-- Checks for 20261104000001_imaket_private_stats (run in a rolled-back transaction).
create temp table _r (n serial, k text, v text);
grant all on _r to anon, authenticated;
grant usage on sequence _r_n_seq to anon, authenticated;
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claims', case when uid is null then '{"role":"anon"}' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
end $$;
create or replace function pg_temp.try(label text, q text) returns void language plpgsql as $$
begin execute q; insert into _r (k, v) values (label, 'readable');
exception when insufficient_privilege then insert into _r (k, v) values (label, 'blocked'); end $$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'amara@example.com', '{"role":"creator","full_name":"Amara Phiri","handle":"amara"}', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'bwalya@example.com', '{"full_name":"Bwalya"}', 'authenticated', 'authenticated');
update public.imaket_creators set status = 'active', payout_method = '{"type":"mobile_money","network":"MTN","number":"0970000000","name":"Amara"}' where user_id = 'a0000000-0000-0000-0000-00000000000a';
insert into _r (k, v) select 'creator row', handle || ' ' || status from public.imaket_creators where user_id = 'a0000000-0000-0000-0000-00000000000a';

-- creator A: add + edit a product, edit store, through the normal API role
set local role authenticated; select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.imaket_products (creator_id, slug, title, type, price, currency, status)
  select id, 'tee-1', 'Tee', 'physical', 100, 'ZMW', 'pending_review' from public.imaket_creators where user_id = auth.uid()
  returning 'A insert -> ' || status as x \gset
insert into _r (k, v) values ('A insert product', :'x');
update public.imaket_products set title = 'Tee v2', price = 120 where slug = 'tee-1';
insert into _r (k, v) select 'A edit product', title || ' ' || status from public.imaket_products where slug = 'tee-1';
update public.imaket_creators set bio = 'hi', payout_method = '{"type":"mobile_money","network":"Airtel","number":"0960000000","name":"Amara"}' where user_id = auth.uid();
insert into _r (k, v) select 'A edit store', bio from public.imaket_creators where user_id = auth.uid();
select pg_temp.try('A reads own sales_count (use server)', 'select sales_count from public.imaket_products');
select pg_temp.try('A select * creators', 'select * from public.imaket_creators');

-- anon
reset role; set local role anon; select pg_temp.as_user(null);
select pg_temp.try('anon product cols', 'select id, title, price, rating_avg, search, creator_id from public.imaket_products');
select pg_temp.try('anon sales_count', 'select sales_count from public.imaket_products');
select pg_temp.try('anon view_count', 'select view_count from public.imaket_products');
select pg_temp.try('anon file_path', 'select file_path from public.imaket_products');
select pg_temp.try('anon select * products', 'select * from public.imaket_products');
select pg_temp.try('anon store cols', 'select id, handle, store_name, banner_url, avatar_url from public.imaket_creators');
select pg_temp.try('anon payout_method', 'select payout_method from public.imaket_creators');
select pg_temp.try('anon filter by payout', $q$select id from public.imaket_creators where payout_method is not null$q$);
insert into _r (k, v) select 'anon sees products', count(*)::text from public.imaket_products;

-- other member B
reset role; set local role authenticated; select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.try('B payout_method', 'select payout_method from public.imaket_creators');
select pg_temp.try('B sales_count', 'select sales_count from public.imaket_products');
select pg_temp.try('B order by sales_count', 'select id from public.imaket_products order by sales_count');

-- server (service role) still reads everything
reset role;
insert into _r (k, v) select 'server payout', payout_method->>'network' from public.imaket_creators where user_id = 'a0000000-0000-0000-0000-00000000000a';
insert into _r (k, v) select 'server sales', sales_count::text from public.imaket_products where slug = 'tee-1';

do $$ declare s text; begin select string_agg(n || '. ' || k || ': ' || coalesce(v, 'NULL'), E'\n' order by n) into s from _r; raise notice E'\n%', s; end $$;
