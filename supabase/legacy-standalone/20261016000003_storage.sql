-- ════════════════════════════════════════════════════════════════════
-- Storage buckets
--   public-assets  : covers, gallery, avatars, banners  (public read)
--   product-files  : paid deliverables, course videos   (PRIVATE)
-- Path convention: <creator_id>/<anything>  — enforced below.
-- ════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-assets', 'public-assets', true, 10485760,               -- 10 MB
     array['image/png','image/jpeg','image/webp','image/gif','image/avif']),
  ('product-files', 'product-files', false, 2147483648,            -- 2 GB
     null)
on conflict (id) do nothing;

-- public-assets
create policy "public-assets: anyone read" on storage.objects for select
  using (bucket_id = 'public-assets');

create policy "public-assets: creator upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets'
              and (storage.foldername(name))[1] in (public.current_creator_id()::text, auth.uid()::text));

create policy "public-assets: creator update own" on storage.objects for update to authenticated
  using (bucket_id = 'public-assets'
         and (storage.foldername(name))[1] in (public.current_creator_id()::text, auth.uid()::text));

create policy "public-assets: creator delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'public-assets'
         and (storage.foldername(name))[1] in (public.current_creator_id()::text, auth.uid()::text));

-- product-files (private). Buyers never get a policy; the server signs URLs.
create policy "product-files: creator read own" on storage.objects for select to authenticated
  using (bucket_id = 'product-files' and (storage.foldername(name))[1] = public.current_creator_id()::text);

create policy "product-files: creator upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-files' and (storage.foldername(name))[1] = public.current_creator_id()::text);

create policy "product-files: creator delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'product-files' and (storage.foldername(name))[1] = public.current_creator_id()::text);
