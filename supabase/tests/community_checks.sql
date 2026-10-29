-- Behaviour + security checks for 20261029000001_imaket_storefront_community.
-- Run inside a transaction that is rolled back; ends by raising the results.
create temp table _r (n serial, k text, v text);
grant all on _r to anon, authenticated;
grant usage on sequence _r_n_seq to anon, authenticated;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claims', case when uid is null then '{"role":"anon"}' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
end $$;

-- users: A (creator), B (buyer), C (admin), D (private profile), E (banned)
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'amara@example.com', '{"role":"creator","full_name":"Amara Phiri","handle":"amara"}', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'bwalya@example.com', '{"full_name":"Bwalya"}', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'ops@example.com', '{"full_name":"Ops"}', 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'dee@example.com', '{"full_name":"Dee Private"}', 'authenticated', 'authenticated'),
  ('e0000000-0000-0000-0000-00000000000e', 'eve@example.com', '{"full_name":"Eve Banned"}', 'authenticated', 'authenticated');
update public.imaket_users set role = 'admin' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.imaket_users set public_profile = false where id = 'd0000000-0000-0000-0000-00000000000d';
update public.imaket_users set is_banned = true where id = 'e0000000-0000-0000-0000-00000000000e';

-- 1. seed present
insert into _r (k, v) select 'seed group', slug || ' public=' || (privacy = 'public') || ' members=' || member_count from public.imaket_groups;
insert into _r (k, v) select 'seed codes', string_agg(code || ':' || value || coalesce(case when first_order_only then '/first' end, ''), ', ' order by code) from public.imaket_platform_coupons;

-- 2. anon: can see groups, can't see codes/newsletter/members/directory
set local role anon; select pg_temp.as_user(null);
insert into _r (k, v) select 'anon sees groups', count(*)::text from public.imaket_groups;
do $$ begin perform 1 from public.imaket_platform_coupons; insert into _r (k, v) values ('anon codes', 'LEAK'); exception when insufficient_privilege then insert into _r (k, v) values ('anon codes', 'blocked'); end $$;
do $$ begin perform 1 from public.imaket_newsletter_subscribers; insert into _r (k, v) values ('anon newsletter', 'LEAK'); exception when insufficient_privilege then insert into _r (k, v) values ('anon newsletter', 'blocked'); end $$;
do $$ begin perform 1 from public.imaket_group_members; insert into _r (k, v) values ('anon members table', 'LEAK'); exception when insufficient_privilege then insert into _r (k, v) values ('anon members table', 'blocked'); end $$;
do $$ begin perform 1 from public.imaket_member_directory(); insert into _r (k, v) values ('anon directory', 'LEAK'); exception when insufficient_privilege then insert into _r (k, v) values ('anon directory', 'blocked'); end $$;
do $$ begin insert into public.imaket_groups (slug, name) values ('anon-group', 'Anon group'); insert into _r (k, v) values ('anon create group', 'ALLOWED'); exception when insufficient_privilege then insert into _r (k, v) values ('anon create group', 'blocked'); end $$;

-- 3. A creates a private group (becomes admin), B joins public community + requests private
reset role; set local role authenticated; select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.imaket_groups (slug, name, description, privacy, created_by, member_count)
  values ('makers-circle', 'Makers Circle', 'Private', 'private', 'a0000000-0000-0000-0000-00000000000a', 999);
insert into _r (k, v) select 'A group', slug || ' count=' || member_count || ' admin=' || exists (select 1 from public.imaket_group_members m where m.group_id = g.id and m.user_id = auth.uid() and m.role = 'admin') from public.imaket_groups g where slug = 'makers-circle';
insert into public.imaket_group_members (group_id, user_id) select id, auth.uid() from public.imaket_groups where slug = 'imaket-community';
insert into public.imaket_group_posts (group_id, author_id, body) select id, auth.uid(), 'Private hello' from public.imaket_groups where slug = 'makers-circle';
insert into public.imaket_group_posts (group_id, author_id, body) select id, auth.uid(), 'Community hello' from public.imaket_groups where slug = 'imaket-community';

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.imaket_group_members (group_id, user_id, role, status) select id, auth.uid(), 'admin', 'active' from public.imaket_groups where slug = 'imaket-community';
insert into public.imaket_group_members (group_id, user_id, role, status) select id, auth.uid(), 'admin', 'active' from public.imaket_groups where slug = 'makers-circle';
insert into _r (k, v) select 'B memberships', string_agg(g.slug || ':' || m.role || '/' || m.status, ', ' order by g.slug) from public.imaket_group_members m join public.imaket_groups g on g.id = m.group_id where m.user_id = auth.uid();
insert into _r (k, v) select 'B sees private posts', count(*)::text from public.imaket_group_posts p join public.imaket_groups g on g.id = p.group_id where g.slug = 'makers-circle';
do $$ begin
  insert into public.imaket_group_posts (group_id, author_id, body) select id, auth.uid(), 'sneak' from public.imaket_groups where slug = 'makers-circle';
  insert into _r (k, v) values ('B posts in private (pending)', 'ALLOWED');
exception when insufficient_privilege then insert into _r (k, v) values ('B posts in private (pending)', 'blocked'); end $$;
do $$ begin
  update public.imaket_group_members set status = 'active' where user_id = auth.uid();
  insert into _r (k, v) select 'B self-approve', case when status = 'pending' then 'blocked' else 'ALLOWED' end from public.imaket_group_members m join public.imaket_groups g on g.id = m.group_id where g.slug = 'makers-circle' and m.user_id = auth.uid();
