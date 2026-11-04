-- Urban Walk schema. Apply with `supabase db push` or paste into the SQL editor.
-- Sign-in is "Continue with Google" (Auth > Providers > Google); see docs/SUPABASE_SETUP.md.
-- Organisers: grant once per person (service role / SQL editor only):
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"organiser"}'
--   where email = 'organiser@example.org';

-- Supabase convention: extensions live in their own schema, not public
create extension if not exists postgis with schema extensions;
set search_path = public, extensions;

-- app_metadata is only writable server-side, so it is safe to trust in policies
create or replace function is_organiser() returns boolean
language sql stable set search_path = public, extensions as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'organiser';
$$;

-- ---------- event content (admin-managed) ----------
create table if not exists events (
  id text primary key,
  title text not null,
  description text,
  location text,
  start_date timestamptz,
  end_date timestamptz,
  cover_image text,
  config jsonb not null default '{}'::jsonb,       -- same shape as public/data/event.json
  updated_at timestamptz not null default now()
);

create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  geom geometry(LineString, 4326) not null,         -- the KML LineString, unmodified
  distance_m double precision generated always as (st_length(geom::geography)) stored,
  estimated_minutes int
);
create index if not exists routes_event_idx on routes (event_id);

create table if not exists route_segments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  name text not null,
  start_fraction double precision not null check (start_fraction between 0 and 1),
  end_fraction double precision not null check (end_fraction between 0 and 1 and end_fraction > start_fraction),
  sort int not null
);
create index if not exists route_segments_route_idx on route_segments (route_id);

create table if not exists landmarks (
  id text primary key,                              -- KML-derived feature id
  route_id uuid references routes(id) on delete cascade,
  name text not null,
  source_name text,
  category text not null check (category in
    ('official_landmark','supporting_location','rest_area','public_facility','starting_point','ending_point')),
  geom geometry(Point, 4326) not null,
  order_number int,
  description text,
  image text,
  sections jsonb not null default '[]'::jsonb,      -- [{key, body, source}]
  proximity_radius_m int not null default 40
);
create index if not exists landmarks_geom_idx on landmarks using gist (geom);
create index if not exists landmarks_route_idx on landmarks (route_id);

-- ---------- participant content ----------
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('photo','observation')),
  event_id text not null check (char_length(event_id) <= 80),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  user_name text not null default 'Participant' check (char_length(user_name) between 1 and 40),
  landmark_id text check (char_length(landmark_id) <= 120),
  content text not null default '' check (char_length(content) <= 2000),
  -- must live in the uploader's own folder: <event>/<uid>/<file>
  image_path text check (image_path is null or (image_path like event_id || '/' || user_id::text || '/%' and image_path not like '%..%')),
  -- ~480 px version used by the feed and map markers (keeps bandwidth down)
  thumb_path text check (thumb_path is null or (thumb_path like event_id || '/' || user_id::text || '/%' and thumb_path not like '%..%')),
  prompt text check (char_length(prompt) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  accuracy_m double precision check (accuracy_m between 0 and 1000),
  geom geometry(Point, 4326) generated always as
    (case when lat is null or lng is null then null else st_setsrid(st_makepoint(lng, lat), 4326) end) stored,
  created_at timestamptz not null default now()
);
create index if not exists posts_event_idx on posts (event_id, created_at desc);
create index if not exists posts_user_idx on posts (user_id, created_at desc);
create index if not exists posts_geom_idx on posts using gist (geom);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  user_name text not null default 'Participant' check (char_length(user_name) between 1 and 40),
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on comments (post_id, created_at);
create index if not exists comments_user_idx on comments (user_id, created_at desc);

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on post_likes (user_id);

create table if not exists walk_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  event_id text not null check (char_length(event_id) <= 80),
  user_name text not null default 'Participant' check (char_length(user_name) between 1 and 40),
  completed_landmarks text[] not null default '{}' check (cardinality(completed_landmarks) <= 100),
  distance_covered_m double precision not null default 0 check (distance_covered_m between 0 and 100000),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create index if not exists walk_progress_event_idx on walk_progress (event_id, updated_at desc);

-- ---------- geographic helpers ----------
-- Landmarks within radius of a point (proximity, "photos near a landmark").
create or replace function landmarks_near(p_lat double precision, p_lng double precision, p_radius_m double precision)
returns table (id text, name text, distance_m double precision)
language sql stable set search_path = public, extensions as $$
  select l.id, l.name, st_distance(l.geom::geography, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  from landmarks l
  where st_dwithin(l.geom::geography, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m)
  order by 3;
$$;

create or replace function posts_near_landmark(p_landmark text, p_radius_m double precision default 60)
returns setof posts
language sql stable set search_path = public, extensions as $$
  select p.* from posts p join landmarks l on l.id = p_landmark
  where p.geom is not null and st_dwithin(p.geom::geography, l.geom::geography, p_radius_m)
  order by p.created_at desc;
$$;

-- ---------- row level security ----------
-- (select auth.uid()) is evaluated once per query instead of once per row.
alter table events enable row level security;
alter table routes enable row level security;
alter table route_segments enable row level security;
alter table landmarks enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table post_likes enable row level security;
alter table walk_progress enable row level security;

create policy "public read events" on events for select using (true);
create policy "public read routes" on routes for select using (true);
create policy "public read segments" on route_segments for select using (true);
create policy "public read landmarks" on landmarks for select using (true);
-- event/route/landmark writes: service role only (admin tooling), no client policy.

create policy "read posts" on posts for select using (true);
create policy "insert own posts" on posts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "delete own posts" on posts for delete to authenticated
  using ((select auth.uid()) = user_id or (select is_organiser()));

create policy "read comments" on comments for select using (true);
create policy "insert own comments" on comments for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "delete own comments" on comments for delete to authenticated
  using ((select auth.uid()) = user_id or (select is_organiser()));

create policy "read likes" on post_likes for select using (true);
create policy "like as self" on post_likes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "unlike as self" on post_likes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- your own progress; organisers' dashboard reads everyone's (visited stops only, never live location)
create policy "read progress" on walk_progress for select to authenticated
  using ((select auth.uid()) = user_id or (select is_organiser()));
create policy "insert own progress" on walk_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "update own progress" on walk_progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own progress" on walk_progress for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- storage ----------
-- photos only, ≤ 3 MB (the client re-encodes to ≤1600 px WebP/JPEG, typically 150–400 KB).
-- Public bucket: files are served by public URL without any SELECT policy, so none is
-- created — a broad SELECT policy would also let anyone list every file in the bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[2] = (select auth.uid())::text and name ~* '\.(webp|jpe?g)$');
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and ((storage.foldername(name))[2] = (select auth.uid())::text or (select is_organiser())));

-- ---------- spam throttle ----------
-- Anyone with a Google account can join, so cap each user to a sane rate.
create or replace function throttle_writes() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  if tg_table_name = 'posts'
     and (select count(*) from posts where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Too many posts, wait a minute';
  end if;
  if tg_table_name = 'comments'
     and (select count(*) from comments where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 15 then
    raise exception 'Too many comments, wait a minute';
  end if;
  return new;
end $$;
create trigger posts_throttle before insert on posts for each row execute function throttle_writes();
create trigger comments_throttle before insert on comments for each row execute function throttle_writes();
