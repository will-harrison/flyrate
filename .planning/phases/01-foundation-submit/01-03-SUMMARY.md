---
phase: 01-foundation-submit
plan: 03
subsystem: auth
status: complete
tags: [oauth, supabase-ssr, verify-otp, exchange-code, rls, open-redirect, shadcn]
requires: ["01-02"]
provides:
  - "src/features/auth/redirect.ts::safeNext (same-origin redirect validator)"
  - "src/app/auth/callback/route.ts (OAuth code exchange — AUTH-03/AUTH-04)"
  - "src/app/auth/confirm/route.ts (email OTP verify — AUTH-02)"
  - "src/features/auth/oauth-buttons.tsx::OAuthButtons (google + github)"
  - "src/features/auth/sign-in-form.tsx::SignInForm (signInWithPassword)"
  - "src/features/auth/user-menu.tsx::UserMenu (AUTH-06 sign-out from any page)"
  - "src/features/auth/sign-out-button.tsx::SignOutButton"
  - "src/app/auth/sign-in/page.tsx, src/app/auth/sign-up/page.tsx, src/app/auth/error/page.tsx"
  - "src/components/ui/separator.tsx (vendored, no new radix dep)"
  - "supabase/migrations/0002_email_confirmed_helper.sql (public.is_email_confirmed() — AUTHORED; APPLIED in Plan 04 Task 2)"
affects:
  - "src/features/auth/site-header.tsx (user-menu when signed in; Sign In / Create Account when signed out)"
tech-stack:
  added: []
  patterns:
    - "Two distinct auth callback routes: /auth/callback (exchangeCodeForSession) vs /auth/confirm (verifyOtp) — never conflated"
    - "safeNext() same-origin open-redirect guard applied in BOTH callback routes"
    - "SECURITY DEFINER stable SQL helper for a DB-level email-confirmed write gate"
    - "verifyOtp both confirms AND signs in — redirect straight to destination (Pitfall 5)"
    - "Native details/summary dropdown to avoid a new @radix-ui dep (T-03-SC no-new-installs)"
key-files:
  created:
    - "src/features/auth/redirect.ts"
    - "src/features/auth/oauth-buttons.tsx"
    - "src/features/auth/sign-in-form.tsx"
    - "src/features/auth/user-menu.tsx"
    - "src/app/auth/callback/route.ts"
    - "src/app/auth/confirm/route.ts"
    - "src/app/auth/error/page.tsx"
    - "src/app/auth/sign-in/page.tsx"
    - "src/app/auth/sign-up/page.tsx"
    - "src/components/ui/separator.tsx"
    - "supabase/migrations/0002_email_confirmed_helper.sql"
  modified:
    - "src/features/auth/sign-out-button.tsx"
    - "src/features/auth/site-header.tsx"
decisions:
  - "safeNext() rejects non-'/'-prefixed, '//', '/\\', and any '://' — same-origin relative paths only; else '/'."
  - "Both callback routes redirect through safeNext(next) rather than the raw param — the RESEARCH Pattern 3/4 snippets used the raw next, which is the open-redirect the plan mandated closing."
  - "confirm route redirects straight to the destination on verifyOtp success (Pitfall 5) — never to a sign-in prompt."
  - "Vendored a minimal Separator and built the user-menu on native details/summary instead of installing @radix-ui/react-separator / -avatar / -dropdown-menu, honoring threat T-03-SC (no new package installs in this plan)."
  - "database.types.ts intentionally NOT regenerated — 0002 adds no table/column; regeneration for 0003-0006 happens in Plan 04 Task 2."
metrics:
  completed: 2026-07-01
  duration_min: 5
status_note: "Static verification complete (build/tsc/lint all exit 0). Live-backend acceptance (real Google/GitHub sign-in, email-confirm redirect, migration 0002 apply) deferred to local run — see Deferred section."
---

# Phase 1 Plan 03: Complete Auth Surface (OAuth + Email Confirm + Sign-out + Email-Confirmed Gate) Summary

Completed the sign-in half of the phase: Google + GitHub OAuth with a server-side
code-exchange callback (AUTH-03/AUTH-04), the email-confirmation route that
verifies and signs the user in on their destination (AUTH-02), an email/password
sign-in form, a header user-menu sign-out control usable from any page (AUTH-06),
a `safeNext()` same-origin redirect guard applied in both callback routes, and
migration `0002` authoring the DB-level `is_email_confirmed()` write-gate helper.
Verified statically (build/typecheck/lint all exit 0); live-backend acceptance
deferred to local execution.

## Environment constraint (read first)

Executed in the same **ephemeral remote container** as Plan 02: **no Docker
daemon, no Supabase CLI live-link, no live backend, no browser**. Consequently:

