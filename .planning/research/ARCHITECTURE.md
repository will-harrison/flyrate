# Architecture Research

**Domain:** Community rating/catalog web app (fly-tying) — React SPA + Supabase (Postgres, Auth, Storage, RLS, auto-generated REST/Realtime)
**Researched:** 2026-07-01
**Confidence:** HIGH (schema/RLS/leaderboard patterns are well-established Supabase idioms; specific policy-performance and Storage details cross-checked against current Supabase docs 2025)

## Executive Take

Build Flyrate as a **thin-client React SPA talking directly to Supabase's auto-generated PostgREST API**, with **the database as the application server**. Almost all business rules — access control, the "no self-rating" invariant, rating aggregation, moderation gates — belong in **Postgres (RLS policies + triggers + a few SECURITY DEFINER functions)**, not in a separate Node server. Reach for **Edge Functions only** for the narrow set of things RLS/triggers can't express well (see decision table). This keeps the surface small, avoids a bespoke API tier, and lets the auto-generated API do the CRUD work.

The single most important architectural decision is **where the rating aggregate lives**: use **trigger-maintained denormalized columns** (`rating_count`, `rating_sum`, plus a computed Bayesian score) on the `flies` row. This gives always-fresh leaderboards with cheap indexed reads and keeps the write path (rating a fly) authoritative in one trigger.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React SPA)                            │
│                                                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │  Browse/ │ │  Fly     │ │ Submit   │ │  Leader- │ │  Profile / │  │
│  │  Search  │ │  Detail  │ │  Fly     │ │  boards  │ │  Admin     │  │
│  │  (anon)  │ │ +Rating  │ │ (auth)   │ │  (anon)  │ │  Console   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
│       │            │            │            │             │          │
│  ┌────┴────────────┴────────────┴────────────┴─────────────┴──────┐  │
│  │  Data layer: supabase-js client  (TanStack Query cache)         │  │
│  │  session (JWT) + auto-refresh, RLS-scoped reads/writes          │  │
│  └───┬───────────────────┬────────────────────────┬───────────────┘  │
└──────┼───────────────────┼────────────────────────┼──────────────────┘
       │ PostgREST (REST)  │ Auth (GoTrue)          │ Storage API
       │ + Realtime (ws)   │ email/pw + OAuth       │ fly-photos bucket
┌──────┼───────────────────┼────────────────────────┼──────────────────┐
│      ▼                    ▼                        ▼    SUPABASE       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                     POSTGRES (the app server)                    │  │
│  │                                                                  │  │
│  │  Tables ── RLS policies (anon read / auth write / admin mod)     │  │
│  │  Triggers:  rating change → recompute fly aggregates             │  │
│  │             auth.users insert → create profiles row              │  │
│  │             category approval → publish taxonomy row             │  │
│  │  Functions: is_admin() [SECURITY DEFINER],  bayesian_score()     │  │
│  │  Views:     leaderboard views (fly + fish + category)            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────┐   ┌───────────────────────────────────────┐    │
│  │  Edge Functions  │   │  Storage: fly-photos (public bucket)   │    │
│  │  (only if needed)│   │  path: <user_id>/<fly_id>/<file>       │    │
│  └──────────────────┘   └───────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React SPA (feature routes) | Rendering, form UX, optimistic updates, client-side filter/sort state | Vite + React Router; feature-folder layout |
| supabase-js data layer | One shared client; wraps auth session + typed queries; all reads/writes go through it | `@supabase/supabase-js`; wrapped in TanStack Query hooks |
| PostgREST (auto API) | CRUD over tables/views as REST; enforces RLS on every request | Provided by Supabase — no code |
| Postgres schema + RLS | Source of truth; access control; data integrity (unique constraints, FKs) | SQL migrations |
| Triggers + functions | Rating aggregation, profile bootstrap, taxonomy publish, `is_admin()` | plpgsql; SECURITY DEFINER where crossing RLS |
| Leaderboard views | Serve ranked flies (global / per-fly-type / per-fish) sorted by Bayesian score | SQL views over the aggregate columns |
| Supabase Auth (GoTrue) | Email/password + Google/GitHub OAuth, JWT issuance/refresh | supabase-js `auth.*`; providers configured in dashboard |
| Supabase Storage | Fly photo binary storage + public CDN URLs | Public bucket + RLS on `storage.objects` |
| Edge Functions (optional) | Only non-RLS-expressible logic (e.g. image post-processing, external notifications) | Deno functions; invoked from client or DB webhook |

