-- Auto-approve also applies when a creator edits a live product (the editor
-- re-submits with status 'pending_review'). With auto-approve off, behaviour is unchanged.
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

  if new.status in ('published', 'pending_review') then
    if v_auto then
      new.status := 'published';
      new.published_at := coalesce(new.published_at, case when tg_op = 'UPDATE' then old.published_at end, now());
    elsif tg_op = 'INSERT' or old.status <> 'published' then
      new.status := 'pending_review';
    end if;
  elsif new.status = 'rejected' then
    new.status := case when tg_op = 'UPDATE' then old.status else 'draft' end;
  end if;

  -- Without auto-approve, material edits to a live product go back to review
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published' and not v_auto
     and (new.title is distinct from old.title or new.description is distinct from old.description
          or new.cover_url is distinct from old.cover_url) then
    new.status := 'pending_review';
  end if;
  return new;
end $$;

-- Products already waiting while auto-approve is on go live now
do $$ begin
  if coalesce((select (value #>> '{}')::boolean from public.imaket_platform_settings where key = 'auto_approve_products'), false) then
    perform set_config('imaket.system_write', 'on', true);
    update public.imaket_products set status = 'published', published_at = coalesce(published_at, now())
     where status = 'pending_review';
    perform set_config('imaket.system_write', 'off', true);
  end if;
end $$;
