---
phase: 01-foundation-submit
plan: 04
subsystem: submit
status: complete
tags: [taxonomy, flies, storage, rls, submit-form, react-hook-form, zod, exif-strip, ssr]
requires: ["01-02", "01-03"]
provides:
  - "supabase/migrations/0003_taxonomy.sql (fly_types, fly_subcategories, fish_types + public-read RLS)"
  - "supabase/migrations/0004_taxonomy_seed.sql (6 fly types, 18 subcategories, 12 fish)"
  - "supabase/migrations/0005_flies_photos_and_rls.sql (flies, fly_materials, fly_fish_types, fly_photos + owner/confirmed RLS)"
  - "supabase/migrations/0006_storage_bucket.sql (fly-photos bucket + storage.objects owner-prefix RLS)"
  - "src/features/submit/submit-fly-schema.ts::submitFlySchema, submitFlyFormSchema, SubmitFlyInput, MAX_PHOTOS"
  - "src/features/submit/taxonomy.ts::fetchTaxonomy, TaxonomyOptions"
  - "src/features/submit/photo-pipeline.ts::prepareForUpload, uploadPhoto, PHOTO_BUCKET"
  - "src/features/submit/submit-fly-action.ts::submitFlyAction (server action insert + redirect)"
  - "src/features/submit/submit-fly-form.tsx::SubmitFlyForm (single-scroll RHF+zod form)"
  - "src/app/flies/new/page.tsx (submit form shell)"
  - "src/app/flies/[id]/page.tsx (author-visible detail page — D-02 payoff)"
  - "src/app/flies/[id]/not-found.tsx"
  - "src/components/ui/{textarea,badge,select-native}.tsx (vendored, no new radix deps)"
affects:
  - "src/types/database.types.ts (extended with taxonomy + flies schema)"
  - "tsconfig.json (excludes test files from the app build)"
tech-stack:
  added: []
  patterns:
    - "Recipe = fly-level scalar columns (hook_size, thread) + ordered fly_materials child table, not a jsonb blob (SUB-02 queryable)"
    - "Client generates flyId (crypto.randomUUID) so photos upload under {userId}/{flyId}/{uuid}.webp before the row exists; action inserts flies with that explicit id"
    - "Two-schema split: submitFlyFormSchema (RHF fields) vs submitFlySchema (full payload incl. photoPaths/primaryPhotoIndex, re-parsed server-side)"
    - "browser-image-compression with preserveExif omitted (defaults false) = SUB-07 EXIF/GPS strip; fileType image/webp"
    - "Native-HTML vendored UI (SelectNative, radio buttons, toggle chips) to honor T-04-SC no-new-installs — Plan 03 precedent"
    - "RLS WITH CHECK ((select auth.uid()) = author_id AND public.is_email_confirmed()) is the AUTH-02 gate; Server Action is validation+convenience only"
key-files:
  created:
    - "supabase/migrations/0003_taxonomy.sql"
    - "supabase/migrations/0004_taxonomy_seed.sql"
    - "supabase/migrations/0005_flies_photos_and_rls.sql"
    - "supabase/migrations/0006_storage_bucket.sql"
    - "src/features/submit/submit-fly-schema.ts"
    - "src/features/submit/taxonomy.ts"
    - "src/features/submit/photo-pipeline.ts"
    - "src/features/submit/submit-fly-action.ts"
    - "src/features/submit/submit-fly-form.tsx"
    - "src/features/submit/__tests__/flies-insert-rls.integration.test.ts"
    - "src/app/flies/new/page.tsx"
    - "src/app/flies/[id]/page.tsx"
    - "src/app/flies/[id]/not-found.tsx"
    - "src/components/ui/textarea.tsx"
    - "src/components/ui/badge.tsx"
    - "src/components/ui/select-native.tsx"
  modified:
    - "src/types/database.types.ts"
    - "tsconfig.json"
