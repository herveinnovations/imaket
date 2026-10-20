-- Seed categories. Run after migrations:  supabase db reset  (local)
-- or paste into the Supabase SQL editor.
insert into public.categories (slug, name, icon, sort_order) values
  ('ebooks',        'E-books & Guides',     'BookOpen',     1),
  ('courses',       'Online Courses',       'GraduationCap',2),
  ('templates',     'Templates & Presets',  'LayoutTemplate',3),
  ('music',         'Music & Audio',        'Music',        4),
  ('design',        'Design Assets',        'Palette',      5),
  ('coaching',      'Coaching & Services',  'Handshake',    6),
  ('events',        'Events & Tickets',     'Ticket',       7),
  ('fashion',       'Fashion & Merch',      'Shirt',        8),
  ('beauty',        'Beauty & Wellness',    'Sparkles',     9),
  ('software',      'Software & Tools',     'Code',        10),
  ('photography',   'Photography',          'Camera',      11),
  ('business',      'Business & Finance',   'Briefcase',   12)
on conflict (slug) do nothing;

-- To make yourself an admin after signing up:
--   update public.users set role = 'admin' where email = 'you@example.com';
