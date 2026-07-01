# Phase 1: Foundation & Submit - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A signed-in, email-confirmed angler can create an account and submit a fully-cataloged
fly — one or more photos, a structured tying recipe (ordered material rows + hook size +
thread), a free-text description, a difficulty level, one fly type + subcategory, and one or
more target fish — then land on that fly's own detail page and see it exists.

This phase also stands up the foundation carried by that slice: Supabase project + versioned
migrations, Next.js App Router + `@supabase/ssr`, shared anon-key client, generated DB types,
RLS enabled on every table in its creating migration, auth (email/password + Google/GitHub),
auto-bootstrapped public profiles, and the seeded taxonomy.

**Not in this phase:** public/anonymous browsing, search, and filtering (Phase 2); rating,
ranking, and leaderboards (Phase 3); user category suggestions and admin moderation (Phase 4).
The fly detail page built here is an author-visible version; Phase 2 makes catalog/detail
pages public and SEO-crawlable.

</domain>

<decisions>
## Implementation Decisions

### Submit flow & payoff
- **D-01:** The submission form is a **single scrollable page** with sections (photos,
  recipe, taxonomy, difficulty, description), not a multi-step wizard. Simplest to build and
  lets the user review the whole submission before committing.
- **D-02:** On successful submit, redirect the author to **the fly's own detail page**
  (`/flies/[id]`) rendering everything they entered — this is the phase's "see it exist"
  payoff. This author-visible detail page is the seed of the public detail page Phase 2 builds.
- **D-03:** **Flies are per-submission and never deduplicated.** A "fly" = one person's
  submission of a pattern, not a shared/canonical design. The same design submitted by
  different users — or by the same user more than once — produces **separate, independent
  `fly` records**, each rated separately later (Phase 3). No uniqueness constraint on
  design/name, no duplicate detection, no merge UI. This intentionally simplifies Phase 1.
- **D-04:** Photos: **multiple photos per fly with a user-selected primary/cover.** The
  primary photo is what Phase 2 catalog cards will show, so the submitter chooses which image
  leads (not just upload order). Default max **~6 photos** per fly (Claude's discretion to
  finalize the exact cap).

### Taxonomy seed
- **D-05:** Target fish are seeded at **species level**, not lumped. Trout is split into
  **Rainbow, Brown, Brook, Cutthroat** as separate fish types; this species-granularity is
  the pattern for other fish too. (Enables meaningful per-fish discovery/leaderboards later.)
- **D-06:** **6 top-level fly types:** Dry Fly, Nymph, Streamer, Wet Fly, Emerger,
  **Terrestrial**. Terrestrial is promoted to its own top-level type (not buried as a Dry Fly
  subcategory) because it's a common, distinct search.
- **D-07:** Seed depth is **lean & curated**, not comprehensive — a few of the most common
  subcategories per fly type plus ~10–12 popular gamefish. Rationale: users cannot add their
  own taxonomy until Phase 4, so the seed must cover the 80% case without cluttering the
  submit-form picklists. See "Specific Ideas" for the proposed concrete seed list.

### Claude's Discretion
- All engineering mechanics are delegated to research/planning: the exact auth/session
  implementation with `@supabase/ssr`, the specific RLS policy SQL, table/column design,
  the client-side image-compression + EXIF/GPS-strip pipeline, the recipe/material-row and
  difficulty data shapes, storage bucket path convention, and generated-types wiring. Follow
  the locked stack and RLS/image guidance in the canonical refs below.
- Final photo cap number (starting point ~6).
- Exact subcategory rows and fish-species rows within the "lean & curated" bound (proposed
  list below is a starting point the user can edit in the migration).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — product definition, personas, constraints, Key Decisions table.
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: AUTH-01…06, PROF-01, SUB-01…07, TAX-01.
- `.planning/ROADMAP.md` §"Phase 1: Foundation & Submit" — goal, success criteria, and the
  "foundation note" locking RLS-per-migration and the Next.js App Router SSR choice.

### Stack, architecture & pitfalls (locked at kickoff)
- `.claude/CLAUDE.md` — full recommended stack + exact versions, the Data Model & RLS
  Patterns section (lookup tables not enums, ratings/aggregation posture, RLS for anon
  browse + gated write), image handling (bucket `fly-photos`, path
  `{user_id}/{fly_id}/{uuid}.webp`, client-side compression on free tier), and the
  "What NOT to Use" list (`@supabase/auth-helpers`, service-role key in browser, Postgres
  enums for taxonomy, client-side average computation).
- `.planning/research/STACK.md` — versions and library rationale.
- `.planning/research/ARCHITECTURE.md` — architecture guidance.
- `.planning/research/PITFALLS.md` — known footguns to avoid during implementation.
- `.planning/research/FEATURES.md`, `.planning/research/SUMMARY.md` — feature/domain context.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None yet — greenfield.** Repo contains only a README stub and `.planning/`. No app code,
  no `package.json`. Phase 1 scaffolds the Next.js App Router project from scratch.

### Established Patterns
- No code patterns exist. The binding constraints come from CLAUDE.md/research (see canonical
  refs), not from existing code: RLS on every table in its creating migration; `@supabase/ssr`
  server/browser clients; lookup tables (not enums) for taxonomy; client-side image
  compression + EXIF/GPS strip (free tier, no Pro transforms).

### Integration Points
- This phase creates the integration surface everything downstream builds on: the Supabase
  schema + RLS policies, the seeded taxonomy tables, the `flies` table + storage bucket, and
  the auth/session/profile bootstrap. Phases 2–4 read these.

</code_context>

<specifics>
## Specific Ideas

**Proposed "lean & curated" taxonomy seed** (starting point; user can edit before the
migration ships). Fly types with a few common subcategories each, and a ~10–12 species fish
list at species-level granularity:

**Fly types → subcategories**
- **Dry Fly:** Mayfly, Caddis, Stonefly, Attractor
- **Nymph:** Mayfly Nymph, Caddis Pupa, Stonefly Nymph, Midge
- **Streamer:** Baitfish, Sculpin, Woolly Bugger / Leech
- **Wet Fly:** Soft Hackle, Winged Wet
- **Emerger:** Mayfly Emerger, Caddis Emerger
- **Terrestrial:** Ant, Beetle, Hopper

**Target fish (species-level)**
- Rainbow Trout, Brown Trout, Brook Trout, Cutthroat Trout
- Largemouth Bass, Smallmouth Bass
- Steelhead, Atlantic Salmon
- Grayling, Panfish / Bluegill, Carp, Northern Pike

Difficulty levels: beginner / intermediate / advanced (per REQUIREMENTS SUB-04).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Recipe-structure detail and signup/email-verify
UX were offered as gray areas but not selected; downstream research/planning fills those in
per requirements SUB-02/03/04 and AUTH-01…06, AUTH-02's confirm-before-submit gate.)

</deferred>

---

*Phase: 1-Foundation & Submit*
*Context gathered: 2026-07-01*
