-- Migration 0003 — taxonomy lookup TABLES (fly_types, fly_subcategories, fish_types)
--
-- Delivers the read side of TAX-01: fly types, subcategories and target fish come
-- from predefined, admin-managed lookup tables — NOT Postgres enums (CLAUDE.md
-- "What NOT to Use": enums can't be governed by RLS and changing one requires a
-- migration + lock; the taxonomy is explicitly evolving/admin-approved, so it must
-- be a normal, RLS-governable table). Seed rows land in 0004.
--
-- Design notes (see 01-CONTEXT D-05/D-06/D-07, 01-RESEARCH Pitfall 3):
--   * fly_subcategories.fly_type_id is a single FK — each subcategory belongs to
--     exactly ONE fly_type (the submit form's cascade depends on this; Pitfall 3).
--     unique(fly_type_id, name) keeps names unambiguous within a type.
--   * RLS is enabled in THIS migration (the one that creates each table), never a
--     follow-up — CVE-2025-48757 class of bug (CLAUDE.md RLS posture).
--   * Public read only: anon + authenticated may SELECT (the submit form and the
--     future public catalog read these). There is deliberately NO client
--     insert/update/delete policy this phase — the taxonomy is admin-managed
--     (TAX-01); rows are added only by seed migrations or, later, admin tooling.

-- ---------------------------------------------------------------------------
-- Table: public.fly_types  (6 top-level types, D-06)
-- ---------------------------------------------------------------------------
create table public.fly_types (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  slug      text not null unique,
  position  int  not null default 0
);

-- ---------------------------------------------------------------------------
-- Table: public.fly_subcategories  (belongs to exactly one fly_type — Pitfall 3)
-- ---------------------------------------------------------------------------
create table public.fly_subcategories (
  id           uuid primary key default gen_random_uuid(),
  fly_type_id  uuid not null references public.fly_types (id) on delete cascade,
  name         text not null,
  slug         text not null,
  position     int  not null default 0,
  unique (fly_type_id, name),
  unique (fly_type_id, slug)
);

create index fly_subcategories_fly_type_id_idx
  on public.fly_subcategories (fly_type_id);

-- ---------------------------------------------------------------------------
-- Table: public.fish_types  (~12 species-level rows, D-05)
-- ---------------------------------------------------------------------------
create table public.fish_types (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  slug      text not null unique,
  position  int  not null default 0
);

-- ---------------------------------------------------------------------------
-- RLS — enabled in-file for every table; public read, no client write path.
-- ---------------------------------------------------------------------------
alter table public.fly_types         enable row level security;
alter table public.fly_subcategories enable row level security;
alter table public.fish_types        enable row level security;

create policy "fly_types are publicly readable"
  on public.fly_types
  for select
  to anon, authenticated
  using (true);

create policy "fly_subcategories are publicly readable"
  on public.fly_subcategories
  for select
  to anon, authenticated
  using (true);

create policy "fish_types are publicly readable"
  on public.fish_types
  for select
  to anon, authenticated
  using (true);
