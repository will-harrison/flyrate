-- Migration 0005 — flies, fly_materials, fly_fish_types, fly_photos + owner/confirmed RLS
--
-- Delivers the write side of the phase: the schema a signed-in, email-confirmed
-- user submits into (SUB-01..06) and the RLS that is the ACTUAL authorization
-- boundary (not the Server Action). Consumes public.is_email_confirmed() from
-- migration 0002 (Plan 03) — that helper MUST be live before this migration's
-- flies-insert policy runs against it; `supabase db push` applies 0002 before 0005
-- in filename order (Plan 04 Task 2's consolidated push).
--
-- Design notes:
--   * "Recipe" = fly-level scalar columns (hook_size, thread) + an ordered child
--     table fly_materials (position int, free-text label/material/color) — NOT a
--     jsonb blob and NOT a materials lookup table (01-RESEARCH Pattern 7 / FEATURES:
--     keep material free-text in v1 to minimise submission friction).
--   * Flies are per-submission and NEVER deduplicated (D-03): no uniqueness
--     constraint on name/design; the same pattern submitted twice = two rows.
--   * difficulty is a CHECK-constrained text column (SUB-04), not an enum.
--   * fly_fish_types is a junction (SUB-06 many-to-many, >=1 fish per fly).
--   * fly_photos is a child table (D-04 multiple photos); flies.primary_photo_id
--     selects the user-chosen cover.
--   * RLS enabled in-file for every table (CVE-2025-48757 posture). Public read on
--     all four (anon + authenticated) so Phase 2's public catalog can read them.
--   * flies INSERT WITH CHECK = ownership AND email-confirmed (AUTH-02 DB gate).
--     Child-table writes are gated on ownership of the PARENT fly.
--   * Every auth.uid() wrapped as (select auth.uid()) (RLS perf — State of the Art).

-- ---------------------------------------------------------------------------
-- Table: public.flies
-- ---------------------------------------------------------------------------
create table public.flies (
  id                  uuid primary key default gen_random_uuid(),
  author_id           uuid not null references auth.users (id) on delete cascade,
  name                text not null,
  description         text,
  hook_size           text not null,
  thread              text not null,
  difficulty          text not null
                        check (difficulty in ('beginner', 'intermediate', 'advanced')),
  fly_type_id         uuid not null references public.fly_types (id),
  fly_subcategory_id  uuid not null references public.fly_subcategories (id),
  -- FK to fly_photos added after that table exists (below).
  primary_photo_id    uuid,
  created_at          timestamptz not null default now()
);

create index flies_author_id_idx   on public.flies (author_id);
create index flies_fly_type_id_idx  on public.flies (fly_type_id);
create index flies_created_at_idx   on public.flies (created_at desc);

-- ---------------------------------------------------------------------------
-- Table: public.fly_materials  (ordered recipe rows — SUB-02)
-- ---------------------------------------------------------------------------
create table public.fly_materials (
  id        uuid primary key default gen_random_uuid(),
  fly_id    uuid not null references public.flies (id) on delete cascade,
  position  int  not null default 0,
  label     text not null,
  material  text not null,
  color     text
);

create index fly_materials_fly_id_idx on public.fly_materials (fly_id);

-- ---------------------------------------------------------------------------
-- Table: public.fly_fish_types  (junction — SUB-06)
-- ---------------------------------------------------------------------------
create table public.fly_fish_types (
  fly_id        uuid not null references public.flies (id) on delete cascade,
  fish_type_id  uuid not null references public.fish_types (id),
  primary key (fly_id, fish_type_id)
);

-- ---------------------------------------------------------------------------
-- Table: public.fly_photos  (multi-photo — D-04 / SUB-01)
-- ---------------------------------------------------------------------------
create table public.fly_photos (
  id            uuid primary key default gen_random_uuid(),
  fly_id        uuid not null references public.flies (id) on delete cascade,
  storage_path  text not null,
  position      int  not null default 0
);

create index fly_photos_fly_id_idx on public.fly_photos (fly_id);

-- Now that fly_photos exists, wire flies.primary_photo_id -> fly_photos.id.
-- on delete set null: deleting the cover photo just clears the pointer.
alter table public.flies
  add constraint flies_primary_photo_id_fkey
  foreign key (primary_photo_id) references public.fly_photos (id) on delete set null;

-- ===========================================================================
-- RLS — enabled in-file for every table.
-- ===========================================================================
alter table public.flies          enable row level security;
alter table public.fly_materials  enable row level security;
alter table public.fly_fish_types enable row level security;
alter table public.fly_photos     enable row level security;

-- --- Public read (anon + authenticated) on all four -----------------------
create policy "flies are publicly readable"
  on public.flies for select to anon, authenticated using (true);

create policy "fly_materials are publicly readable"
  on public.fly_materials for select to anon, authenticated using (true);

create policy "fly_fish_types are publicly readable"
  on public.fly_fish_types for select to anon, authenticated using (true);

create policy "fly_photos are publicly readable"
  on public.fly_photos for select to anon, authenticated using (true);

-- --- flies: owner + email-confirmed insert (AUTH-02 DB gate) ---------------
create policy "confirmed users insert own flies"
  on public.flies for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and public.is_email_confirmed()
  );

create policy "authors update own flies"
  on public.flies for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "authors delete own flies"
  on public.flies for delete to authenticated
  using ((select auth.uid()) = author_id);

-- --- Child tables: writes gated on ownership of the parent fly -------------
-- fly_materials
create policy "authors insert own fly materials"
  on public.fly_materials for insert to authenticated
  with check (
    (select auth.uid()) = (select f.author_id from public.flies f where f.id = fly_id)
  );

create policy "authors update own fly materials"
  on public.fly_materials for update to authenticated
  using (
    (select auth.uid()) = (select f.author_id from public.flies f where f.id = fly_id)
  )
  with check (
    (select auth.uid()) = (select f.author_id from public.flies f where f.id = fly_id)
  );

create policy "authors delete own fly materials"
  on public.fly_materials for delete to authenticated
  using (
    (select auth.uid()) = (select f.author_id from public.flies f where f.id = fly_id)
  );

-- fly_fish_types
create policy "authors insert own fly fish types"
  on public.fly_fish_types for insert to authenticated
  with check (
    (select auth.uid()) = (select f.author_id from public.flies f where f.id = fly_id)
  );

create policy "authors delete own fly fish types"
  on public.fly_fish_types for delete to authenticated
  using (
    (select auth.uid()) = (select f.author_id from public.flies f where f.id = fly_id)
  );

-- fly_photos
create policy "authors insert own fly photos"
  on public.fly_photos for insert to authenticated
  with check (
    (select auth.uid()) = (select f.author_id from public.flies f where f.id = fly_id)
  );

create policy "authors update own fly photos"
  on public.fly_photos for update to authenticated
  using (
    (select auth.uid()) = (select f.author_id from public.flies f where f.id = fly_id)
  )
  with check (
    (select auth.uid()) = (select f.author_id from public.flies f where f.id = fly_id)
  );

create policy "authors delete own fly photos"
  on public.fly_photos for delete to authenticated
  using (
    (select auth.uid()) = (select f.author_id from public.flies f where f.id = fly_id)
  );
