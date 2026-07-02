---
phase: 01-foundation-submit
verified: 2026-07-02T00:00:00Z
status: human_needed
score: 5/5 must-haves structurally verified (present + substantive + wired); behavioral confirmation deferred to local live backend
behavior_unverified: 0
overrides_applied: 0
verdict: VERIFIED-WITH-DEFERRALS
requirements_covered: 15/15
notes: >
  Every statically-checkable artifact for Phase 1 exists on disk, is substantive
  (not a stub), and is wired end-to-end. All remaining verification is genuinely
  behavioral/live-backend (real signup, OAuth round-trip, email-confirm, EXIF
  strip on a real photo, RLS rejection against a live DB) and is correctly
  deferred to the user's local run with documented steps — NOT unmet. No code
  gaps found. One quality WARNING on the RLS integration test (below).
human_verification:
  - test: "Sign up with email/password locally; confirm an auth.users row AND a public.profiles row are created by the trigger; visit /u/<username> and confirm it renders server-side; hard-refresh /u/<username> while signed in and confirm the session survives."
    expected: "Profile row auto-created (no client insert); username renders; session persists across refresh (AUTH-01/05, PROF-01)."
    why_human: "Requires a live Supabase cloud DB, real signup, and a browser — no backend/browser in this container."
  - test: "Complete Google and GitHub OAuth sign-in via /auth/sign-in; confirm the callback exchanges the code and lands you signed in. Hit /auth/callback?next=https://evil.example and //evil.example and confirm you land on / (open-redirect guard)."
    expected: "Both providers sign you in; foreign-origin next is rejected (AUTH-03/04, T-03-01)."
    why_human: "Requires configured OAuth apps + live GoTrue round-trip; safeNext logic is code-verified but the live redirect needs a browser."
  - test: "Click a real email-confirmation link; confirm you land on your destination already signed in (never bounced to sign-in)."
    expected: "verifyOtp confirms + signs in; redirect straight to destination (AUTH-02, Pitfall 5)."
    why_human: "Requires the live email template + a real token_hash."
  - test: "As a CONFIRMED user, submit a fully-cataloged fly (>=2 photos incl. a real portrait phone photo, non-first cover, >=2 ordered materials, hook size, thread, difficulty, fly type + subcategory, >=1 fish); confirm redirect to /flies/[id] with everything rendered, cover leading, portrait not sideways."
    expected: "Fly inserts + children insert; author sees it on /flies/[id] with the 'Your fly is live.' banner (SUB-01..06, D-02)."
    why_human: "Requires live DB + Storage + a real photo + browser."
  - test: "Open an uploaded Storage object and confirm it is webp with NO GPS/EXIF metadata."
    expected: "Photo is compressed webp, EXIF/GPS stripped (SUB-07)."
    why_human: "Requires inspecting a real uploaded binary in live Storage."
  - test: "As an UNCONFIRMED user, confirm the Submit button is disabled with the 'Confirm your email' alert AND a direct PostgREST insert into flies (bypassing the UI) is REJECTED by RLS."
    expected: "DB-level email-confirmed gate blocks the write, not just the UI (AUTH-02 / T-04-02)."
    why_human: "Requires migrations 0002-0006 applied to a live DB and an authenticated-unconfirmed session."
deferred_to_local:
  - "supabase db push (apply migrations 0002-0006 to the cloud DB) — [BLOCKING] Task 2, no Docker/CLI-link in container."
  - "supabase gen types typescript --linked (regenerate DB types; currently hand-authored to match the SQL)."
  - "npx vitest run flies-insert-rls.integration.test.ts (needs live DB + vitest install; skips cleanly without env vars)."
  - "Supabase Security Advisor check for 'RLS disabled' findings post-push."
