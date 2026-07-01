---
phase: 01-foundation-submit
plan: 02
subsystem: foundation
status: complete
tags: [nextjs, supabase-ssr, rls, postgres-trigger, shadcn, scaffold]
requires: ["01-01"]
provides:
  - "src/lib/supabase/client.ts::createClient (browser)"
  - "src/lib/supabase/server.ts::createClient (server, async)"
  - "src/lib/supabase/middleware.ts::updateSession"
  - "src/middleware.ts (root middleware wired to updateSession)"
  - "src/types/database.types.ts::Database"
  - "supabase/migrations/0001_profiles_and_bootstrap.sql (profiles + handle_new_user + RLS)"
  - "src/app/u/[username]/page.tsx (public profile page, PROF-01)"
  - "vendored shadcn components: button, input, label, card, alert, form"
affects:
  - "package.json / lockfile (locked stack installed)"
  - "src/app/layout.tsx (SiteHeader mounted)"
tech-stack:
  added:
    - "next@16.2.9, react@19.2.4, react-dom@19.2.4, typescript@5"
    - "@supabase/ssr@0.12.0, @supabase/supabase-js@2.110.0"
    - "react-hook-form@7.80.0, zod@4.4.3, @hookform/resolvers@5.4.0"
    - "browser-image-compression@2.0.2, lucide-react@1.23.0, date-fns@4.4.0"
    - "tailwindcss@4, shadcn/ui (vendored), class-variance-authority, clsx, tailwind-merge, tw-animate-css"
    - "eslint@9 + eslint-config-next@16.2.9 (native flat config)"
    - "supabase CLI (dev dependency)"
  patterns:
    - "Three-client @supabase/ssr wiring (browser / server / middleware)"
    - "Middleware token refresh: getUser() called immediately after createServerClient"
    - "SECURITY DEFINER Postgres trigger for server-side profile bootstrap (no client insert)"
    - "RLS enabled in the same migration that creates the table; (select auth.uid()) wrapping"
key-files:
  created:
    - "src/lib/supabase/client.ts"
    - "src/lib/supabase/server.ts"
    - "src/lib/supabase/middleware.ts"
    - "src/middleware.ts"
    - "src/types/database.types.ts"
    - "supabase/config.toml"
    - "supabase/migrations/0001_profiles_and_bootstrap.sql"
    - "src/app/u/[username]/page.tsx"
    - "src/features/auth/sign-up-form.tsx"
    - "src/features/auth/sign-out-button.tsx"
    - "src/features/auth/site-header.tsx"
    - "components.json, eslint.config.mjs, src/lib/utils.ts"
    - "src/components/ui/{button,input,label,card,alert,form}.tsx"
  modified:
    - "src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, .gitignore"
decisions:
  - "Username collision resolved with INSERT ... ON CONFLICT (username) DO NOTHING + id-suffix fallback (corrected from the plan's DO UPDATE, which would rewrite the wrong row)."
  - "shadcn components hand-vendored (registry endpoint unreachable in this container); components.json still authored to the new-york/neutral/CSS-vars contract."
  - "database.types.ts hand-authored to match migration 0001 (supabase gen types needs Docker + a linked project, unavailable here)."
  - "Kept src/middleware.ts as the plan mandates despite a Next 16.2 deprecation warning nudging toward the new proxy convention."
metrics:
  completed: 2026-07-01
status_note: "Static verification complete; live-backend (cloud DB) verification deferred to local execution — see Deferred section."
---

# Phase 1 Plan 02: Walking Skeleton (Scaffold + @supabase/ssr + Migration 0001 + Profile Loop) Summary

Stood up the locked Next.js 16 App Router stack, the three-client `@supabase/ssr`
wiring + middleware token refresh, migration `0001` (profiles table + SECURITY
DEFINER `handle_new_user` bootstrap trigger + RLS), hand-authored DB types, an
email/password sign-up form, a server-rendered `/u/[username]` profile page, and
a header sign-out affordance — the full AUTH-01 / AUTH-05 / PROF-01 walking
skeleton, verified statically (build/lint/typecheck) with live-DB verification
deferred to local execution.

## Environment constraint (read first)

This plan executed in an **ephemeral remote container with no Docker daemon, no
Supabase CLI live-link, no live backend, and no browser**. Consequently:

- `supabase db push` (apply migration 0001 to the cloud DB) — **DEFERRED to local run**.
- `supabase gen types typescript --linked` — **DEFERRED**; `database.types.ts` was
  hand-authored to match the migration exactly and must be regenerated locally.
- Task 4's live end-to-end verification (real signup → dashboard row checks →
  hard-refresh session persistence) — **DEFERRED to local run**.

Everything else (scaffold, deps, clients, migration authoring, types, forms,
pages, RLS SQL) was completed and verified **statically**: `npm run build`,
`npm run lint`, and `npx tsc --noEmit` all exit 0.

## What was built (per task)

### Task 1 — Scaffold + shadcn + three-client @supabase/ssr wiring (commit d2740f4)
- `create-next-app@16.2` scaffold: TypeScript, Tailwind v4, App Router, `src/`
  dir, `@/*` alias. Result: `next@16.2.9`, `react@19.2.4`.
