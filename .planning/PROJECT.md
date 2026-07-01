# Flyrate

## What This Is

Flyrate is a community-driven web app where anglers submit the fishing flies they've
hand-tied and the community rates them. Each fly is cataloged by fly type (with
subcategories) and by target fish type, so anyone can browse, search, and discover
the best patterns for what they want to tie or fish. It's for fly-tyers who want
feedback and recognition, and for anglers hunting for proven patterns.

## Core Value

A user can submit a fly and have it rated by the community, and any visitor can find
the top-rated flies for a given fly type or target fish. If nothing else works, this
submit → rate → discover loop must.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. Hypotheses until shipped. -->

**Accounts & Profiles**
- [ ] Anyone can browse and search flies without an account
- [ ] A user can register and sign in with email/password
- [ ] A user can sign in with a social provider (Google/GitHub)
- [ ] A user has a public profile showing their submission history and rating history

**Submissions**
- [ ] A signed-in user can submit a fly with one or more photos
- [ ] A submission includes a structured tying recipe (materials, hook size, thread, etc.)
- [ ] A submission includes a free-text description (how/when to fish it, tips)
- [ ] A submission includes a tying difficulty level (e.g. beginner/intermediate/advanced)
- [ ] A submission is assigned a fly type + subcategory and one or more target fish types

**Categorization**
- [ ] Fly types, subcategories, and fish types come from a predefined, admin-managed taxonomy
- [ ] A user can suggest a new category/fish type, which queues for admin approval

**Rating & Ranking**
- [ ] A signed-in user can rate another user's fly from 1–5 stars (not their own)
- [ ] A fly displays its average star rating and number of ratings
- [ ] A global leaderboard shows the highest-rated flies site-wide
- [ ] Per-category leaderboards show the top-rated flies within each fly type/subcategory
- [ ] Per-fish-type leaderboards show the top-rated flies for each target fish
- [ ] A trending/recent view surfaces newly submitted and currently popular flies

**Discovery**
- [ ] A visitor can search/filter flies by fly type, by subcategory, and by target fish type

**Moderation (minimal v1)**
- [ ] An admin can approve or reject user-suggested categories
- [ ] An admin can remove an inappropriate fly or rating

### Out of Scope

<!-- Explicit boundaries with reasoning to prevent re-adding. -->

- Social following / activity feeds — deferred to a later version; keep v1 focused on the rate-and-discover loop
- User flagging/reporting workflow — v1 moderation is admin-driven only; add community flagging once there's volume
- Comments/discussion threads on flies — not mentioned as core; ranking is the primary feedback signal for v1
- Marketplace / selling flies or gear — not a goal; Flyrate is a rating catalog, not commerce
- Native mobile apps — responsive web only for v1

## Context

- Greenfield build — the repo currently contains only a README stub.
- Domain: fly fishing / fly tying. Flies are grouped by type (e.g. dry fly, nymph,
  streamer, wet fly, emerger) with subcategories, and by the fish they target
  (e.g. trout, bass, salmon). The taxonomy is a first-class, evolving part of the data model.
- Photo-centric content: people rate flies visually, so image upload/display quality matters.
- Two primary personas: **viewers** (anonymous, browse/search/discover) and
  **users** (authenticated, submit + rate + maintain a profile), plus a small **admin** role.

## Constraints

- **Tech stack**: Modern React front end + Supabase backend (cloud-hosted Postgres) — user preference stated at kickoff.
- **Backend/DB**: Supabase — managed cloud Postgres, plus its built-in Auth, Storage (fly photos), and auto-generated APIs. Chosen to get a Firebase-like hosted convenience while keeping a relational Postgres data model.
- **Auth**: Must support both email/password and social login (Google/GitHub) — provided by Supabase Auth.
- **Access model**: Browsing/search must work anonymously; submitting and rating require an account.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 5-star average rating (vs up/down votes or likes) | Familiar, gives a rankable score with a visible vote count | — Pending |
| Predefined taxonomy + user suggestions queued for admin approval | Keeps category data clean while letting the taxonomy grow | — Pending |
| Anonymous browsing; account required to submit/rate | Maximizes discovery reach while protecting content quality | — Pending |
| Minimal admin-only moderation for v1 | Ship the core loop; defer flagging/removal tooling until there's volume | — Pending |
| React + Supabase (cloud Postgres) stack | Satisfies both the Postgres preference and the desire for a cloud-hosted, Firebase-like managed backend; Supabase Auth covers email/password + Google/GitHub, and Storage covers fly photos | — Pending |
| Supabase **free tier** for v1 | Avoids Pro-plan cost; photo pipeline uses client-side compression + EXIF/GPS stripping instead of Pro server-side image transforms | — Pending |
| Supabase **free tier** for v1 (client-side image compression, not Pro transforms) | Avoids Pro-plan cost; photos are compressed + EXIF/GPS-stripped in the browser before upload | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-01 after initialization*