warnings:
  - id: W-1
    severity: warning
    title: "RLS integration test does not isolate the email-confirmed gate"
    detail: >
      flies-insert-rls.integration.test.ts inserts a flies row WITHOUT fly_type_id
      or fly_subcategory_id, which are NOT NULL FKs. The insert would therefore be
      rejected by the NOT NULL/FK constraint even if the is_email_confirmed() RLS
      WITH CHECK were removed — so a green test does not independently PROVE the
      AUTH-02 DB gate (a confirmed user with the same payload is rejected too). The
      test's own comment acknowledges this. The RLS policy itself IS correct
      (verified in 0005). Recommend strengthening the test to supply valid taxonomy
      IDs so the ONLY reason for rejection is the email-confirmed predicate.
    blocking: false
---

# Phase 1: Foundation & Submit — Verification Report

**Phase Goal:** A signed-in angler can create an account and submit a fully-cataloged fly (photos, recipe, description, difficulty, fly type/subcategory, target fish), and see it exists.
**Verified:** 2026-07-02
**Status:** human_needed (VERDICT: **VERIFIED-WITH-DEFERRALS**)
**Re-verification:** No — initial verification
**Mode:** mvp

## Executive Verdict

**VERIFIED-WITH-DEFERRALS.** Every artifact that can be checked statically in this
ephemeral container — 6 SQL migrations, all RLS policies, the three-client
`@supabase/ssr` wiring + middleware, both OAuth flows, the email-confirm route,
the `is_email_confirmed()` DB gate, the zod schema, the submit form + Server
Action, the compress/EXIF-strip photo pipeline, the seeded taxonomy, and the
author-visible detail page — **exists, is substantive (no stubs), and is wired
end-to-end.** All 15 phase requirement IDs are accounted for across the four plan
frontmatters. No code gaps were found.

The only remaining verification is genuinely behavioral and needs a live Supabase
backend + browser (real signup/trigger, OAuth round-trips, email-confirm,
EXIF-strip on a real photo, and the live RLS rejection). Per the phase's own
plans these are the documented, correctly-deferred `autonomous:false` /
`checkpoint:human-verify` steps — they are **deferred, not unmet**. Status is
`human_needed` solely because those live checks await a local run.

## (a) Statically Verified — Complete

### Observable Truths (Success Criteria)

| # | Truth (ROADMAP SC) | Static Status | Evidence |
|---|--------------------|---------------|----------|
| 1 | Sign up email/pw (w/ verification) OR Google/GitHub; session survives refresh; sign out from any page | ✓ PRESENT + WIRED | `sign-up-form.tsx` (signUp+emailRedirectTo), `oauth-buttons.tsx` (google+github signInWithOAuth), `callback/route.ts` (exchangeCodeForSession), `middleware.ts` (updateSession→getUser), `sign-out-button.tsx` + `user-menu.tsx` in `site-header.tsx` mounted in `layout.tsx` |
| 2 | Every user auto-gets a public profile at signup, server-side bootstrap, no client insert | ✓ PRESENT + WIRED | `0001` `handle_new_user()` SECURITY DEFINER trigger `on_auth_user_created`; `u/[username]/page.tsx` server-fetches + `notFound()` |
| 3 | Confirmed user submits fly w/ photos, structured recipe, description, difficulty | ✓ PRESENT + WIRED | `submit-fly-form.tsx` (useFieldArray recipe, photos, difficulty radio, Textarea), `submit-fly-action.ts` (`'use server'`, re-parse, insert flies+materials+fish+photos, redirect), `0005` schema |
| 4 | Submit form only offers predefined admin-managed taxonomy | ✓ VERIFIED | `taxonomy.ts` fetches only `fly_types`/`fly_subcategories`/`fish_types`; FKs enforce; no free-text path; `0003`/`0004` lookup tables + seed |
| 5 | Photos client-compressed + EXIF/GPS-stripped before storage; fly retrievable/visible to author | ✓ PRESENT + WIRED | `photo-pipeline.ts` browser-image-compression → webp, `preserveExif` omitted (default false); owner-prefix path; `flies/[id]/page.tsx` renders everything via getPublicUrl |