decisions:
  - "Photo cap finalised at 6 (D-04, MAX_PHOTOS)."
  - "flyId generated client-side and passed to the Server Action so upload paths and the flies row agree; RLS gates on author_id + confirmed, not on id, so an explicit id is safe."
  - "Vendored native-HTML SelectNative / radio group / fish toggle chips instead of Radix Select/RadioGroup/ToggleGroup to honor T-04-SC (no new package installs) — same UX, zero new deps. Swapping in Radix later is a low-risk refactor."
  - "Detail page uses CSS aspect-ratio utilities instead of a Radix AspectRatio component for the same no-new-deps reason."
  - "Test files excluded from tsconfig so the authored-but-deferred Vitest integration test (imports the uninstalled vitest) does not break npm run build."
  - "Child-table (materials/fish/photos) writes gated on ownership of the parent fly via a subquery on flies.author_id."
metrics:
  completed: 2026-07-02
  duration_min: 18
status_note: "Static verification complete (build/tsc/lint all exit 0; all migration + code files present with correct content). Task 2's cloud `supabase db push` (applies 0002-0006) and Task 6's live human-verify are DEFERRED to local — no Docker/live backend/browser in this container. The Vitest RLS test is authored + build-safe (skips without env vars); it runs against a live DB locally."
---

# Phase 1 Plan 04: Taxonomy + Submit → See-It-Exist Slice Summary

Delivered the phase's core payoff as one vertical slice: the admin-managed
taxonomy (lookup tables + seed), the flies/photos/materials/junction schema with
owner-and-confirmed RLS, the `fly-photos` storage bucket with owner-prefix RLS,
the single-scroll submit form (react-hook-form + zod + `useFieldArray`) with a
client-side compress + EXIF/GPS-strip photo pipeline, a Server Action that
re-validates and inserts, and the author-visible `/flies/[id]` detail page. All
authored and statically verified; the cloud push and live human-verify are the
two deferred, non-autonomous steps.

## Environment constraint (read first)

Executed in the same **ephemeral remote container** as Plans 02/03: **no Docker
daemon, no live backend, no browser**. The Supabase CLI is present as a dev
dependency but `.env.local` holds placeholders only, so a real `db push` cannot
run here. Consequently:

- **Task 2 `supabase db push` (applies 0002-0006) — DEFERRED to local.** This is
  the plan's `[BLOCKING]` step and is `autonomous: false` precisely because it may
  need a human when the CLI/token/link is out of reach. It was NOT faked. Run
  locally (see "Deferred to local" below). `database.types.ts` was hand-authored
  to match the new SQL exactly (the `gen types` regen is part of the local push).
- **Task 6 human-verify — DEFERRED to local.** Needs the running app + a real
  portrait photo + the live DB; documented as a local checklist below.
- The **Vitest RLS integration test** is authored and build-safe: it **skips**
  cleanly when the Supabase env vars are absent (so it never fails a
  credential-less CI) and **runs against the live cloud DB** once env vars are set
  and migrations 0002-0006 are applied.

## What was built (per task)

### Task 1 — Migrations 0003-0006 (commit 4a1a7ac)
- **0003_taxonomy.sql**: `fly_types`, `fly_subcategories` (FK `fly_type_id` +
  `unique(fly_type_id, name)` + `unique(fly_type_id, slug)`), `fish_types` — lookup
  TABLES, never enums (grep confirms no `create type … as enum`). RLS enabled
  in-file; public-read SELECT for `anon, authenticated` using `true`; no client
  write path (TAX-01 admin-managed).
- **0004_taxonomy_seed.sql**: 6 fly types (Dry Fly, Nymph, Streamer, Wet Fly,
  Emerger, Terrestrial — D-06), 18 subcategories joined to their type by slug
  (Ant/Beetle/Hopper ONLY under Terrestrial — Pitfall 3), 12 species-level fish
  (trout split into Rainbow/Brown/Brook/Cutthroat — D-05).
