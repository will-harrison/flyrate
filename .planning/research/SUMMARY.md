# Project Research Summary

**Project:** Flyrate
**Domain:** Community photo-catalog rating web app (user-generated submissions + community rating + public SEO discovery) on React + Supabase
**Researched:** 2026-07-01
**Confidence:** HIGH

## Executive Summary

Flyrate is a community fly-tying rating/catalog app: authenticated users submit hand-tied flies (photos + structured recipe + taxonomy), the community rates them 1–5 stars, and anyone — anonymously — can browse, search, and find the top-rated patterns per fly type or target fish. The stack is fixed (modern React + Supabase: cloud Postgres, Auth, Storage, auto-REST, RLS). Experts build this class of app with **the database as the application server**: a thin React client talks directly to Supabase's auto-generated PostgREST API, and all business rules — access control, the no-self-rating invariant, rating aggregation, moderation gates — live in Postgres (RLS policies + triggers + a few SECURITY DEFINER functions), not a bespoke Node tier. Edge Functions are reserved for the narrow set of things RLS/triggers can't express (image side-effects, elevated admin ops).

All four research streams converged on the same load-bearing decisions. **RLS on every table from the first migration** is security-critical and effectively impossible to retrofit safely (CVE-2025-48757 found 10.3% of AI-built Supabase apps leaking data through missing RLS). The public catalog's SEO requirement rules out a plain client-only SPA: use an **SSR-capable React framework (Next.js App Router)** so leaderboard, category, fish, and fly-detail pages render crawlable HTML with per-page meta/OG tags. Rankings must use a **Bayesian/weighted average** (IMDb formula) with **DB-level fraud enforcement** — `UNIQUE(fly_id, user_id)` plus a no-self-rating RLS `WITH CHECK` — shipped together with leaderboards, because a raw-average board is trivially gamed and erodes the core value prop on day one. Rating aggregates are **trigger-maintained denormalized columns** on the fly row (not on-the-fly aggregation, not materialized views). The **taxonomy is seeded early as lookup tables** (not Postgres enums) because submission, search, and every leaderboard depend on it. Photos go through a **client-side compression + EXIF/GPS-stripping pipeline** (Supabase server-side transforms are Pro-plan-only, and EXIF GPS leaks anglers' fishing spots).

The chief risks are all preventable-by-sequencing: bolt-on RLS, a raw-average leaderboard, an SPA-with-no-SEO stack choice, and an unoptimized image pipeline. Each is cheap to do right at the correct phase and a partial rewrite to fix later. The research produces a clear, dependency-driven phase spine (below) with the core value concentrated on the Auth → Submission → Ratings → Leaderboards critical path.

## Key Findings

### Recommended Stack

Next.js App Router is the recommended meta-framework specifically because Flyrate's public pages are SEO-critical and Supabase's first-party SSR-auth guide (`@supabase/ssr`) targets Next App Router directly — the lowest-friction path. Public pages render server-side (RSC) with the anon key and skip client hydration; interactive submit/rate flows stay client-side with TanStack Query. See STACK.md for full version matrix (verified against npm 2026-07-01).