**Boundary rule:** the client never holds privileged logic. Anything a malicious client could abuse (who can rate, who can moderate, what a rating aggregates to) is enforced in Postgres. The `service_role` key never ships to the browser.

## Recommended Project Structure

```
flyrate/
├── supabase/
│   ├── migrations/          # ordered SQL: schema, RLS, triggers, views, seed taxonomy
│   │   ├── 0001_core_tables.sql
│   │   ├── 0002_taxonomy.sql
│   │   ├── 0003_ratings_and_aggregates.sql
│   │   ├── 0004_rls_policies.sql
│   │   ├── 0005_leaderboard_views.sql
│   │   └── 0006_storage_and_moderation.sql
│   ├── functions/           # Edge Functions (only if/when needed)
│   └── seed.sql             # dev taxonomy + admin bootstrap
├── src/
│   ├── lib/
│   │   ├── supabase.ts      # single client instance (anon key, session persist)
│   │   └── queries/         # typed query/mutation hooks per entity
│   ├── features/
│   │   ├── auth/            # sign-in/up, OAuth buttons, session context/provider
│   │   ├── browse/          # search + filters (fly type / subcategory / fish)
│   │   ├── fly/             # fly detail, photo gallery, rating widget, recipe view
│   │   ├── submit/          # submission form (photos, recipe, difficulty, taxonomy)
│   │   ├── leaderboards/    # global + per-category + per-fish + trending
│   │   ├── profile/         # public profile: submissions + rating history
│   │   └── admin/           # moderation console: category approvals, removals
│   ├── components/          # shared UI (StarRating, PhotoUploader, etc.)
│   ├── types/               # generated DB types (supabase gen types typescript)
│   └── routes/             # route tree wiring features together
└── .planning/
```

### Structure Rationale

- **`supabase/migrations/` is the backend.** There is no `server/` folder because the database *is* the server. Ordered SQL migrations are the deployable unit for all business logic. Keeping RLS in its own migration (`0004`) makes security reviewable in one place.
- **`src/lib/queries/` centralizes data access.** Components never call `supabase.from(...)` directly; they call typed hooks. This makes the RLS-scoped access model legible and keeps optimistic-update logic (rating a fly) in one spot.
- **`src/features/` mirrors the requirement clusters** in PROJECT.md (auth, submissions, categorization, rating/ranking, discovery, moderation), so phases map cleanly onto folders.
- **`types/` generated from the DB** keeps client and schema in lockstep; regenerate after each migration.

## Concrete Postgres Schema Sketch

> First-cut DDL. `profiles` mirrors `auth.users` (Supabase owns the auth table). All user references point at `auth.users(id)`.