- **0005_flies_photos_and_rls.sql**: `flies` (scalar `hook_size`/`thread`/
  `description`, `difficulty` CHECK in beginner/intermediate/advanced, `author_id`,
  `fly_type_id`, `fly_subcategory_id`, `primary_photo_id`, `created_at` — no
  uniqueness on name/design per D-03), `fly_materials` (ordered `position` +
  free-text label/material/color), `fly_fish_types` junction (SUB-06),
  `fly_photos` (D-04). RLS in-file on all four; public read; flies-insert
  `WITH CHECK ((select auth.uid()) = author_id AND public.is_email_confirmed())`
  (AUTH-02 DB gate); child writes gated on ownership of the parent fly. Every
  `auth.uid()` wrapped as `(select auth.uid())`.
- **0006_storage_bucket.sql**: public `fly-photos` bucket (idempotent insert);
  `storage.objects` public-read SELECT; insert/update/delete policies gated on
  `(storage.foldername(name))[1] = (select auth.uid())::text` (owner-prefix write,
  T-04-03).

### Task 2 — Consolidated push + types (commit 317b55d; push DEFERRED)
- Hand-authored `src/types/database.types.ts` to include `fly_types`,
  `fly_subcategories`, `fish_types`, `flies`, `fly_materials`, `fly_fish_types`,
  `fly_photos` (Row/Insert/Update + Relationships) and the `is_email_confirmed`
  function — `npx tsc --noEmit` exits 0.
- The actual `supabase db push` (applies 0002-0006, with 0002's
  `is_email_confirmed()` live before 0005 relies on it) + `gen types --linked`
  regen are the deferred local step.

### Task 3 — Schema, taxonomy fetch, photo pipeline (commit a91161f)
- `submit-fly-schema.ts`: `submitFlyCore` shared shape → `submitFlyFormSchema`
  (RHF fields) and `submitFlySchema` (full, adds `photoPaths` 1..6 +
  `primaryPhotoIndex`, with a refine that the cover index is in range). `MAX_PHOTOS = 6`.
- `taxonomy.ts`: `fetchTaxonomy()` server-side reads the three lookup tables and
  returns `flyTypes`, `subcategoriesByFlyType` (pre-grouped for the cascade),
  `fishTypes` (TAX-01 — options only from the lookup tables).
- `photo-pipeline.ts`: `prepareForUpload` (browser-image-compression → webp,
  `preserveExif` omitted = default false = SUB-07 strip) + `uploadPhoto` building
  `{userId}/{flyId}/{uuid}.webp` and uploading to `fly-photos`.

### Task 4 — Submit form + Server Action + RLS test (commit 7d6ce02)
- `submit-fly-form.tsx` (client): single scrollable page (D-01), one Card per
  section (Name, Photos, Recipe, Taxonomy, Difficulty, Description). Materials via
  `useFieldArray` keyed by `field.id` (Pitfall 4) with up/down reorder + remove;
  photos in component state with per-file previews, user-selected cover, and the
  6-photo cap; fly-type → subcategory cascade (SelectNative, subcategory disabled
  until a type is chosen); fish multi-select toggle chips (>=1); difficulty radio
  group; description Textarea. Submit button disabled + an Alert shown when
  `email_confirmed_at` is null, with a "Resend confirmation email" action.
- `submit-fly-action.ts` (`'use server'`): re-parses the full payload with
  `submitFlySchema`, inserts `flies` (author_id = uid), then ordered
  `fly_materials`, `fly_fish_types`, `fly_photos`, sets `primary_photo_id` from
  the chosen cover, and `redirect(/flies/${id}?submitted=1)` (D-02).
- `flies-insert-rls.integration.test.ts`: signs up an unconfirmed user via the
  anon client and asserts a direct `flies` INSERT is RLS-rejected (AUTH-02 DB gate
  proven automatically). Skips without env vars; excluded from the app build via
  tsconfig so the uninstalled-vitest import never breaks `npm run build`.
- `/flies/new/page.tsx`: redirects unauthenticated users to
  `/auth/sign-in?next=/flies/new`, fetches taxonomy, passes user id/email +
  confirmed flag to the form.

