# Roadmap: Flyrate

## Overview

Flyrate delivers the "submit → rate → discover" loop as four coarse vertical slices on a
React (Next.js App Router) + Supabase stack. Phase 1 stands up the foundation with two
irreversible decisions baked in from migration one — RLS on every table and an SSR-capable
framework — and rides that foundation straight to a demoable slice: a signed-in user submits
a fly and sees it exist. Phase 2 opens the public, SEO-crawlable catalog so any visitor can
browse, filter, and open a fly. Phase 3 closes the loop with community rating, a
gaming-resistant Bayesian ranking (with DB-level fraud guards shipped alongside the score),
and the leaderboards that read it. Phase 4 rounds out the community surface — profile history,
user category suggestions, and the admin moderation console that cleans up after everything
else. Each phase is an end-to-end user capability, not a horizontal technical layer.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Submit** - Scaffold (RLS + SSR from day one), auth/profiles, seeded taxonomy, and fly submission — sign in → submit a fly → see it exist
- [ ] **Phase 2: Public Catalog & Discovery** - Anonymous, SEO-crawlable browse/search/filter and fly detail pages
- [ ] **Phase 3: Rate, Rank & Leaderboards** - Community 1–5 star rating with fraud guards + Bayesian score, plus global/category/fish leaderboards and a recent view
- [ ] **Phase 4: Community & Moderation** - Profile history, user category suggestions, and the admin moderation console (ships last)

## Phase Details

### Phase 1: Foundation & Submit
**Goal**: A signed-in angler can create an account and submit a fully-cataloged fly (photos, recipe, description, difficulty, fly type/subcategory, target fish), and see it exists.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, PROF-01, SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06, SUB-07, TAX-01
**Success Criteria** (what must be TRUE):
  1. A visitor can sign up with email/password (with email verification) or with Google/GitHub, and their session survives a browser refresh; they can sign out from any page.
  2. Every registered user automatically gets a public profile page at signup (server-side bootstrap, no client insert).
  3. A signed-in, email-confirmed user can submit a fly with one or more photos, a structured recipe (ordered material rows + hook size + thread), a free-text description, and a difficulty level.
  4. The submission form only lets the user pick a fly type + subcategory and one or more target fish from the predefined, admin-managed taxonomy (seeded starter data).
  5. Uploaded photos are client-side compressed and stripped of EXIF/GPS before reaching storage, and a submitted fly is retrievable/visible to its author.
**Plans**: 4 plans
- [ ] 01-01-PLAN.md — External setup: Supabase cloud project + Google/GitHub OAuth apps + env (autonomous: false)
- [ ] 01-02-PLAN.md — Walking skeleton: Next.js/shadcn scaffold + @supabase/ssr clients/middleware + migration 0001 (profiles + bootstrap trigger + RLS) + email/pw signup + profile page (AUTH-01, AUTH-05, PROF-01)
- [ ] 01-03-PLAN.md — Auth completion: Google/GitHub OAuth + email-confirm route + sign-in/sign-out + is_email_confirmed() gate (AUTH-02, AUTH-03, AUTH-04, AUTH-06)
- [ ] 01-04-PLAN.md — Taxonomy + submit slice: seeded lookup tables + flies/photos/materials schema + storage bucket + submit form + image pipeline + /flies/[id] payoff (TAX-01, SUB-01..07)
**UI hint**: yes

*Foundation note (unavoidable in slice 1):* Supabase project + versioned migrations, Next.js
App Router scaffold + `@supabase/ssr`, shared anon-key client, generated DB types, and
**RLS enabled on every table in its creating migration** are established here. The SSR
framework choice (Next.js App Router) is locked now because retrofitting SEO onto an SPA is a
rewrite. These are the two irreversible-cheap-only-now decisions.

### Phase 2: Public Catalog & Discovery
**Goal**: Any visitor — with no account — can browse the catalog, narrow it down by taxonomy and difficulty, and open a full fly detail page, all as crawlable server-rendered HTML.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06
**Success Criteria** (what must be TRUE):
  1. An anonymous visitor can browse and search flies with no account required.
  2. A visitor can filter the catalog by fly type, by subcategory, by target fish type, and by difficulty level (individually and in combination).
  3. A visitor can open a fly detail page showing its photos, recipe, description, taxonomy, and current rating display.
  4. Public catalog, category, fish, and fly-detail pages render server-side as crawlable HTML with per-page title/meta/OG tags (and a sitemap).
**Plans**: TBD
**UI hint**: yes

### Phase 3: Rate, Rank & Leaderboards
**Goal**: The community can rate each other's flies 1–5 stars under enforced fraud guards, and anyone can find the top-ranked flies globally, per category, and per fish via a gaming-resistant weighted score.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: RATE-01, RATE-02, RATE-03, RATE-04, RATE-05, LEAD-01, LEAD-02, LEAD-03, LEAD-04
**Success Criteria** (what must be TRUE):
  1. A signed-in user can rate another user's fly 1–5 stars, cannot rate their own fly (enforced at the DB via RLS `WITH CHECK` + trigger, not just UI), and has at most one rating per fly which they can change.
  2. A fly displays its average star rating and its number of ratings.
  3. Each fly carries a weighted (Bayesian) ranking score, maintained by an aggregate trigger, so a single high vote cannot top the board and self-ratings/dupes are structurally blocked.
  4. Global, per-fly-type/subcategory, and per-target-fish leaderboards list the highest-ranked flies ordered by the weighted score.
  5. A "recent" view surfaces newly submitted flies.
**Plans**: TBD
**UI hint**: yes

*Convergent constraint:* the ratings table with `UNIQUE(fly_id, user_id)`, the no-self-rating
guards, and the Bayesian aggregate trigger MUST ship together with (before) the leaderboards
that read `bayesian_score` — a raw-average board is trivially gamed on day one.

### Phase 4: Community & Moderation
**Goal**: Users can see each other's contribution history and propose taxonomy additions, and an admin can approve/reject suggestions and remove inappropriate content — the admin cleanup layer over everything already shipped.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: PROF-02, PROF-03, TAX-02, TAX-03, MOD-01, MOD-02, MOD-03
**Success Criteria** (what must be TRUE):
  1. A user's public profile shows their submission history and their rating history.
  2. A signed-in user can suggest a new fly category or fish type, and that suggestion is queued as pending until an admin acts on it (it is not immediately selectable).
  3. An admin can approve or reject a pending suggestion, and an approval publishes the new taxonomy row so it becomes selectable in the submit form.
  4. An admin can remove (unpublish) an inappropriate fly so it disappears from the public catalog and leaderboards.
  5. An admin can remove an inappropriate rating, and the affected fly's aggregate/ranking recomputes accordingly.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Submit | 0/4 | Not started | - |
| 2. Public Catalog & Discovery | 0/TBD | Not started | - |
| 3. Rate, Rank & Leaderboards | 0/TBD | Not started | - |
| 4. Community & Moderation | 0/TBD | Not started | - |