```sql
-- ── Profiles (1:1 with auth.users) ───────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  bio         text,
  is_admin    boolean not null default false,   -- role flag; see is_admin()
  created_at  timestamptz not null default now()
);

-- ── Taxonomy (admin-managed, evolving) ───────────────────────────
create table fly_types (              -- e.g. dry fly, nymph, streamer
  id     bigint generated always as identity primary key,
  name   text unique not null
);
create table fly_subcategories (      -- belongs to a fly_type
  id           bigint generated always as identity primary key,
  fly_type_id  bigint not null references fly_types(id) on delete cascade,
  name         text not null,
  unique (fly_type_id, name)
);
create table fish_types (             -- e.g. trout, bass, salmon
  id     bigint generated always as identity primary key,
  name   text unique not null
);

-- User-suggested additions, queued for admin approval
create type suggestion_status as enum ('pending','approved','rejected');
create type suggestion_kind   as enum ('fly_type','fly_subcategory','fish_type');
create table category_suggestions (
  id             bigint generated always as identity primary key,
  suggested_by   uuid not null references auth.users(id) on delete cascade,
  kind           suggestion_kind not null,
  name           text not null,
  parent_fly_type_id bigint references fly_types(id), -- for subcategory suggestions
  status         suggestion_status not null default 'pending',
  reviewed_by    uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

-- ── Flies (the catalog) ──────────────────────────────────────────
create type difficulty as enum ('beginner','intermediate','advanced');
create table flies (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  description       text,                          -- how/when to fish it
  recipe            jsonb not null default '{}',   -- materials, hook size, thread…
  difficulty        difficulty,
  fly_type_id       bigint not null references fly_types(id),
  fly_subcategory_id bigint references fly_subcategories(id),
  is_published      boolean not null default true, -- admin can unpublish (soft-remove)
  -- denormalized rating aggregate (maintained by trigger) --
  rating_count      integer not null default 0,
  rating_sum        integer not null default 0,
  rating_avg        numeric(3,2) not null default 0,
  bayesian_score    numeric(6,4) not null default 0,  -- ranking key
  created_at        timestamptz not null default now()
);

-- Fly ↔ Fish many-to-many (a fly targets one or more fish)
create table fly_fish_types (
  fly_id       uuid  not null references flies(id) on delete cascade,
  fish_type_id bigint not null references fish_types(id) on delete cascade,
  primary key (fly_id, fish_type_id)
);

-- Photos (a fly has one or more photos)
create table fly_photos (
  id           uuid primary key default gen_random_uuid(),
  fly_id       uuid not null references flies(id) on delete cascade,
  storage_path text not null,           -- <author_id>/<fly_id>/<file> in fly-photos bucket
  position     int  not null default 0, -- gallery order
  created_at   timestamptz not null default now()
);

-- ── Ratings (1–5 stars, one per user per fly, never your own) ────
create table ratings (
  id         uuid primary key default gen_random_uuid(),
  fly_id     uuid not null references flies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fly_id, user_id)              -- one rating per user per fly (upsert on re-rate)
);

-- Indexes that matter (RLS + leaderboard + M2M lookups)
create index on flies (author_id);
create index on flies (fly_type_id);
create index on flies (bayesian_score desc);      -- global leaderboard
create index on fly_fish_types (fish_type_id);     -- per-fish leaderboard join
create index on ratings (user_id);                 -- RLS + profile history
create index on ratings (fly_id);
create index on category_suggestions (status);     -- moderation queue
```

**"No self-rating" is enforced in two places**: a trigger check (below) that raises if `NEW.user_id = flies.author_id`, *and* an RLS insert policy `WITH CHECK`. Belt and suspenders — the DB is the only trustworthy enforcer.

## Rating Aggregation (the core write path)

**Decision: trigger-maintained denormalized columns, ranked by a Bayesian score.** (Cross-checked: on-the-fly aggregation is simplest but re-scans `ratings` per leaderboard hit; materialized views are fast but stale and are exposed via the auto-API unless restricted. Trigger columns give always-fresh reads with a tiny write cost — ideal when writes are individual rating events.)

```sql
-- Reject self-ratings and (re)compute aggregate on any ratings change.
create or replace function apply_rating_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_fly uuid := coalesce(new.fly_id, old.fly_id);
        v_author uuid; v_count int; v_sum int; v_avg numeric;
        m constant int := 5;      -- min-votes prior (tune later)
        c numeric;                -- global mean
begin
  if tg_op in ('INSERT','UPDATE') then
     select author_id into v_author from flies where id = new.fly_id;
     if v_author = new.user_id then
        raise exception 'Cannot rate your own fly';
     end if;
  end if;

  select count(*), coalesce(sum(stars),0) into v_count, v_sum
  from ratings where fly_id = v_fly;
  v_avg := case when v_count = 0 then 0 else v_sum::numeric / v_count end;

  select coalesce(avg(rating_avg),0) into c from flies where rating_count > 0;

  update flies set
    rating_count = v_count,
    rating_sum   = v_sum,
    rating_avg   = round(v_avg, 2),
    -- Bayesian/IMDB weighted rating: pulls low-vote flies toward global mean
    bayesian_score = round(
      (v_count::numeric/(v_count+m))*v_avg + (m::numeric/(v_count+m))*c, 4)
  where id = v_fly;
  return null;
end $$;

create trigger trg_rating_change
after insert or update or delete on ratings
for each row execute function apply_rating_change();
```

