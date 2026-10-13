-- Run in Supabase: SQL Editor > New query > paste > Run.
create extension if not exists pgcrypto;

-- ---------- Administrators (only way in: add a row via SQL editor / service role) ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
create policy "admins read own row" on public.admins for select to authenticated using (user_id = auth.uid());
-- No insert/update/delete policies: clients can never grant themselves admin.

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.touch() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;

-- ---------- Categories ----------
create table if not exists public.categories (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  label text not null,
  description text not null default '',
  preview_path text,
  sort_order int not null default 0,
  visible boolean not null default true,
  subcategories jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_touch before update on public.categories for each row execute function public.touch();

-- ---------- Projects ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id text not null references public.categories(slug) on update cascade on delete restrict,
  subcategory text,
  media_type text not null check (media_type in ('image','video','website','application','prototype')),
  src_path text,
  thumb_path text,
  aspect_ratio numeric,
  description text,
  tags text[] not null default '{}',
  year int,
  featured boolean not null default false,
  published boolean not null default true,
  sort_order int not null default 0,
  project_url text check (project_url is null or project_url ~* '^https?://'),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_type in ('website','application','prototype') or src_path is not null)
);
create index if not exists projects_cat_idx on public.projects (category_id, sort_order);
create trigger projects_touch before update on public.projects for each row execute function public.touch();

alter table public.categories enable row level security;
alter table public.projects enable row level security;

create policy "public reads visible categories" on public.categories for select to anon, authenticated using (visible);
create policy "admin manages categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads published projects" on public.projects for select to anon, authenticated
  using (published and exists (select 1 from public.categories c where c.slug = category_id and c.visible));
create policy "admin manages projects" on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "portfolio admin read"   on storage.objects for select to authenticated using (bucket_id = 'portfolio' and public.is_admin());
create policy "portfolio admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and public.is_admin());
create policy "portfolio admin update" on storage.objects for update to authenticated using (bucket_id = 'portfolio' and public.is_admin()) with check (bucket_id = 'portfolio' and public.is_admin());
create policy "portfolio admin delete" on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and public.is_admin());

-- ---------- Starter categories (edit later in the dashboard) ----------
insert into public.categories (slug, label, description, sort_order, subcategories) values
 ('graphics','Graphics & Branding','Posters, flyers, social designs, identities, logos',0,'[{"id":"posters","label":"Posters"},{"id":"branding","label":"Branding"},{"id":"social-media","label":"Social Media"},{"id":"other-graphics","label":"Other Graphics"}]'),
 ('video','Video & Motion','Promos, edits, reels, motion graphics, animation',1,'[{"id":"motion-graphics","label":"Motion Graphics"},{"id":"promotional","label":"Promotional Videos"},{"id":"reels","label":"Reels"},{"id":"animations","label":"Animations"}]'),
 ('websites','Websites','Business sites, landing pages, e-commerce, web apps',2,'[{"id":"business","label":"Business"},{"id":"ecommerce","label":"E-commerce"},{"id":"landing-pages","label":"Landing Pages"},{"id":"web-apps","label":"Web Applications"}]'),
 ('uiux','UI/UX & Portfolios','Interfaces, dashboards, prototypes, portfolio sites',3,'[{"id":"web-design","label":"Web Design"},{"id":"mobile-design","label":"Mobile Design"},{"id":"portfolios","label":"Portfolios"},{"id":"prototypes","label":"Prototypes"}]'),
 ('apps','Mini Apps','Small tools, calculators, demos',4,'[{"id":"utilities","label":"Utilities"},{"id":"productivity","label":"Productivity"},{"id":"interactive-demos","label":"Interactive Demos"}]'),
 ('technical','Technical & Engineering','Embedded, robotics, IoT, automation',5,'[{"id":"embedded","label":"Embedded"},{"id":"robotics","label":"Robotics"},{"id":"iot","label":"IoT"},{"id":"automation","label":"Automation"}]'),
 ('other','Other Creative Work','Experiments and miscellaneous creations',6,'[{"id":"experiments","label":"Experiments"}]')
on conflict (slug) do nothing;
