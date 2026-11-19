begin;
-- Trusted approval now checks the caller in SQL; no service key is required.
create function public.imaket_review_creator(creator_uuid uuid, decision text) returns void language plpgsql security definer set search_path='' as $$
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
revoke all on function public.imaket_review_creator(uuid,text) from public,anon;
grant execute on function public.imaket_review_creator(uuid,text) to authenticated;
-- Purchased files remain private. Only the owner or a paid customer can sign access.
create policy imaket_paid_file_read on storage.objects for select to authenticated using(bucket_id='imaket-product-files' and exists(select 1 from public.imaket_products p where p.file_path=name and imaket_private.has_purchase(p.id)));
grant insert(user_id,product_id,order_id) on public.imaket_downloads to authenticated;
create policy imaket_record_download on public.imaket_downloads for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.imaket_order_items i join public.imaket_orders o on o.id=i.order_id where i.product_id=imaket_downloads.product_id and o.id=imaket_downloads.order_id and o.customer_id=(select auth.uid()) and o.status='paid'));
create table public.imaket_reports(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.imaket_users(id),listing text not null check(length(listing) between 1 and 1000),reason text not null check(length(reason) between 1 and 100),details text not null check(length(details) between 1 and 3000),status text not null default 'open' check(status in ('open','resolved')),created_at timestamptz not null default now());
alter table public.imaket_reports enable row level security;
grant select on public.imaket_reports to authenticated;
grant insert(user_id,listing,reason,details) on public.imaket_reports to authenticated;
grant update(status) on public.imaket_reports to authenticated;
create policy imaket_report_read on public.imaket_reports for select to authenticated using(user_id=(select auth.uid()) or (select imaket_private.is_admin()));
create policy imaket_report_insert on public.imaket_reports for insert to authenticated with check(user_id=(select auth.uid()));
create policy imaket_report_review on public.imaket_reports for update to authenticated using((select imaket_private.is_admin())) with check((select imaket_private.is_admin()));
create index imaket_reports_user_idx on public.imaket_reports(user_id);
create index imaket_reports_open_idx on public.imaket_reports(created_at desc) where status='open';
-- Creator-supplied public images. SVG and executables are not accepted.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('imaket-covers','imaket-covers',true,3145728,array['image/png','image/jpeg','image/webp']);
create policy imaket_cover_upload on storage.objects for insert to authenticated with check(bucket_id='imaket-covers' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.imaket_creators c where c.user_id=(select auth.uid()) and c.status='active'));
create policy imaket_cover_delete on storage.objects for delete to authenticated using(bucket_id='imaket-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy imaket_cover_read on storage.objects for select to anon,authenticated using(bucket_id='imaket-covers');

-- Keep purchased products visible when a creator later archives the listing.
create policy imaket_purchased_product on public.imaket_products for select to authenticated using(imaket_private.has_purchase(id));
revoke update on public.imaket_coupons from authenticated;
grant update(code,percent_off,max_uses,expires_at,active) on public.imaket_coupons to authenticated;



create function public.imaket_check_coupon(coupon_code text, store_slug text) returns table(percent_off integer) language sql stable security definer set search_path='' as $$
 select c.percent_off from public.imaket_coupons c join public.imaket_creators cr on cr.id=c.creator_id where c.code=upper(coupon_code) and cr.slug=store_slug and cr.status='active' and c.active and (c.expires_at is null or c.expires_at>now()) and (c.max_uses is null or c.uses<c.max_uses) limit 1
$$;
revoke all on function public.imaket_check_coupon(text,text) from public;
grant execute on function public.imaket_check_coupon(text,text) to anon,authenticated;
revoke insert on public.imaket_coupons from authenticated;
grant insert(creator_id,code,percent_off,max_uses,expires_at,active) on public.imaket_coupons to authenticated;


grant update(approved) on public.imaket_reviews to authenticated;
create policy imaket_review_moderation on public.imaket_reviews for update to authenticated using((select imaket_private.is_admin())) with check((select imaket_private.is_admin()));
commit;