- `supabase db push` (apply migration `0002`) — **NOT run here by design.** Per the
  plan's consolidated-push model, `0002` is AUTHORED in this plan and APPLIED to
  the cloud DB in **Plan 01-04 Task 2's** single `supabase db push` (alongside
  `0003-0006`). Do not attribute a `0002` apply failure to this plan.
- `supabase gen types typescript` — **not run**; `0002` adds no table/column, so
  `src/types/database.types.ts` is unchanged (confirmed unmodified in git).
- Real Google/GitHub OAuth round-trip, real email-confirm link click, and the
  live `is_email_confirmed()` behavior — **DEFERRED to local run** (need a live
  Supabase project + configured OAuth apps + email template).

## What was built (per task)

### Task 1 — OAuth (Google + GitHub) + code-exchange callback (commit 43da105)
- `src/features/auth/redirect.ts` — `safeNext(next)`: returns `next` only when it
  is a same-origin relative path (starts with a single `/`, not `//`, `/\`, and
  contains no `://`); otherwise `/`. Closes the open-redirect vector (T-03-01).
- `src/features/auth/oauth-buttons.tsx` (client) — two shadcn `outline` (neutral,
  never accent) Buttons with inline Google/GitHub SVG glyphs, calling
  `supabase.auth.signInWithOAuth({ provider, options: { redirectTo:
  `${origin}/auth/callback?next=…` } })` for `google` (AUTH-03) and `github`
  (AUTH-04).
- `src/app/auth/callback/route.ts` (GET) — reads `code` + `next`, calls
  `exchangeCodeForSession(code)` on the **server** client, redirects to
  `${origin}${safeNext(next)}` on success, `/auth/error` on failure.
- `src/app/auth/error/page.tsx` — destructive `Alert` ("That link expired —
  request a new one") + link back to sign-in (UI-SPEC).
- `src/app/auth/sign-in/page.tsx` — hosts the OAuth buttons (form added in Task 2).

### Task 2 — Email confirm route + sign-in form + `is_email_confirmed()` (commit c26e14d)
- `src/app/auth/confirm/route.ts` (GET) — reads `token_hash` + `type` + `next`,
  calls `verifyOtp({ type, token_hash })` on the server client, and on success
  redirects **straight to** `${origin}${safeNext(next)}` — the user is already
  signed in (verifyOtp both confirms AND authenticates), so never bounced to a
  sign-in prompt (Pitfall 5). Failure → `/auth/error`.
- `src/features/auth/sign-in-form.tsx` (client, RHF + zod + shadcn Form) — calls
  `signInWithPassword`, shows the UI-SPEC "That email or password isn't right.
  Try again." Alert on error (no user enumeration), routes to `safeNext(next)` +
  `router.refresh()` on success.
- `src/app/auth/sign-in/page.tsx` — form + `Separator` "or" label + OAuth buttons.
- `src/app/auth/sign-up/page.tsx` — Plan 02's `SignUpForm` + `Separator` + OAuth
  buttons (three account-creation methods).
- `src/components/ui/separator.tsx` — minimal vendored Separator (no new radix dep).
- `supabase/migrations/0002_email_confirmed_helper.sql` —
  `public.is_email_confirmed()` `language sql security definer stable set
  search_path = public`, returning `(select email_confirmed_at from auth.users
  where id = (select auth.uid())) is not null`; `grant execute … to anon,
  authenticated`. AUTHORED here; APPLIED in Plan 04 Task 2's consolidated push.

### Task 3 — Sign-out usable from any page (AUTH-06) (commit c2cbee1)
- `src/features/auth/user-menu.tsx` (client) — Avatar (user initials) opening a
  dropdown (native `details`/`summary` + click-outside close) with a "Your
  profile" link (`/u/[username]`) and the Sign Out control. Built without
  `@radix-ui/react-dropdown-menu`/`-avatar` to honor T-03-SC.
- `src/features/auth/sign-out-button.tsx` — `supabase.auth.signOut()` on the
  **shared browser client**, then `router.push('/')` + `router.refresh()` so the
  server-rendered header re-renders signed-out. Works from any page.
- `src/features/auth/site-header.tsx` — renders the `UserMenu` when signed in;
  Sign In / Create Account buttons when signed out. (`layout.tsx` already mounts
  `SiteHeader`, so no layout change was needed.)

## The interface Plan 04 consumes

```sql
public.is_email_confirmed() returns boolean   -- SECURITY DEFINER, STABLE
```
Plan 04's flies-insert RLS `WITH CHECK` must call `is_email_confirmed()` (or
AUTH-02 is only a UI illusion). Migration `0002` is authored here; it goes live in
**Plan 04 Task 2's consolidated `supabase db push`**, which applies `0002`
alongside `0003-0006` before the flies-insert policy runs against it.

```ts
safeNext(next: string | null): string   // src/features/auth/redirect.ts
```

## Verifications that PASSED (static)

| Check | Result |
|-------|--------|
| `npm run build` | exit 0 (routes: `/auth/callback`, `/auth/confirm`, `/auth/error`, `/auth/sign-in`, `/auth/sign-up`) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `oauth-buttons.tsx` calls `signInWithOAuth` with both `google` and `github`, `redirectTo` = `${origin}/auth/callback` | ✓ |
| `callback/route.ts` calls `exchangeCodeForSession` and redirects via `safeNext(next)` | ✓ |
| `confirm/route.ts` calls `verifyOtp({ type, token_hash })` and redirects via `safeNext(next)` (not to sign-in) | ✓ |
| `sign-in-form.tsx` calls `signInWithPassword` | ✓ |
| `sign-out-button.tsx` calls `signOut()` on the browser client | ✓ |
| `0002` grep: `security definer` + `stable` + `email_confirmed_at` | PASS ✓ |
| OAuth buttons render `variant="outline"` (non-accent) per UI-SPEC | ✓ |
| `safeNext` rejects absolute URLs, `//`, `/\`, `://` → `/` | ✓ (unit-reviewed) |
| `database.types.ts` unchanged (no `0002` type regen) | ✓ (git clean) |
| No `@supabase/auth-helpers*`; no service-role key; no new package installs | ✓ |

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 2 - Security] Redirect through `safeNext` in BOTH routes, not the raw `next`.**
- **Found during:** Tasks 1 & 2.
- **Issue:** RESEARCH Pattern 3/4 snippets redirect to the raw `next`
  (`${origin}${next}` / `redirect(next)`) — an open-redirect (T-03-01).