end $$;
insert into public.imaket_group_comments (post_id, author_id, body) select p.id, auth.uid(), 'Welcome!' from public.imaket_group_posts p join public.imaket_groups g on g.id = p.group_id where g.slug = 'imaket-community';
do $$ begin update public.imaket_group_posts set comment_count = 50; insert into _r (k, v) values ('B sets comment_count', 'ALLOWED'); exception when insufficient_privilege then insert into _r (k, v) values ('B sets comment_count', 'blocked'); end $$;
update public.imaket_group_posts set body = 'hijack' where body = 'Community hello';
insert into _r (k, v) select 'B edits A post', case when body = 'hijack' then 'ALLOWED' else 'blocked' end from public.imaket_group_posts where author_id = 'a0000000-0000-0000-0000-00000000000a' and body in ('Community hello', 'hijack');
update public.imaket_groups set name = 'Hijacked' where slug = 'imaket-community';
insert into _r (k, v) select 'B renames group', case when name = 'Hijacked' then 'ALLOWED' else 'blocked' end from public.imaket_groups where slug = 'imaket-community';

-- 4. A approves B, counts update, B can post
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
update public.imaket_group_members set status = 'active' where user_id = 'b0000000-0000-0000-0000-00000000000b' and group_id = (select id from public.imaket_groups where slug = 'makers-circle');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.imaket_group_posts (group_id, author_id, body) select id, auth.uid(), 'Thanks for having me' from public.imaket_groups where slug = 'makers-circle';
insert into _r (k, v) select 'counts', string_agg(slug || ' members=' || member_count || ' posts=' || post_count, ', ' order by slug) from public.imaket_groups;
insert into _r (k, v) select 'comment count', comment_count::text from public.imaket_group_posts where body = 'Community hello';
insert into _r (k, v) select 'people(private) as B', count(*)::text from public.imaket_group_people((select id from public.imaket_groups where slug = 'makers-circle'));

-- 5. anon reads public feed but not private
reset role; set local role anon; select pg_temp.as_user(null);
insert into _r (k, v) select 'anon posts visible', string_agg(body, ' | ' order by body) from public.imaket_group_posts;
insert into _r (k, v) select 'anon people(private)', count(*)::text from public.imaket_group_people((select id from public.imaket_groups where slug = 'makers-circle'));

-- 6. banned user can't post/join; follows; directory
reset role; set local role authenticated; select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
do $$ begin insert into public.imaket_group_members (group_id, user_id) select id, auth.uid() from public.imaket_groups where slug = 'imaket-community'; insert into _r (k, v) values ('banned joins', 'ALLOWED'); exception when insufficient_privilege then insert into _r (k, v) values ('banned joins', 'blocked'); end $$;

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.imaket_follows (follower_id, followee_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000a');
do $$ begin insert into public.imaket_follows (follower_id, followee_id) values (auth.uid(), 'd0000000-0000-0000-0000-00000000000d'); insert into _r (k, v) values ('follow private profile', 'ALLOWED'); exception when insufficient_privilege then insert into _r (k, v) values ('follow private profile', 'blocked'); end $$;
do $$ begin insert into public.imaket_follows (follower_id, followee_id) values ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a'); insert into _r (k, v) values ('follow on behalf of C', 'ALLOWED'); exception when insufficient_privilege then insert into _r (k, v) values ('follow on behalf of C', 'blocked'); end $$;
insert into _r (k, v) select 'directory as B', string_agg(coalesce(full_name, '?') || coalesce('@' || handle, '') || ' f=' || followers || case when following then '*' else '' end, ', ' order by full_name) || ' total=' || max(total) from public.imaket_member_directory();
insert into _r (k, v) select 'directory search', string_agg(full_name, ',') from public.imaket_member_directory('amara');
do $$ begin perform 1 from public.imaket_platform_coupons; insert into _r (k, v) select 'B reads codes', count(*)::text from public.imaket_platform_coupons; end $$;
update public.imaket_users set public_profile = false, bio = 'hi' where id = auth.uid();
insert into _r (k, v) select 'B updates own profile flags', public_profile::text || '/' || bio from public.imaket_users where id = auth.uid();

-- 7. admin manages codes and reads newsletter
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
update public.imaket_platform_coupons set active = false where code = 'TEES25';
insert into _r (k, v) select 'admin toggles code', code || ' active=' || active from public.imaket_platform_coupons where code = 'TEES25';
insert into _r (k, v) select 'admin sees newsletter', count(*)::text from public.imaket_newsletter_subscribers;
update public.imaket_groups set name = 'iMaket Community (renamed)' where slug = 'imaket-community';
insert into _r (k, v) select 'admin renames group', name from public.imaket_groups where slug = 'imaket-community';

-- 8. deleting a user cascades cleanly
reset role;
delete from auth.users where id = 'b0000000-0000-0000-0000-00000000000b';
insert into _r (k, v) select 'after delete B', string_agg(slug || ' members=' || member_count || ' posts=' || post_count, ', ' order by slug) from public.imaket_groups;

do $$ declare res text; begin
  select string_agg(n || '. ' || k || ': ' || coalesce(v, '∅'), E'\n' order by n) into res from _r;
  raise exception E'COMMUNITY CHECKS\n%', res;
end $$;