**Bayesian formula (verified — IMDB Top-250):** `score = (v/(v+m))·R + (m/(v+m))·C` where `v`=fly's vote count, `R`=fly's average, `m`=min-votes prior, `C`=global mean. A single 5-star vote can't top the board; the fly must accumulate votes to move off the global mean. **Rank leaderboards by `bayesian_score`, display `rating_avg` + `rating_count`.**

> Note: `C` recomputed per trigger is fine at small scale (one aggregate over `flies`). At larger scale, cache `C`/`m` in a `settings` row or refresh periodically rather than recomputing every rating.

### Leaderboards & Trending (read path)

- **Global / per-fly-type / per-subcategory:** plain SQL views (or filtered queries) over `flies` ordered by `bayesian_score desc`. Index `flies(bayesian_score desc)` already covers global; add partial/composite indexes per filter if needed.
- **Per-fish leaderboard:** join `fly_fish_types` → `flies`, order by `bayesian_score`. Indexed on `fly_fish_types(fish_type_id)`.
- **Trending:** a separate score blending recency + rating velocity, e.g. `bayesian_score * time_decay(created_at)` or ratings-in-last-7-days. Compute in a view; if it gets heavy, promote to a **materialized view refreshed by `pg_cron` (`REFRESH ... CONCURRENTLY`)**. Trending tolerates staleness, so it's the one place materialized views earn their keep.

## Row Level Security Policy Sketch

Access model: **anon read published content, authenticated write own content, no self-rating, admin-only moderation.** Enable RLS on every table; nothing is readable/writable without an explicit policy.

```sql
-- SECURITY DEFINER helper avoids recursive RLS on profiles when checking admin.
create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

alter table flies enable row level security;
-- Anyone (incl. anon) can read published flies; admins see all.
create policy flies_read on flies for select
  to anon, authenticated
  using (is_published or is_admin());
-- Authenticated users insert flies they author.
create policy flies_insert on flies for insert to authenticated
  with check ((select auth.uid()) = author_id);
-- Author edits own; admin edits any (for moderation/unpublish).
create policy flies_update on flies for update to authenticated
  using ((select auth.uid()) = author_id or is_admin())
  with check ((select auth.uid()) = author_id or is_admin());
create policy flies_delete on flies for delete to authenticated
  using ((select auth.uid()) = author_id or is_admin());

alter table ratings enable row level security;
create policy ratings_read on ratings for select to anon, authenticated using (true);
-- Insert only your own rating; self-rating also blocked here (+ trigger).
create policy ratings_insert on ratings for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select author_id from flies where id = fly_id) <> (select auth.uid())
  );
create policy ratings_update on ratings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ratings_delete on ratings for delete to authenticated
  using ((select auth.uid()) = user_id or is_admin());

alter table category_suggestions enable row level security;
create policy sugg_insert on category_suggestions for insert to authenticated
  with check ((select auth.uid()) = suggested_by);
create policy sugg_read on category_suggestions for select to authenticated
  using ((select auth.uid()) = suggested_by or is_admin());
-- Only admins approve/reject.
create policy sugg_moderate on category_suggestions for update to authenticated
  using (is_admin()) with check (is_admin());

-- Taxonomy tables: public read, admin-only write.
alter table fly_types enable row level security;
create policy taxo_read on fly_types for select to anon, authenticated using (true);
create policy taxo_write on fly_types for all to authenticated
  using (is_admin()) with check (is_admin());
-- (same shape for fly_subcategories, fish_types)

alter table profiles enable row level security;
create policy profiles_read on profiles for select to anon, authenticated using (true);
create policy profiles_update on profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
```