**Score:** 5/5 structurally verified (present + substantive + wired). Behavioral confirmation of each is deferred to the live-backend human checks above.

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `0001_profiles_and_bootstrap.sql` | ✓ VERIFIED | profiles table, RLS in-file, SECURITY DEFINER trigger, ON CONFLICT collision handling (corrected to insert-on-own-PK), `(select auth.uid())` wrapped |
| `0002_email_confirmed_helper.sql` | ✓ VERIFIED | `is_email_confirmed()` SQL SECURITY DEFINER STABLE, reads `email_confirmed_at`, grants to anon/authenticated |
| `0003_taxonomy.sql` | ✓ VERIFIED | 3 lookup tables (no enums), RLS in-file, public-read, subcategory single-FK |
| `0004_taxonomy_seed.sql` | ✓ VERIFIED | 6 fly types, 18 subcategories, 12 fish; Ant/Beetle/Hopper only under Terrestrial |
| `0005_flies_photos_and_rls.sql` | ✓ VERIFIED | flies + 3 children, RLS in-file, flies-insert WITH CHECK = `(select auth.uid())=author_id AND is_email_confirmed()`, child writes gated on parent ownership, difficulty CHECK, no dedup unique |
| `0006_storage_bucket.sql` | ✓ VERIFIED | public `fly-photos` bucket, owner-prefix `(storage.foldername(name))[1] = (select auth.uid())::text` on insert/update/delete |
| `src/lib/supabase/{client,server,middleware}.ts` + `src/middleware.ts` | ✓ VERIFIED | three-client ssr wiring; getUser() immediately after createServerClient; matcher present |
| `src/types/database.types.ts` | ✓ VERIFIED (hand-authored) | all 7 tables + `is_email_confirmed` present; regenerate locally post-push |
| `src/features/auth/*` | ✓ VERIFIED | redirect(safeNext), oauth-buttons, sign-in/up forms, user-menu, sign-out |
| `src/app/auth/{callback,confirm}/route.ts` | ✓ VERIFIED | distinct routes; exchangeCodeForSession vs verifyOtp; both via safeNext |
| `src/features/submit/*` | ✓ VERIFIED | schema, taxonomy, photo-pipeline, action, form |
| `src/app/flies/{new,[id]}` | ✓ VERIFIED | auth-gated new page; detail page renders full fly, no dangerouslySetInnerHTML |

### Key Links

| From → To | Via | Status |
|-----------|-----|--------|
| flies INSERT → auth gate | RLS WITH CHECK calls `is_email_confirmed()` AND `author_id` check (0005) | ✓ WIRED |
| storage write → owner prefix | `(storage.foldername(name))[1] = (select auth.uid())::text` (0006) | ✓ WIRED |
| photo pipeline → EXIF strip | browser-image-compression, `preserveExif` never true | ✓ WIRED |
| subcategory → single fly_type | FK `fly_type_id` + `unique(fly_type_id,name)`; seed joins by slug | ✓ WIRED |
| middleware → session persistence | `updateSession()` on matched routes, getUser() refresh | ✓ WIRED |
| sign-out → any page | shared browser client signOut, user-menu in layout header | ✓ WIRED |

### Requirements Coverage (15/15)