**Core technologies:**
- **Next.js 16.2 (App Router) + React 19.2** — SSR/SSG for crawlable public catalog pages; RSC for anon reads, client islands for auth flows
- **@supabase/supabase-js 2.110 + @supabase/ssr 0.12** — the one SDK for Postgres/Auth/Storage/Realtime; `@supabase/ssr` is THE supported cookie-based auth path (the deprecated `auth-helpers` is the #1 footgun)
- **TypeScript 5.9 + `supabase gen types`** — end-to-end type safety from schema to query
- **Tailwind 4 + shadcn/ui (vendored, Radix-based)** — photo-first UI, no version lock
- **TanStack Query 5, react-hook-form 7 + zod 4** — server-state cache/optimistic rating updates; validated submission form (zod re-validated server-side)
- **browser-image-compression 2** — client-side downscale/compress + EXIF strip before upload (free-tier image path)
- **Supabase CLI** — versioned SQL migrations for schema, RLS, triggers, seed taxonomy (never click-configure)

### Expected Features

**Must have (table stakes):**
- Anonymous browse + faceted search/filter (fly type / subcategory / fish / difficulty) + fly detail page
- Email/password + Google/GitHub auth; account required to submit/rate
- Fly submission: 1+ photos, structured recipe (ordered material rows + hook/thread fields), free-text description, difficulty, taxonomy assignment
- 1–5 star rating, one per user, not own fly; display average + vote count
- Global / per-category / per-fish leaderboards (weighted score, not raw average)
- Recent view; public profile (submission + rating history)
- Category suggestion → admin approval queue; admin remove fly/rating (soft-delete)

**Should have (competitive):**
- **Bayesian/weighted ranking** — THE credibility feature; a one-vote fly must not top the board
- **Rich, correct fly taxonomy** (dry/nymph/emerger/wet/streamer/terrestrial/salt/warmwater/salmon-steelhead + subcategories + fish) — domain credibility competitors get wrong; seed it well
- Difficulty-based discovery; structured filterable recipe schema; printable recipe card

**Defer (v2+):**
- Velocity-based "Trending" (ship "Recent" first) — v1.x
- Structured/faceted recipe-material search, AI image pre-moderation — v1.x
- Comments, social following/feeds, community flagging, native apps — Out of Scope per PROJECT.md

### Architecture Approach

Thin React client → Supabase auto-API, with Postgres as the app server. Almost no custom backend code: RLS is the authorization contract, triggers own the write-side invariants, SQL views serve the leaderboards. The single most important architectural decision is **where the rating aggregate lives: trigger-maintained denormalized columns** (`rating_count`, `rating_sum`, `rating_avg`, `bayesian_score`) on the `flies` row — always-fresh, cheaply indexed, authoritative in one AFTER trigger on `ratings`.

**Major components:**
1. **Postgres schema + RLS + triggers** — source of truth; access control (anon read / auth write own / admin moderate), no-self-rating, rating aggregation, profile bootstrap on signup, taxonomy publish on approval
2. **Leaderboard views** — SQL views over `bayesian_score desc` (global / per-fly-type / per-subcategory / per-fish); trending as a separate recency-weighted view (promote to `pg_cron` matview only if heavy)
3. **React (Next) client + supabase-js data layer** — RSC for anon SEO pages, TanStack Query hooks for interactive auth islands; components never call `supabase.from()` directly
4. **Supabase Auth + Storage** — email/pw + Google/GitHub OAuth; single public `fly-photos` bucket, path `<author_id>/<fly_id>/<file>`, owner-prefix write RLS
5. **Edge Functions (only if needed)** — image side-effects, elevated admin ops holding the service-role key server-side

### Critical Pitfalls

1. **Missing/misconfigured RLS exposes the whole DB via the public anon key** — enable RLS on every table *in the creating migration*; separate SELECT (public) from write policies (gated on `(select auth.uid())`); run Security Advisor + a raw anon-key `curl` probe before deploy. Retrofitting is a data-breach-class fix.
2. **service_role key leaking into the client bundle** — anon key only in the browser, always; service key server-side (Edge Functions) only; model admin as an `is_admin` role enforced by RLS so most moderation needs no service key; secret-scan in CI.
3. **Raw-average ranking is trivially gamed** — bake the Bayesian formula `(v/(v+m))·R + (m/(v+m))·C` into the ranking column from day one; display raw avg + count but rank by weighted score; consider a min-votes eligibility floor.
4. **Rating fraud (self-rating, dupes, sockpuppets)** — `UNIQUE(fly_id, user_id)` + no-self-rating in RLS `WITH CHECK` (and a belt-and-suspenders trigger), not UI-only; gate rating on confirmed email; log audit columns now (painful to backfill).
5. **Client-only SPA kills SEO** — choose an SSR framework at Foundation (Next); per-page title/meta/OG + sitemap.xml + stable slugs. Retrofitting SSR onto a mature Vite SPA ≈ rewrite.
6. **Unoptimized photos (huge uploads, EXIF/GPS leak, egress cost)** — client-side resize/compress + EXIF strip before upload, max size/MIME caps, public bucket for reads; decide the pipeline when building upload, not after photos accumulate.

## Implications for Roadmap

All four researchers independently produced the same dependency-driven spine. Suggested structure (9 phases; core value on the **2→4→6→7 critical path**):

### Phase 1: Foundation (schema + RLS + SEO-capable scaffold)
**Rationale:** Nothing works without it, and two decisions here are irreversible-cheap-only-now: RLS-per-table and the SSR framework choice.
**Delivers:** Supabase project + migration tooling; Next.js App Router scaffold; shared `supabase.ts` (anon key) + `@supabase/ssr`; generated DB types; RLS enabled on every table at creation.
**Uses:** Next 16 / React 19 / Supabase CLI / TypeScript (STACK.md).
**Avoids:** Pitfalls 1 (RLS-per-table) and 5 (SSR stack choice).

### Phase 2: Auth + Profiles
**Rationale:** Writes and all RLS need real users; profile bootstrap must be server-side.
**Delivers:** email/password + Google/GitHub OAuth; `handle_new_user` trigger creating `profiles`; `is_admin()` SECURITY DEFINER helper; session context; confirmed-email gating.
**Implements:** Supabase Auth wiring; admin role model.
**Avoids:** Pitfalls 2 (admin-as-role, no service key in client) and OAuth redirect misconfig.

### Phase 3: Taxonomy (read side, seeded)
**Rationale:** Submission, search, and every leaderboard depend on it; seed and lock the schema early. Lookup tables, not enums.
**Delivers:** `fly_types` / `fly_subcategories` / `fish_types` + seed data (starter taxonomy in FEATURES.md) + public-read RLS + FK merge-not-delete policy.
**Avoids:** rigid-taxonomy / orphaned-category UX pitfalls.

### Phase 4: Fly Submission + Photos
**Rationale:** Core content; depends on auth + taxonomy. Carries the most hidden UX work.
**Delivers:** `flies` / `fly_fish_types` / `fly_photos`; `fly-photos` public bucket + owner-prefix Storage RLS; submission form (RHF+zod); client-side compression + EXIF strip + size/MIME caps.
**Uses:** react-hook-form, zod, browser-image-compression.
**Avoids:** Pitfall 6 (image pipeline).

### Phase 5: Browse + Search + Fly Detail
**Rationale:** Depends on flies existing; this is the public SEO surface.
**Delivers:** faceted filtered reads (fly type / subcategory / fish / difficulty); server-rendered fly-detail + category/fish pages with meta/OG; sitemap.
**Avoids:** N+1 (PostgREST embedding), SEO gaps.

### Phase 6: Ratings + Aggregation
**Rationale:** Depends on flies + auth; the fraud guards and aggregate trigger must exist before any leaderboard reads them.
**Delivers:** `ratings` table, `UNIQUE(fly_id, user_id)`, no-self-rating RLS `WITH CHECK` + trigger, `apply_rating_change` aggregate trigger computing `bayesian_score`, rating widget with optimistic updates, audit columns.
**Avoids:** Pitfalls 3 and 4 (shipped together with the score, per convergent guidance).

### Phase 7: Leaderboards + Trending
**Rationale:** Depends on the aggregates from Phase 6; completes the discover half of the core loop.
**Delivers:** views over `bayesian_score` (global / per-category / per-fish); min-votes eligibility floor + empty states; "Recent" now, velocity "Trending" later.

### Phase 8: Public Profiles + Category Suggestions
**Rationale:** Cheap but needs flies/ratings/taxonomy to exist; the suggestion write-path into taxonomy.
**Delivers:** public profile (submission + rating history); `category_suggestions` submission (status=pending).

### Phase 9: Moderation Console
**Rationale:** Ships last — v1 publishes on submit; moderation is admin-only cleanup over everything else.
**Delivers:** admin approve/reject suggestions (+ publish trigger into taxonomy); soft-delete/unpublish flies & ratings; elevated ops via Edge Function if needed.

### Phase Ordering Rationale

- **Strict dependency chain:** taxonomy (3) before submission (4); ratings + aggregate trigger (6) before leaderboards (7); profiles/suggestions (8) and moderation (9) after the content they operate on.
- **Architecture grouping:** each phase maps to a `supabase/migrations/*` file and a `src/features/*` folder (ARCHITECTURE.md), so phases are clean vertical slices.
- **Pitfall avoidance is front-loaded:** the two irreversible decisions (RLS-per-table, SSR framework) are in Phase 1; the ranking + fraud guards are inseparable in Phase 6→7.

### Research Flags

Phases likely needing deeper research during planning (`/gsd-plan-phase --research-phase`):
- **Phase 6 (Ratings/Aggregation):** tune the Bayesian `C`/`m` constants for a small launch community; verify trigger-vs-cached-`C` performance approach.
- **Phase 7 (Leaderboards/Trending):** define the trending recency-weighting formula and matview-vs-view threshold.
- **Phase 4 (Submission/Photos):** confirm the Supabase plan tier ↔ image strategy (free-tier client compression vs Pro transforms) before building the pipeline.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 2 (Auth):** Supabase Auth + `@supabase/ssr` + profile-bootstrap trigger are canonical idioms.
- **Phase 3 (Taxonomy):** plain lookup tables + seed + public-read RLS.
- **Phase 8 (Profiles/Suggestions):** straightforward reads/writes over existing tables.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm 2026-07-01; patterns cross-checked vs official Supabase/Next/shadcn docs |
| Features | HIGH | Fly taxonomy + Bayesian ranking verified against multiple industry sources; UGC/moderation patterns are established conventions |
| Architecture | HIGH | Schema/RLS/leaderboard/trigger patterns are well-established Supabase idioms; RLS-perf + Storage details cross-checked vs 2025 docs |
| Pitfalls | HIGH | Supabase traps verified vs docs + CVE-2025-48757; rating pitfalls are established IMDb/Bayesian patterns |

**Overall confidence:** HIGH

### Gaps to Address

- **Supabase plan tier vs image strategy:** free tier commits to client-side resize; Pro ($25/mo) unlocks on-the-fly transforms. Decide before Phase 4; default is free-tier + client compression.
- **Bayesian `C`/`m` constants:** `m` ≈ 5–20 for a small community, `C` = global mean; recompute `C` cheaply per-trigger at small scale, cache in a `settings` row at scale. Tune in Phase 6.
- **Trending weighting:** exact recency×velocity formula and view-vs-matview cutoff undefined; resolve in Phase 7.
- **Trout species split:** seed as one "Trout" fish type or split Rainbow/Brown/Brook/Cutthroat — decide during taxonomy seeding (Phase 3).
- **Overlapping-subcategory canonical placement:** e.g. Terrestrial appears both as a top-level type and a dry-fly subcategory; pick one canonical placement per subcategory in the data model to keep leaderboards unambiguous (Phase 3).

## Sources

### Primary (HIGH confidence)
- npm registry (2026-07-01) — exact current versions for next/react/@supabase/*/tanstack-query/react-hook-form/zod/tailwind
- Supabase Docs — Server-Side Auth for Next.js (`@supabase/ssr`), Row Level Security + RLS performance, Storage Image Transformations + access control
- shadcn/ui Docs — Tailwind v4 + React 19 support
- IMDb Weighted Average / Bayesian rating formula; Asgard AI Bayesian rating (gaming resistance)
- Fly-taxonomy sources — Peaks Fly Fishing, TCO, Jackson Hole Fly Co, Orvis, Hatch Magazine, Trout & Feather

### Secondary (MEDIUM confidence)
- Supabase Security Retro 2025 / CVE-2025-48757 — 10.3% of AI apps leaking via missing RLS
- Supabase Database Advisors — `0016_materialized_view_in_api` (MV bypasses RLS); PostgREST aggregate functions disabled by default
- TanStack Query vs SWR comparisons (mutation/optimistic-update rationale)
- Vibeappscanner — Supabase RLS common mistakes & `(select auth.uid())` trap

### Tertiary (LOW confidence)
- Standard Supabase auth/trigger idioms (author knowledge, cutoff Jan 2026) — validate during implementation

---
*Research completed: 2026-07-01*
*Ready for roadmap: yes*