### Task 5 — /flies/[id] detail page (commit ab4c9b6)
- `flies/[id]/page.tsx` (Server Component): joins photos (cover first via
  `primary_photo_id`), materials (ordered), fish names, and fly-type/subcategory
  names; renders the name, cover photo large + gallery (CSS aspect-ratio), Badge
  chips (type/subcategory/difficulty/fish), the recipe as a definition list, the
  description as escaped body text (no raw-HTML injection — T-04-05), a read-only
  "No ratings yet" star stub, and the dismissible "Your fly is live." banner on
  `?submitted=1`. Photos via `getPublicUrl`.
- `flies/[id]/not-found.tsx`: rendered when `notFound()` fires on an unknown id.

### Task 6 — End-to-end human-verify — DEFERRED to local (see checklist).

## Interfaces downstream phases consume

```
public.flies, fly_materials, fly_fish_types, fly_photos            -- schema (0005)
public.fly_types, fly_subcategories, fish_types                    -- taxonomy (0003/0004)
storage bucket 'fly-photos' + owner-prefix RLS                     -- (0006)
/flies/[id]                                                        -- Phase 2 makes this public/SEO
submitFlySchema / submitFlyFormSchema                              -- src/features/submit/submit-fly-schema.ts
```

## MIGRATION NUMBERING LOCK

**Phase 1 owns migrations `0001`–`0006`** (0001 profiles/bootstrap; 0002
is_email_confirmed helper; 0003 taxonomy; 0004 taxonomy seed; 0005 flies/photos/RLS;
0006 storage bucket). Any downstream phase (Phase 2+) MUST start at `0007_*` and
continue sequentially — never renumber, reuse, or interleave with 0001-0006.

## Verifications that PASSED (static)

| Check | Result |
|-------|--------|
| `npm run build` | exit 0 (routes incl. `/flies/new`, `/flies/[id]`) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 (1 benign React-Compiler warning on RHF `watch()`) |
| 0003 & 0005 contain `enable row level security`; no `create type … as enum` | ✓ |
| 0005 flies-insert WITH CHECK references BOTH `(select auth.uid()) = author_id` AND `is_email_confirmed()` | ✓ |
| 0006 uses `(storage.foldername(name))[1] = (select auth.uid())::text` | ✓ |
| Seed: 6 fly types + 12 fish; Ant/Beetle/Hopper only under Terrestrial | ✓ |
| No `flies` uniqueness constraint on name/design (D-03) | ✓ |
| Every `auth.uid()` wrapped as `(select auth.uid())` in new migrations | ✓ |
| `photo-pipeline.ts` uses browser-image-compression → webp, never `preserveExif: true` | ✓ |
| schema validates >=1 material, >=1 fish, 1..6 photos, difficulty enum, uuids, primary index | ✓ |
| form uses `useFieldArray` keyed by `field.id`; action is `'use server'`, re-parses `submitFlySchema`, `redirect`s | ✓ |
| no `dangerouslySetInnerHTML` under `src/app/flies/` | ✓ |
| `database.types.ts` includes flies/fly_types/fly_subcategories/fish_types/fly_materials/fly_fish_types/fly_photos | ✓ |

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 3 - Blocking, adjusted] Native-HTML vendored UI instead of new Radix deps.**
- **Found during:** Tasks 4 & 5.
- **Issue:** The UI-SPEC calls for shadcn `Select`, `RadioGroup`, `ToggleGroup`,
  `AspectRatio` — each needs a `@radix-ui/*` package not installed. Threat
  **T-04-SC** forbids new package installs this plan, and package installs are
  excluded from Rule 3 auto-fix.
- **Fix:** Vendored `SelectNative` (styled native `<select>`), native radio
  buttons for difficulty, and native toggle-chip buttons for the fish multi-select;
  used CSS `aspect-*` utilities on the detail page. Same UX, spacing, focus ring,
  and typography; zero new deps. Follows the Plan 03 precedent (native
  details/summary user-menu, vendored Separator).