- Installed the locked runtime set at exact pins: `@supabase/ssr@0.12.0`,
  `@supabase/supabase-js@2.110.0`, `react-hook-form@7.80.0`, `zod@4.4.3`,
  `@hookform/resolvers@5.4.0`, `browser-image-compression@2.0.2`, plus
  `lucide-react`, `date-fns`, and the `supabase` CLI (dev dep).
- **shadcn:** `components.json` authored to the UI-SPEC preset — style
  `new-york`, base color `neutral`, CSS variables **on**, icon library `lucide`.
  Vendored `button/input/label/card/alert` (later `form`) + `lib/utils.ts` and a
  new-york/neutral Tailwind v4 `globals.css` (primary accent overridden to the
  Flyrate river teal `#0F766E`, destructive red-600 per UI-SPEC).
- **Clients:** `src/lib/supabase/client.ts` (`createBrowserClient<Database>`),
  `server.ts` (`createServerClient<Database>` reading `next/headers` cookies with
  the try/catch `setAll` fallback), `middleware.ts` (`updateSession` — `getUser()`
  called immediately after `createServerClient`, nothing between), and root
  `src/middleware.ts` with the documented matcher. Only the anon key is read.
- **NO `@supabase/auth-helpers`** package; **no service-role key** anywhere.

### Task 2 — Migration 0001 + DB types (commit 49b4e00)
- `supabase/migrations/0001_profiles_and_bootstrap.sql`:
  - `public.profiles (id uuid PK -> auth.users on delete cascade, username text
    unique not null, bio text, created_at timestamptz default now())`.
  - **RLS enabled in this same migration.** Public-read SELECT policy for
    `anon, authenticated using (true)`; owner-update UPDATE policy for
    `authenticated` using/with-check `(select auth.uid()) = id`.
  - `handle_new_user()` declared `language plpgsql security definer set
    search_path = public`; derives username from
    `coalesce(raw_user_meta_data->>'user_name', ->>'full_name',
    split_part(email,'@',1))`.
  - Trigger `on_auth_user_created after insert on auth.users for each row`.
  - Every `auth.uid()` wrapped as `(select auth.uid())`.
- `supabase/config.toml` authored (project_id, migrations enabled) for `db push`.
- `src/types/database.types.ts` hand-authored to the `supabase gen types` output
  shape, including the `profiles` Row/Insert/Update + the `handle_new_user`
  function entry, so the typed clients compile identically to generated output.

### Task 3 — Sign-up form + profile page + sign-out affordance (commit 9fc9d0c)
- `src/features/auth/sign-up-form.tsx` (client): react-hook-form + zod + shadcn
  Form/Input/Card/Alert. Calls
  `supabase.auth.signUp({ email, password, options: { emailRedirectTo:
  \`${origin}/auth/confirm\` } })`; on success renders the "Check your inbox"
  pending state (UI-SPEC Copywriting Contract). "already registered" maps to the
  contract's duplicate-email copy.
- `src/features/auth/site-header.tsx` (server): reads the session via the server
  client's `getUser()`, fetches the username from `profiles`, and when signed in
  shows `username` linking to `/u/[username]` + a `SignOutButton`.
- `src/features/auth/sign-out-button.tsx` (client): `supabase.auth.signOut()` +
  `router.refresh()` (AUTH-06 affordance; full flow lands in Plan 03).
- `src/app/u/[username]/page.tsx` (Server Component): fetches the `profiles` row
  by username via the server client, renders the username, `notFound()` if
  absent. This is the read half of the loop and a middleware-matched route (so
  the AUTH-05 refresh check is meaningful when performed here).
- Home page renders the sign-up form; layout mounts `SiteHeader`.

## Verifications that PASSED (static)

| Check | Result |
|-------|--------|
| `npm run build` | exit 0 (routes: `/`, `/_not-found`, `/u/[username]`, middleware) |
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `components.json` new-york / neutral / CSS-vars-on | present ✓ |
| No `@supabase/auth-helpers*` in package.json or src | none ✓ |
| No service-role key in src | none ✓ |
| Pinned versions (ssr 0.12.0, supabase-js 2.110.0, rhf 7.80.0, zod 4.4.3, resolvers 5.4.0, bic 2.0.2) | exact ✓ |
| middleware.ts: `getUser()` immediately after `createServerClient` | ✓ |
| Migration 0001 grep: `enable row level security` + `security definer` + `on conflict` + `profiles` in types | PASS ✓ |
| All `auth.uid()` wrapped as `(select auth.uid())` (3/3) | ✓ |
| signUp uses `emailRedirectTo` → `/auth/confirm` | ✓ |
| profile page `notFound()` on missing row | ✓ |
| Client components import only the browser client | ✓ |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Username-collision `ON CONFLICT` clause would rewrite the wrong row**
- **Found during:** Task 2.
- **Issue:** The plan/RESEARCH specified `insert ... on conflict (username) do
  update set username = ... || substr(new.id...)`. But `ON CONFLICT (username)
  DO UPDATE` updates the **existing conflicting row** (the *other* user's
  profile), renaming user A and still leaving the new user B with no row — a data
  corruption + broken-signup bug.
