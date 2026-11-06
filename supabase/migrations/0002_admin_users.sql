-- Organiser user management (/admin → Users).
-- auth.users is not reachable from the browser, so these run as SECURITY DEFINER.
-- Every function checks is_organiser() first (app_metadata, server-writable only),
-- runs with an empty search_path, and is callable by signed-in users only.

create or replace function admin_list_users()
returns table (
  id uuid, email text, name text, avatar_url text, role text,
  created_at timestamptz, last_sign_in_at timestamptz, blocked boolean,
  posts bigint, visited integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_organiser() then
    raise exception 'Organisers only' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    u.email::text,
    coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name', '')::text,
    coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')::text,
    coalesce(u.raw_app_meta_data ->> 'role', 'participant')::text,
    u.created_at,
    u.last_sign_in_at,
    coalesce(u.banned_until > now(), false),
    (select count(*) from public.posts p where p.user_id = u.id),
    (select coalesce(max(cardinality(w.completed_landmarks)), 0)::integer from public.walk_progress w where w.user_id = u.id)
  from auth.users u
  order by u.created_at desc
  limit 2000;
end;
$$;

-- Grant or remove the organiser role. Takes effect when that person next signs in
-- (or within the hour, when their session token refreshes).
create or replace function admin_set_organiser(target uuid, make_organiser boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_organiser() then
    raise exception 'Organisers only' using errcode = '42501';
  end if;
  if target = auth.uid() and not make_organiser then
    raise exception 'You can''t remove your own organiser role' using errcode = '42501';
  end if;
  update auth.users
  set raw_app_meta_data = case
    when make_organiser then coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"organiser"}'::jsonb
    else coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
  end
  where id = target;
end;
$$;

-- Block = can't sign in again, and every session is revoked (they're signed out
-- within the hour, when the current token expires). Unblock reverses it.
create or replace function admin_set_blocked(target uuid, block boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_organiser() then
    raise exception 'Organisers only' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'You can''t block yourself' using errcode = '42501';
  end if;
  if block and exists (select 1 from auth.users where id = target and raw_app_meta_data ->> 'role' = 'organiser') then
    raise exception 'Remove the organiser role before blocking this account' using errcode = '42501';
  end if;
  update auth.users set banned_until = case when block then 'infinity'::timestamptz else null end where id = target;
  if block then
    delete from auth.sessions where user_id = target;
  end if;
end;
$$;

-- Delete an account. Their posts, comments, likes and progress go with it (FK cascade).
-- The app removes their photo files from storage first.
create or replace function admin_delete_user(target uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_organiser() then
    raise exception 'Organisers only' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'You can''t delete your own account here' using errcode = '42501';
  end if;
  if exists (select 1 from auth.users where id = target and raw_app_meta_data ->> 'role' = 'organiser') then
    raise exception 'Remove the organiser role before deleting this account' using errcode = '42501';
  end if;
  delete from auth.users where id = target;
end;
$$;

revoke all on function admin_list_users() from public, anon;
revoke all on function admin_set_organiser(uuid, boolean) from public, anon;
revoke all on function admin_set_blocked(uuid, boolean) from public, anon;
revoke all on function admin_delete_user(uuid) from public, anon;
grant execute on function admin_list_users() to authenticated;
grant execute on function admin_set_organiser(uuid, boolean) to authenticated;
grant execute on function admin_set_blocked(uuid, boolean) to authenticated;
grant execute on function admin_delete_user(uuid) to authenticated;