**Verified performance rules applied above:**
- **Wrap `auth.uid()` as `(select auth.uid())`** — Postgres runs it as an `initPlan` and caches the result per-statement instead of per-row (100x+ on large tables).
- **Index every column referenced in a policy** (`flies.author_id`, `ratings.user_id`) — already in the schema.
- **`is_admin()` is `SECURITY DEFINER`** so the admin check bypasses `profiles` RLS and avoids recursive policy evaluation.
- **Target policies with `TO anon` / `TO authenticated`** so the planner skips irrelevant roles.
- **Separate policies per command** (select/insert/update/delete) rather than `FOR ALL`, for clarity and least privilege.

## Supabase Auth Wiring (React)

One shared client; a React context subscribes to session changes; OAuth is a redirect flow.

```ts
// lib/supabase.ts
export const supabase = createClient(URL, ANON_KEY);   // anon key only in browser

// features/auth — email/password
await supabase.auth.signUp({ email, password });
await supabase.auth.signInWithPassword({ email, password });

// OAuth (configure Google + GitHub providers in the Supabase dashboard first)
await supabase.auth.signInWithOAuth({
  provider: 'google',                                   // or 'github'
  options: { redirectTo: `${location.origin}/auth/callback` }
});

// Session context — hydrate + subscribe
const { data: { session } } = await supabase.auth.getSession();
supabase.auth.onAuthStateChange((_event, session) => setSession(session));
```

**Profile bootstrap:** create the `profiles` row automatically via a trigger on `auth.users` insert (works for both password and OAuth signups) — never rely on the client to insert it.

```sql
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'user_name',
                           split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created
after insert on auth.users for each row execute function handle_new_user();
```

**Admin role:** promote by setting `profiles.is_admin = true` (manually via SQL/dashboard for v1 — there is no self-service admin). `is_admin()` reads it; RLS and the admin console gate on it.

## Storage Layout & Access Rules (fly photos)

**Decision: one public bucket `fly-photos`.** The catalog is public, so reads should be cheap CDN GETs; a public bucket bypasses RLS on read but *still enforces RLS on upload/update/delete*.

- **Path convention:** `<author_id>/<fly_id>/<filename>` — the first path segment is the owner id, which the write policy checks.
- **Client flow:** upload to Storage first → get the path → insert a `fly_photos` row referencing it (inside the same submission flow).

```sql
-- Public read (bucket is public, but explicit policy documents intent)
create policy "fly photos public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'fly-photos');
-- Users may only write under their own <user_id>/ prefix
create policy "fly photos owner write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'fly-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "fly photos owner modify" on storage.objects
  for update to authenticated using (
    bucket_id = 'fly-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "fly photos owner or admin delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'fly-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or is_admin())
  );
```

## Where Server Logic Lives (decision table)

| Concern | Home | Why |
|---------|------|-----|
| CRUD (flies, ratings, taxonomy read) | Auto API + RLS | No code; RLS is the authorization |
| Access control (anon/auth/admin) | RLS policies | Enforced on every request, can't be bypassed by client |
| No-self-rating invariant | Trigger + RLS `WITH CHECK` | Data integrity must be in DB |
| Rating aggregation / Bayesian score | AFTER trigger on `ratings` | Keeps aggregate authoritative + fresh |
| Profile creation on signup | Trigger on `auth.users` | Fires for password *and* OAuth |
| Taxonomy publish on approval | Trigger on `category_suggestions` update | Approval → insert into taxonomy atomically |
| Leaderboards | SQL views over aggregate columns | Cheap, always fresh |
| Trending (if heavy) | Materialized view + `pg_cron` | Tolerates staleness; avoids per-request cost |
| Image processing / external notifications | Edge Function | Can't be done in SQL; needs runtime/side-effects |

**Rule of thumb:** default to RLS + triggers; add an Edge Function only when you need code execution, secrets, or third-party calls the client shouldn't hold.

## Data Flow

### Rate a fly (write)

```
User clicks 3★ on a fly
   ↓ optimistic UI update (TanStack Query)
supabase.from('ratings').upsert({fly_id, user_id, stars})   (JWT attached)
   ↓ PostgREST → RLS insert/update policy (own row? not own fly?)  ── rejects self-rating
   ↓ AFTER trigger apply_rating_change(): recount, recompute avg + bayesian_score on flies
   ↓ response → cache invalidation → leaderboards reflect new score on next read
```

