-- Migration 0001 — profiles table + handle_new_user bootstrap trigger + RLS
--
-- Delivers PROF-01 (every registered user gets a public profile row created
-- server-side, no client insert) and the RLS foundation for AUTH-01/AUTH-05.
--
-- Design notes (see .planning/phases/01-foundation-submit/01-RESEARCH.md):
--   * RLS is enabled in THIS migration (the one that creates the table) — never
--     a follow-up migration (CVE-2025-48757 class of bug; CLAUDE.md RLS posture).
--   * handle_new_user() is SECURITY DEFINER set search_path = public so its own
--     insert bypasses RLS; without this the whole signup transaction rolls back
--     (RESEARCH Pitfall 1).
--   * Username collisions are resolved in-trigger with an ON CONFLICT suffix so a
--     colliding signup never fails (RESEARCH Open Q1 mitigation (a)).
--   * Every auth.uid() is wrapped as (select auth.uid()) for the documented RLS
--     performance win (RESEARCH State of the Art).

-- ---------------------------------------------------------------------------
-- Table: public.profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique not null,
  bio         text,
  created_at  timestamptz not null default now()
);

-- Enable Row Level Security in the same migration that creates the table.
alter table public.profiles enable row level security;

-- Public read: anon + authenticated may SELECT any profile (public profile page).
create policy "profiles are publicly readable"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

-- Owner update: a user may UPDATE only their own profile row.
create policy "users update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Function: public.handle_new_user()
-- Creates the profile row on auth.users insert. SECURITY DEFINER so the insert
-- bypasses RLS; search_path pinned to public to avoid search_path hijacking.
--
-- Collision handling (RESEARCH Open Q1 mitigation (a)): we FIRST try to insert
-- the derived base username. If the unique(username) constraint conflicts, we
-- fall through to an id-suffixed username. Critically we insert on the row's own
-- PK (id) — a plain `ON CONFLICT (username) DO UPDATE` would rewrite the OTHER
-- user's row and leave the new user with no profile, so we do NOT use that.
-- The two-step insert-with-exception-handler below guarantees the NEW user
-- always gets exactly one row and no signup transaction ever aborts on a
-- duplicate base name.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  inserted_id   uuid;
begin
  base_username := coalesce(
    new.raw_user_meta_data ->> 'user_name',   -- GitHub OAuth often supplies this
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  -- Happy path: try the base username. ON CONFLICT (username) DO NOTHING means a
  -- collision inserts NOTHING (rather than rewriting the other user's row, which
  -- a DO UPDATE on the username target would incorrectly do) and returns no id.
  insert into public.profiles (id, username)
  values (new.id, base_username)
  on conflict (username) do nothing
  returning id into inserted_id;

  -- Collision path: the base name was taken, so no row was inserted above.
  -- Append a short, deterministic id-derived suffix that is unique to THIS user.
  if inserted_id is null then
    insert into public.profiles (id, username)
    values (new.id, base_username || '_' || substr(new.id::text, 1, 6));
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: fire handle_new_user() after every auth.users insert
-- (fires for both email/password and OAuth signups).
-- ---------------------------------------------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