- **Fix:** Rewrote `handle_new_user()` to `INSERT ... ON CONFLICT (username) DO
  NOTHING RETURNING id`, then — only if nothing was inserted (collision) — insert
  again with the id-suffixed username. This inserts on the new user's own PK,
  never touches another row, still uses a literal `on conflict (username)` clause
  (satisfies the automated grep), and guarantees no signup transaction aborts on
  a duplicate base name (RESEARCH Open Q1 mitigation intent preserved and
  corrected).
- **Files:** `supabase/migrations/0001_profiles_and_bootstrap.sql`.
- **Commit:** 49b4e00.

**2. [Rule 3 - Blocking] shadcn interactive init / registry unreachable**
- **Found during:** Task 1.
- **Issue:** The current shadcn CLI forces interactive preset selection
  (Nova/Vega/…) which cannot run non-TTY, and the component registry endpoint
  (`ui.shadcn.com/r/...`) was unreachable from this container.
- **Fix:** Hand-authored `components.json` to the exact UI-SPEC contract
  (new-york / neutral / CSS-vars-on / lucide) and vendored the shadcn components
  by hand (this is the intended "you own the code" shadcn model). Installed the
  runtime deps (cva, clsx, tailwind-merge, tw-animate-css, radix slot/label).
- **Files:** `components.json`, `src/lib/utils.ts`, `src/app/globals.css`,
  `src/components/ui/*`.
- **Commit:** d2740f4.

**3. [Rule 3 - Blocking] ESLint 9 flat-config wiring**
- **Found during:** Task 1.
- **Issue:** `create-next-app` produced no ESLint config; the classic
  `FlatCompat` + `next/core-web-vitals` bridge threw "Converting circular
  structure to JSON" against `eslint-config-next@16.2.9`.
- **Fix:** `eslint-config-next@16` ships **native** ESLint 9 flat-config arrays;
  rewrote `eslint.config.mjs` to spread
  `eslint-config-next/core-web-vitals` + `.../typescript` directly and dropped
  the unused `@eslint/eslintrc`. `npm run lint` now exits 0.
- **Files:** `eslint.config.mjs`, `package.json`.
- **Commit:** d2740f4.

**4. [Rule 2 - Note] `lucide-react@1.23.0` version**
- Verified against the registry — `latest` is genuinely `1.23.0` (lucide crossed
  1.0 since the RESEARCH date), canonical `lucide-icons/lucide` repo. Not a
  slopsquat; no checkpoint needed.

## Deferred to local execution (live backend required)

Run these on a local machine that has Docker (optional) + the Supabase CLI and a
populated `.env.local` (real Project URL, anon key, `SUPABASE_ACCESS_TOKEN`):

```bash
# 1. Populate .env.local with the REAL values (this container has placeholders only).

# 2. Link the repo to the cloud project (project ref from the dashboard URL):
supabase link --project-ref <your-project-ref>

# 3. Apply migration 0001 to the cloud DB (Task 2 deferred step):
supabase db push

# 4. Regenerate DB types from the live schema (overwrites the hand-authored file):
supabase gen types typescript --linked > src/types/database.types.ts

# 5. Run the app and perform Task 4's human-verify checklist:
npm run dev   # http://localhost:3000
```

**Task 4 human-verify checklist (deferred):**
1. Sign up with a real email + password → confirm the "Check your inbox" state.
2. Supabase dashboard: confirm a new `auth.users` row AND a matching
   `public.profiles` row (Pitfall 1 warning sign = user but no profile row).
3. Visit `/u/<derived-username>` → the username renders server-side.
4. While signed in and **on** `/u/<username>` (a middleware-matched route),
   hard-refresh → you stay signed in (AUTH-05 — middleware token refresh, not a
   cached cookie).
5. Confirm the "Sign Out" affordance is visible in the header when authenticated.

## TDD Gate Compliance

Task 2 was marked `tdd="true"`, but its behavior is DB-level (trigger + RLS) and
cannot be RED/GREEN-executed without a live Postgres (Docker/CLI unavailable
here). The migration SQL was authored to the documented behavior and verified by
the plan's offline automated grep. Execute the behavioral RED/GREEN checks
(collision suffix, public read, owner-only update, RLS-enabled) locally after
`supabase db push` — they map 1:1 to the `<behavior>` bullets in the plan.

## Known Stubs

- `SignOutButton` is a functional affordance (calls `signOut()` + refresh) but
  the full sign-out flow/redirect polish lands in Plan 03 — intentional, tracked.
- `src/types/database.types.ts` is hand-authored; regenerate locally (deferred
  step 4) to pick up any schema drift and each later migration's tables.

## Follow-ups / notes

- Next 16.2 emits a deprecation warning nudging `middleware.ts` → `proxy`. Kept
  `middleware.ts` as the plan mandates and as Supabase's SSR docs document;
  migrating to the `proxy` convention is a low-risk future chore.

## Self-Check: PASSED

All 16 spot-checked created files exist on disk; all 3 per-task commits
(d2740f4, 49b4e00, 9fc9d0c) are present in git history.