### Submission → moderation → publication

```
Submit fly (auth):
  1. upload photos → fly-photos/<uid>/<fid>/…   (Storage RLS: owner prefix)
  2. insert flies row  (RLS: author_id = uid; is_published=true)  → live immediately
  3. insert fly_fish_types + fly_photos rows
     (v1: flies publish on submit; "moderation" = admin can later unpublish/remove)

Suggest a category (auth):
  1. insert category_suggestions (status=pending)  (RLS: suggested_by = uid)
  2. Admin console lists status='pending'  (RLS: is_admin())
  3. Admin approves → update status=approved  (RLS: is_admin() only)
  4. Trigger on approval → insert into fly_types / fly_subcategories / fish_types
     → taxonomy row becomes selectable in the submit form
```

### Read (browse/leaderboard, anonymous)

```
Anon visitor → supabase.from('flies').select(...) filtered by fly_type/fish/subcategory
   ↓ RLS select policy: is_published OR is_admin()  → anon sees only published
   ↓ order by bayesian_score desc  → ranked results, no auth required
```

### State management

```
Server state  → TanStack Query (queries/mutations, cache, optimistic updates)
Auth session  → React context from supabase.auth (getSession + onAuthStateChange)
UI/filter state → local component/URL state (search params drive browse filters)
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | Everything above as-is. Trigger recompute of global `C` per rating is negligible. Single public bucket, plain views. |
| 1k–100k users | Cache global mean `C`/`m` in a `settings` row (stop scanning `flies` each rating). Add composite indexes for common filter+sort combos. Promote trending to a `pg_cron`-refreshed materialized view. Add pagination (keyset on `bayesian_score`). |
| 100k+ users | Read replicas for leaderboard/browse traffic; consider incremental aggregate maintenance; CDN image transforms; revisit whether trigger recompute of per-fly aggregate should batch. |

### Scaling Priorities

1. **First bottleneck: recomputing global mean `C` in the rating trigger.** Fix by caching `C` (settings row refreshed periodically) instead of `avg()` over `flies` on every rating.
2. **Second bottleneck: unindexed leaderboard filters.** Fix with composite/partial indexes matching the actual filter+`bayesian_score` sort, and keyset pagination.

## Anti-Patterns

### Anti-Pattern 1: Computing averages on the client / storing only raw ratings
**What people do:** fetch all ratings for a fly and average in JS, or `avg()` on every leaderboard query.
**Why it's wrong:** N+1 reads, non-rankable at the DB, no fair handling of low-vote flies.
**Do this instead:** maintain `rating_count/sum/avg/bayesian_score` via trigger; rank in SQL.

### Anti-Pattern 2: Enforcing "no self-rating" or "admin only" in React
**What people do:** hide the rate button on your own fly, gate the admin console with a client check.
**Why it's wrong:** the client is untrusted; PostgREST is a public API — anyone can POST directly.
**Do this instead:** enforce in RLS `WITH CHECK` + triggers; client checks are UX only.

### Anti-Pattern 3: Un-wrapped `auth.uid()` and missing policy indexes
**What people do:** `using (auth.uid() = user_id)` with no index on `user_id`.
**Why it's wrong:** function runs per-row and does a seq scan — orders of magnitude slower.
**Do this instead:** `(select auth.uid())` + btree index on every policy-referenced column.

### Anti-Pattern 4: Recursive RLS via `profiles` self-reference for admin
**What people do:** check `is_admin` by selecting `profiles` inside a `profiles` policy.
**Why it's wrong:** infinite recursion / policy re-evaluation.
**Do this instead:** a `SECURITY DEFINER` `is_admin()` helper that bypasses RLS.

### Anti-Pattern 5: Private bucket + signed URLs for a public catalog
**What people do:** private bucket, generate signed URLs for every photo.
**Why it's wrong:** adds latency/complexity for content that's meant to be public.
**Do this instead:** public bucket for reads; RLS restricts only writes to the owner prefix.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth (GoTrue) | `supabase.auth.*`; OAuth redirect flow | Configure Google + GitHub client IDs/secrets + redirect URLs in dashboard before use |
| Supabase Storage | `supabase.storage.from('fly-photos')` | Public bucket; owner-prefix write policy; store returned path in `fly_photos` |
| Google / GitHub OAuth | Provider apps → Supabase callback URL | Redirect URI must match Supabase auth callback exactly |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React ↔ Postgres | PostgREST (REST) via supabase-js | RLS is the contract; no custom API tier |
| Client ↔ Auth session | supabase-js context + `onAuthStateChange` | JWT auto-attached to every DB/Storage call |
| ratings → flies aggregate | AFTER trigger | Only path that mutates aggregate columns |
| category_suggestions → taxonomy | Trigger on approval | Only path that publishes new taxonomy rows |

## Suggested Build Order (dependencies)

This is the load-bearing output for roadmap phasing. Each step depends on the ones above it.

1. **Foundation:** Supabase project, migrations tooling, React SPA scaffold, shared `supabase.ts` client, generated types. *(Nothing works without this.)*
2. **Auth + profiles:** email/password + Google/GitHub; `handle_new_user` trigger; session context. *(Writes and RLS need real users.)*
3. **Taxonomy (read side):** `fly_types`, `fly_subcategories`, `fish_types` + seed data + public-read RLS. *(Submissions require categories to exist.)*
4. **Flies + photos + submission:** `flies`, `fly_fish_types`, `fly_photos`, Storage bucket + policies, submission form. *(Core content; depends on auth + taxonomy.)*
5. **Browse + search + fly detail:** filtered reads by fly type / subcategory / fish; public detail page. *(Depends on flies existing.)*
6. **Ratings + aggregation:** `ratings` table, unique constraint, RLS, `apply_rating_change` trigger, rating widget. *(Depends on flies + auth; enforces no-self-rating.)*
7. **Leaderboards + trending:** views over `bayesian_score`; global / per-category / per-fish; trending. *(Depends on aggregates from step 6.)*
8. **Profiles (history views) & category suggestions:** public profile (submissions + ratings), suggestion submission. *(Depends on flies/ratings/taxonomy.)*
9. **Moderation console:** admin role, approve/reject suggestions (+ publish trigger), unpublish/remove flies & ratings. *(Depends on everything it moderates.)*

**Critical-path insight:** steps 2→4→6→7 form the spine of the "submit → rate → discover" core value. Taxonomy (3) must precede submission (4). Moderation (9) can ship last because v1 publishes on submit and moderation is admin-only cleanup.

## Sources

- Supabase — RLS Performance and Best Practices (official docs, updated 2025): https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv — `(select auth.uid())` initPlan caching, policy-column indexing, security definer, role targeting. *(MEDIUM-HIGH, official)*
- Supabase — Storage Access Control & Ownership: https://supabase.com/docs/guides/storage/security/access-control and https://supabase.com/docs/guides/storage/security/ownership — public vs private bucket semantics, owner = JWT sub, `storage.foldername()` path scoping. *(MEDIUM, official)*
- Supabase — Materialized Views / Database Advisors: https://supabase.com/docs/guides/database/database-advisors?lint=0016_materialized_view_in_api and https://dev.to/kovidr/optimize-read-performance-in-supabase-with-postgres-materialized-views-12k5 — matview freshness/refresh tradeoffs, auto-API exposure warning. *(MEDIUM)*
- IMDB Weighted Average / Bayesian rating formula: https://help.imdb.com/article/imdb/track-movies-tv/weighted-average-ratings/GWT2DSBYVT2F25SK and https://vault.asgard-ai.com/skills/skill-algo-rank-bayesian/ — `WR = (v/(v+m))·R + (m/(v+m))·C`. *(HIGH)*
- Supabase Auth (`signInWithPassword`, `signInWithOAuth`, `onAuthStateChange`) and profile-bootstrap trigger pattern — standard Supabase idioms (author knowledge, cutoff Jan 2026). *(MEDIUM)*

---
*Architecture research for: community fly-tying rating/catalog app (React + Supabase)*
*Researched: 2026-07-01*
