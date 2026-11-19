begin;
create table public.imaket_events(product_id uuid primary key references public.imaket_products(id) on delete cascade,creator_id uuid not null references public.imaket_creators(id),starts_at timestamptz not null,ends_at timestamptz not null,venue text not null check(length(venue) between 1 and 400),instructions text not null default '' check(length(instructions)<=3000),cancelled boolean not null default false,check(ends_at>starts_at));
alter table public.imaket_events enable row level security;
revoke all on public.imaket_events from anon,authenticated;
grant select on public.imaket_events to anon,authenticated;
grant insert,update on public.imaket_events to authenticated;
create policy event_public on public.imaket_events for select to anon using(exists(select 1 from public.imaket_products p where p.id=product_id and p.status='published'));
create policy event_visible on public.imaket_events for select to authenticated using(imaket_private.owns_creator(creator_id) or exists(select 1 from public.imaket_products p where p.id=product_id and p.status='published') or imaket_private.has_purchase(product_id));
create policy event_insert on public.imaket_events for insert to authenticated with check(imaket_private.creator_can_sell(creator_id) and exists(select 1 from public.imaket_products p where p.id=product_id and p.creator_id=imaket_events.creator_id and p.type='Event ticket'));
create policy event_edit on public.imaket_events for update to authenticated using(imaket_private.owns_creator(creator_id)) with check(imaket_private.creator_can_sell(creator_id) and exists(select 1 from public.imaket_products p where p.id=product_id and p.creator_id=imaket_events.creator_id and p.type='Event ticket'));
create index imaket_events_creator_idx on public.imaket_events(creator_id);
create table public.imaket_tickets(id uuid primary key default gen_random_uuid(),order_item_id uuid not null references public.imaket_order_items(id),product_id uuid not null references public.imaket_events(product_id),creator_id uuid not null references public.imaket_creators(id),customer_id uuid not null references public.imaket_users(id),sequence integer not null check(sequence>0),token uuid not null unique default gen_random_uuid(),checked_in_at timestamptz,checked_in_by uuid references public.imaket_users(id),created_at timestamptz not null default now(),unique(order_item_id,sequence));
alter table public.imaket_tickets enable row level security;
revoke all on public.imaket_tickets from anon,authenticated;
grant select on public.imaket_tickets to authenticated;
create policy ticket_read on public.imaket_tickets for select to authenticated using(customer_id=(select auth.uid()) or imaket_private.owns_creator(creator_id));
create index imaket_tickets_product_idx on public.imaket_tickets(product_id);
create index imaket_tickets_customer_idx on public.imaket_tickets(customer_id);
create index imaket_tickets_creator_idx on public.imaket_tickets(creator_id);
create function imaket_private.issue_tickets(p_product uuid) returns integer language plpgsql security definer set search_path='' as $$
declare added integer;
begin
 if auth.uid() is null then raise exception 'sign in required'; end if;
 insert into public.imaket_tickets(order_item_id,product_id,creator_id,customer_id,sequence)
 select i.id,i.product_id,i.creator_id,o.customer_id,n from public.imaket_order_items i join public.imaket_orders o on o.id=i.order_id join public.imaket_events e on e.product_id=i.product_id join public.imaket_products p on p.id=i.product_id cross join lateral generate_series(1,i.quantity) n
 where i.product_id=p_product and o.customer_id=auth.uid() and o.status='paid' and p.type='Event ticket' and not e.cancelled on conflict(order_item_id,sequence) do nothing;
 get diagnostics added=row_count; return added;