- **Fix:** Both `/auth/callback` and `/auth/confirm` redirect to
  `${origin}${safeNext(next)}`. The confirm route also switched from
  `redirect(next)` (next/navigation) to `NextResponse.redirect` for consistent
  same-origin construction.
- **Files:** `callback/route.ts`, `confirm/route.ts`, `redirect.ts`.
- **Commits:** 43da105, c26e14d.

**2. [Rule 3 - Blocking, adjusted] Header user-menu without new @radix-ui deps.**
- **Found during:** Task 3.
- **Issue:** UI-SPEC specifies a shadcn `DropdownMenu` + `Avatar` user-menu, but
  those require `@radix-ui/react-dropdown-menu` and `@radix-ui/react-avatar`,
  which are not installed. Threat **T-03-SC** explicitly states *no new package
  installs in this plan*, and package installs are excluded from Rule 3 auto-fix.
- **Fix:** Built the user-menu on native `<details>`/`<summary>` (keyboard- and
  screen-reader-accessible) with a click-outside close and an initials Avatar,
  and vendored a minimal `Separator` as a styled element. Same UX, zero new deps.
  If a later plan installs the Radix primitives, swapping in the canonical shadcn
  components is a low-risk refactor.
- **Files:** `user-menu.tsx`, `separator.tsx`.
- **Commits:** c26e14d, c2cbee1.

**3. [Note] `layout.tsx` listed in Task 3 files but not modified.**
- `SiteHeader` (already mounted in `layout.tsx` since Plan 02) is the correct
  wiring point for the user-menu; editing `SiteHeader` covers AUTH-06 on every
  page without touching `layout.tsx`. No functional gap.

## Deferred to local execution (live backend required)

Requires a live Supabase project, configured Google + GitHub OAuth apps
(client ID/secret + callback URIs registered — see Plan 01-01), and the email
template pointing at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

```bash
# Migration 0002 is applied in Plan 01-04 Task 2's consolidated push, NOT here.
# After that push, exercise this plan's flows against the live project:
npm run dev   # http://localhost:3000
```

Live acceptance checklist (deferred):
1. `/auth/sign-in` → "Continue with Google" → complete Google consent → land back
   signed in (callback exchanged the code). Repeat for GitHub.
2. Sign up with a real email → click the confirmation link → land on the intended
   destination already signed in (never a sign-in prompt — Pitfall 5).
3. Email/password sign-in with good creds → signed in; with bad creds → "That
   email or password isn't right. Try again."
4. Open-redirect check: hit `/auth/callback?next=https://evil.example` (and
   `//evil.example`) → you land on `/`, never the foreign origin.
5. From any page, open the header user-menu → Sign Out → returned to signed-out
   state (header shows Sign In / Create Account).
6. After Plan 04's push: verify an unconfirmed session's flies-insert is rejected
   at the DB (RLS calling `is_email_confirmed()`), not just hidden in the UI.

## Known Stubs

None. `is_email_confirmed()` is a real helper (applied in Plan 04); the user-menu,
both callback routes, and all forms are fully wired to Supabase Auth.

## Self-Check: PASSED

All 13 created + 2 modified files exist on disk; all 3 per-task commits
(43da105, c26e14d, c2cbee1) are present in git history; working tree is clean.