- **Files:** `select-native.tsx`, `textarea.tsx`, `badge.tsx`, `submit-fly-form.tsx`,
  `flies/[id]/page.tsx`.
- **Commits:** 7d6ce02, ab4c9b6.

**2. [Rule 3 - Blocking] Excluded test files from the app tsconfig.**
- **Found during:** Task 4.
- **Issue:** `tsconfig.json` includes `**/*.ts`, so the authored integration test
  importing the uninstalled `vitest` would raise TS2307 and break `npm run build`.
- **Fix:** Added `**/__tests__/**` + `**/*.test.ts(x)` to tsconfig `exclude`. The
  test remains authored for local execution (with vitest + a live DB); the app
  build is clean.
- **Files:** `tsconfig.json`.
- **Commit:** 7d6ce02.

**3. [Rule 3 - Blocking] Reworded a code comment to satisfy the plan's own `! grep`.**
- **Found during:** Task 5.
- **Issue:** The detail page's XSS-safety comment literally contained the token
  `dangerouslySetInnerHTML`, tripping the plan's `! grep -rq "dangerouslySetInnerHTML"`
  automated check.
- **Fix:** Reworded the comment to "raw HTML injection is never used". No behavior
  change; the check now passes.
- **Files:** `flies/[id]/page.tsx`.
- **Commit:** ab4c9b6.

## Deferred to local execution (live backend required)

```bash
# 1. Populate .env.local with the real Project URL, anon key, and SUPABASE_ACCESS_TOKEN.
# 2. Link + consolidated push (applies 0002-0006; 0002 goes live here for the first time):
supabase link --project-ref <ref>          # uses SUPABASE_ACCESS_TOKEN for non-TTY auth
supabase db push                           # applies 0002 → 0003 → 0004 → 0005 → 0006 in order
# 3. Regenerate types to confirm the hand-authored file matches:
supabase gen types typescript --linked > src/types/database.types.ts
# 4. Confirm is_email_confirmed() exists and the fly-photos bucket exists;
#    run the Security Advisor and confirm NO "RLS disabled" finding on any public table.
# 5. Automated AUTH-02 gate:
npm install -D vitest
npx vitest run src/features/submit/__tests__/flies-insert-rls.integration.test.ts
```

### Task 6 human-verify checklist (deferred)
1. `npm run dev`; sign in as a CONFIRMED user; `/flies/new` lists the 6 seeded fly
   types and only seeded subcategory/fish options (TAX-01).
2. Add >=2 photos (one real portrait phone photo), pick a non-first cover, add >=2
   ordered material rows, hook size + thread, difficulty, fly type + subcategory +
   >=1 fish; submit.
3. Redirect to `/flies/[id]` with the "Your fly is live." banner and everything
   rendered; portrait photo NOT sideways (A4 orientation) and the chosen cover leads.
4. In Storage, confirm an uploaded object is webp and carries NO GPS/EXIF (SUB-07).
5. As an UNCONFIRMED user: Submit disabled + "Confirm your email…" Alert; a direct
   insert is RLS-rejected (AUTH-02 DB gate — also proven by the Vitest test).

## Known Stubs

- **Read-only rating display** on `/flies/[id]` ("No ratings yet", 5 outline
  stars) is an intentional stub — interactive rating is Phase 3 (RATE-*), out of
  scope here. Not a data stub: everything the author entered is really rendered.

## Threat Flags

None. No new security surface beyond the plan's `<threat_model>` — the schema,
RLS, storage policy, EXIF strip, server-side re-validation, and no-raw-HTML render
all match the registered mitigations (T-04-01..07).

## Self-Check: PASSED

All 16 created + 2 modified files exist on disk; all 5 per-task commits
(4a1a7ac, 317b55d, a91161f, 7d6ce02, ab4c9b6) are present in git history; the
working tree is clean; build/tsc/lint all exit 0.