end $$;
revoke all on function imaket_private.issue_tickets(uuid) from public,anon;
grant execute on function imaket_private.issue_tickets(uuid) to authenticated;
create function public.imaket_issue_tickets(p_product uuid) returns integer language sql security invoker set search_path='' as $$select imaket_private.issue_tickets(p_product)$$;
revoke all on function public.imaket_issue_tickets(uuid) from public,anon;
grant execute on function public.imaket_issue_tickets(uuid) to authenticated;
create function imaket_private.check_ticket(p_token uuid,p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.imaket_tickets; valid_order boolean; event_cancelled boolean;
begin
 select * into t from public.imaket_tickets where token=p_token for update;
 if t.id is null or not imaket_private.creator_can_sell(t.creator_id) then raise exception 'ticket not available for this creator';end if;
 select o.status='paid' into valid_order from public.imaket_order_items i join public.imaket_orders o on o.id=i.order_id where i.id=t.order_item_id for update of o;
 select cancelled into event_cancelled from public.imaket_events where product_id=t.product_id for update;
 if not valid_order or event_cancelled then raise exception 'ticket is not valid for admission';end if;
 if p_confirm and t.checked_in_at is null then update public.imaket_tickets set checked_in_at=now(),checked_in_by=auth.uid() where id=t.id returning * into t;end if;
 return jsonb_build_object('id',t.id,'product_id',t.product_id,'sequence',t.sequence,'checked_in_at',t.checked_in_at);
end $$;
revoke all on function imaket_private.check_ticket(uuid,boolean) from public,anon;
grant execute on function imaket_private.check_ticket(uuid,boolean) to authenticated;
create function public.imaket_check_ticket(p_token uuid,p_confirm boolean) returns jsonb language sql security invoker set search_path='' as $$select imaket_private.check_ticket(p_token,p_confirm)$$;
revoke all on function public.imaket_check_ticket(uuid,boolean) from public,anon;
grant execute on function public.imaket_check_ticket(uuid,boolean) to authenticated;
create table public.imaket_services(product_id uuid primary key references public.imaket_products(id) on delete cascade,creator_id uuid not null references public.imaket_creators(id),duration_minutes integer not null check(duration_minutes between 15 and 480),booking_instructions text not null default '' check(length(booking_instructions)<=3000),minimum_notice_hours integer not null default 24 check(minimum_notice_hours between 0 and 720),accepting_requests boolean not null default true);
alter table public.imaket_services enable row level security;
revoke all on public.imaket_services from anon,authenticated;
grant select on public.imaket_services to anon,authenticated;
grant insert,update on public.imaket_services to authenticated;
create policy service_public on public.imaket_services for select to anon using(exists(select 1 from public.imaket_products p where p.id=product_id and p.status='published'));
create policy service_visible on public.imaket_services for select to authenticated using(imaket_private.owns_creator(creator_id) or exists(select 1 from public.imaket_products p where p.id=product_id and p.status='published'));
create policy service_insert on public.imaket_services for insert to authenticated with check(imaket_private.creator_can_sell(creator_id) and exists(select 1 from public.imaket_products p where p.id=product_id and p.creator_id=imaket_services.creator_id and p.type='Service'));
create policy service_edit on public.imaket_services for update to authenticated using(imaket_private.owns_creator(creator_id)) with check(imaket_private.creator_can_sell(creator_id) and exists(select 1 from public.imaket_products p where p.id=product_id and p.creator_id=imaket_services.creator_id and p.type='Service'));
create index imaket_services_creator_idx on public.imaket_services(creator_id);
create table public.imaket_bookings(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.imaket_services(product_id),creator_id uuid not null references public.imaket_creators(id),customer_id uuid not null references public.imaket_users(id),starts_at timestamptz not null,ends_at timestamptz not null,note text not null default '' check(length(note)<=2000),creator_note text not null default '' check(length(creator_note)<=2000),status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','completed')),created_at timestamptz not null default now(),check(ends_at>starts_at));
alter table public.imaket_bookings enable row level security;
revoke all on public.imaket_bookings from anon,authenticated;
grant select on public.imaket_bookings to authenticated;
create policy booking_read on public.imaket_bookings for select to authenticated using(customer_id=(select auth.uid()) or imaket_private.owns_creator(creator_id));
create index imaket_bookings_creator_time_idx on public.imaket_bookings(creator_id,starts_at,ends_at);
create index imaket_bookings_customer_idx on public.imaket_bookings(customer_id);
create index imaket_bookings_product_idx on public.imaket_bookings(product_id);
create unique index imaket_booking_active_request_idx on public.imaket_bookings(product_id,customer_id,starts_at) where status in ('pending','accepted');
create function imaket_private.request_booking(p_product uuid,p_start timestamptz,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
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
revoke all on function imaket_private.request_booking(uuid,timestamptz,text) from public,anon;
grant execute on function imaket_private.request_booking(uuid,timestamptz,text) to authenticated;
create function public.imaket_request_booking(p_product uuid,p_start timestamptz,p_note text) returns uuid language sql security invoker set search_path='' as $$select imaket_private.request_booking(p_product,p_start,p_note)$$;
revoke all on function public.imaket_request_booking(uuid,timestamptz,text) from public,anon;
grant execute on function public.imaket_request_booking(uuid,timestamptz,text) to authenticated;
create function imaket_private.update_booking(p_booking uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
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
revoke all on function imaket_private.update_booking(uuid,text,text) from public,anon;
grant execute on function imaket_private.update_booking(uuid,text,text) to authenticated;
create function public.imaket_update_booking(p_booking uuid,p_status text,p_note text) returns void language sql security invoker set search_path='' as $$select imaket_private.update_booking(p_booking,p_status,p_note)$$;
revoke all on function public.imaket_update_booking(uuid,text,text) from public,anon;
grant execute on function public.imaket_update_booking(uuid,text,text) to authenticated;
commit;