| Req | Plan | Status | Evidence |
|-----|------|--------|----------|
| AUTH-01 | 01-02 | ✓ (behavior deferred) | sign-up-form signUp + emailRedirectTo |
| AUTH-02 | 01-03/04 | ✓ (behavior deferred) | confirm route verifyOtp; is_email_confirmed() gate in 0002/0005 |
| AUTH-03 | 01-01/03 | ✓ (behavior deferred) | oauth-buttons google + callback |
| AUTH-04 | 01-01/03 | ✓ (behavior deferred) | oauth-buttons github + callback |
| AUTH-05 | 01-02 | ✓ (behavior deferred) | middleware updateSession |
| AUTH-06 | 01-03 | ✓ VERIFIED | sign-out-button + user-menu in header (any page) |
| PROF-01 | 01-02 | ✓ (behavior deferred) | handle_new_user trigger + /u/[username] |
| SUB-01 | 01-04 | ✓ (behavior deferred) | photo-pipeline + fly_photos + form |
| SUB-02 | 01-04 | ✓ VERIFIED | fly_materials ordered + hook_size/thread + useFieldArray |
| SUB-03 | 01-04 | ✓ VERIFIED | description column + Textarea |
| SUB-04 | 01-04 | ✓ VERIFIED | difficulty CHECK + radio group |
| SUB-05 | 01-04 | ✓ VERIFIED | fly_type/subcategory FKs + cascade select |
| SUB-06 | 01-04 | ✓ VERIFIED | fly_fish_types junction + multi-select |
| SUB-07 | 01-04 | ✓ (behavior deferred) | browser-image-compression webp, preserveExif default false |
| TAX-01 | 01-04 | ✓ VERIFIED | lookup tables + seed + fetchTaxonomy, no free-text |

No orphaned requirements — all 15 phase IDs are claimed by a plan.

### Anti-Pattern Scan

| Check | Result |
|-------|--------|
| Debt markers (TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER) in src | none |
| Service-role key in src/env | none |
| `@supabase/auth-helpers*` (forbidden) | none |
| Postgres `enum` type for taxonomy (forbidden) | none |
| `dangerouslySetInnerHTML` under src/app/flies | none |
| Version pins (ssr 0.12.0, supabase-js 2.110.0, rhf 7.80.0, zod 4.4.3, resolvers 5.4.0, bic 2.0.2, next 16.2.9, react 19.2.4) | exact match |

## (b) Correctly Deferred to Local (live backend / browser)

These are documented in the SUMMARYs as `autonomous:false` / `checkpoint:human-verify`
steps and are legitimately impossible in this Docker-less, backend-less,
browser-less container. They are **not gaps**:

1. `supabase db push` — apply migrations 0002-0006 to the cloud DB ([BLOCKING] Plan 04 Task 2).
2. `supabase gen types typescript --linked` — regenerate `database.types.ts` (currently hand-authored to match the SQL exactly).
3. `npx vitest run flies-insert-rls.integration.test.ts` — needs a live DB + `npm i -D vitest`; skips cleanly without env vars.
4. Supabase Security Advisor — confirm no "RLS disabled" finding post-push.
5. The 6 human-verify behavioral checks listed in the frontmatter (`human_verification`).

Static verification already passed per SUMMARYs and re-confirmed here: `npm run build`, `npx tsc --noEmit`, `npm run lint` exit 0.

## (c) Genuine Concerns

**No blockers.** One quality WARNING:

- **W-1 (warning, non-blocking) — RLS integration test does not isolate the email-confirmed gate.**
  `flies-insert-rls.integration.test.ts` attempts a flies insert WITHOUT the NOT NULL
  FK columns `fly_type_id` / `fly_subcategory_id`, so the insert is rejected by the
  NOT NULL/FK constraint regardless of whether the `is_email_confirmed()` RLS
  predicate exists. A passing test therefore does not independently PROVE the
  AUTH-02 DB gate (the same payload from a *confirmed* user is also rejected). The
  RLS policy itself is correct in `0005`; only the automated proof is weaker than
  the SUMMARY claims ("proven automatically"). **Recommendation:** strengthen the
  test to supply valid seeded taxonomy IDs so the sole rejection cause is the
  email-confirmed predicate — then it truly isolates AUTH-02. The test comment
  already acknowledges the ambiguity.

## Gaps Summary

No code gaps. All Phase 1 artifacts are present, substantive, and wired. The
phase goal is achievable pending the documented live-backend behavioral
confirmation (deferred to the user's local run). Verdict: **VERIFIED-WITH-DEFERRALS.**

---

_Verified: 2026-07-02_
_Verifier: Claude (gsd-verifier)_
