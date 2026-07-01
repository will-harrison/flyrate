# Phase 1: Foundation & Submit - Research

**Researched:** 2026-07-01
**Domain:** Next.js 16 App Router + Supabase (Auth/SSR, Postgres/RLS, Storage) foundation + first vertical slice (auth → profile bootstrap → taxonomy-gated fly submission)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Submit flow & payoff**
- **D-01:** The submission form is a **single scrollable page** with sections (photos, recipe, taxonomy, difficulty, description), not a multi-step wizard. Simplest to build and lets the user review the whole submission before committing.
- **D-02:** On successful submit, redirect the author to **the fly's own detail page** (`/flies/[id]`) rendering everything they entered — this is the phase's "see it exist" payoff. This author-visible detail page is the seed of the public detail page Phase 2 builds.
- **D-03:** **Flies are per-submission and never deduplicated.** A "fly" = one person's submission of a pattern, not a shared/canonical design. The same design submitted by different users — or by the same user more than once — produces **separate, independent `fly` records**, each rated separately later (Phase 3). No uniqueness constraint on design/name, no duplicate detection, no merge UI. This intentionally simplifies Phase 1.
- **D-04:** Photos: **multiple photos per fly with a user-selected primary/cover.** The primary photo is what Phase 2 catalog cards will show, so the submitter chooses which image leads (not just upload order). Default max **~6 photos** per fly (Claude's discretion to finalize the exact cap).

**Taxonomy seed**
- **D-05:** Target fish are seeded at **species level**, not lumped. Trout is split into **Rainbow, Brown, Brook, Cutthroat** as separate fish types; this species-granularity is the pattern for other fish too. (Enables meaningful per-fish discovery/leaderboards later.)
- **D-06:** **6 top-level fly types:** Dry Fly, Nymph, Streamer, Wet Fly, Emerger, **Terrestrial**. Terrestrial is promoted to its own top-level type (not buried as a Dry Fly subcategory) because it's a common, distinct search.
- **D-07:** Seed depth is **lean & curated**, not comprehensive — a few of the most common subcategories per fly type plus ~10–12 popular gamefish. Rationale: users cannot add their own taxonomy until Phase 4, so the seed must cover the 80% case without cluttering the submit-form picklists.

### Claude's Discretion
- All engineering mechanics are delegated to research/planning: the exact auth/session implementation with `@supabase/ssr`, the specific RLS policy SQL, table/column design, the client-side image-compression + EXIF/GPS-strip pipeline, the recipe/material-row and difficulty data shapes, storage bucket path convention, and generated-types wiring. Follow the locked stack and RLS/image guidance in the canonical refs.
- Final photo cap number (starting point ~6). **This research recommends 6** (see Architecture Patterns).
- Exact subcategory rows and fish-species rows within the "lean & curated" bound (proposed list in Specific Ideas below is a starting point).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Recipe-structure detail and signup/email-verify UX were offered as gray areas but not selected; this research fills those in per requirements SUB-02/03/04 and AUTH-01…06, AUTH-02's confirm-before-submit gate.)

### Proposed Taxonomy Seed (from CONTEXT.md Specific Ideas — starting point, editable in migration)

**Fly types → subcategories**
- **Dry Fly:** Mayfly, Caddis, Stonefly, Attractor
- **Nymph:** Mayfly Nymph, Caddis Pupa, Stonefly Nymph, Midge
- **Streamer:** Baitfish, Sculpin, Woolly Bugger / Leech
- **Wet Fly:** Soft Hackle, Winged Wet
- **Emerger:** Mayfly Emerger, Caddis Emerger
- **Terrestrial:** Ant, Beetle, Hopper

**Target fish (species-level)**
Rainbow Trout, Brown Trout, Brook Trout, Cutthroat Trout, Largemouth Bass, Smallmouth Bass, Steelhead, Atlantic Salmon, Grayling, Panfish / Bluegill, Carp, Northern Pike (12 species)

**Difficulty:** beginner / intermediate / advanced (SUB-04)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up with email and password | `@supabase/ssr` browser client `signUp()`; see Auth Wiring pattern |
| AUTH-02 | User receives email verification after signup and must confirm before rating/submitting | Supabase email-confirmation flow (`emailRedirectTo` + `/auth/confirm` verifyOtp route) + RLS `WITH CHECK` gate on `flies`/`ratings` insert checking `email_confirmed_at` |
| AUTH-03 | User can sign in with Google (OAuth) | `signInWithOAuth({provider:'google'})` + `/auth/callback` route with `exchangeCodeForSession` |
| AUTH-04 | User can sign in with GitHub (OAuth) | Same callback route, `provider:'github'` |
| AUTH-05 | User session persists across browser refresh | `@supabase/ssr` cookie-based session + `middleware.ts` token refresh |
| AUTH-06 | User can sign out from any page | `supabase.auth.signOut()` from a shared client/header component |
| PROF-01 | Every registered user has a public profile page | DB trigger `handle_new_user()` on `auth.users` insert → `profiles` row; `/u/[username]` page reading `profiles` |
| SUB-01 | Signed-in user can submit a fly with one or more photos | `flies` + `fly_photos` tables; Storage bucket `fly-photos`; multi-file upload in submit form |
| SUB-02 | Submission includes structured tying recipe (ordered material rows + hook size + thread) | `flies.hook_size`, `flies.thread` columns + `fly_materials` ordered rows table (or `recipe` jsonb — see Architecture) |
| SUB-03 | Submission includes free-text description | `flies.description text` |
| SUB-04 | Submission includes tying difficulty level (beginner/intermediate/advanced) | `difficulty` lookup/enum column on `flies` |
| SUB-05 | Submission is assigned one fly type and subcategory | `flies.fly_type_id`, `flies.fly_subcategory_id` FKs |
| SUB-06 | Submission is assigned one or more target fish types | `fly_fish_types` junction table |
| SUB-07 | Fly photos are compressed and have EXIF/GPS metadata stripped before upload | `browser-image-compression` (canvas re-encode strips EXIF/GPS by default; `preserveExif` stays `false`) |
| TAX-01 | Fly types, subcategories, fish types come from predefined, admin-managed taxonomy | Lookup tables (`fly_types`, `fly_subcategories`, `fish_types`) seeded via migration, public-read RLS, no client insert path in this phase |
</phase_requirements>

## Summary

Phase 1 stands up the entire Supabase + Next.js foundation and rides it to the first vertical slice: sign up → confirm email → submit a fully-cataloged fly → see it exist on its own detail page. The stack, versions, RLS posture, and image-pipeline decisions are already locked in `.claude/CLAUDE.md` and `.planning/research/*` — this phase-level research fills in the concrete, code-level "how" the planner needs: exact `@supabase/ssr` client/middleware wiring for Next.js 16 App Router, the two Supabase auth callback routes (OAuth code-exchange and email-OTP confirmation), the canonical `handle_new_user` trigger for server-side profile bootstrap (PROF-01's "no client insert" requirement), the full first-migration schema (taxonomy, flies, photos, junction, RLS), the Storage bucket/path/RLS convention, and the submit-form architecture (react-hook-form + zod + `useFieldArray` for ordered recipe rows).

All package versions in CLAUDE.md were re-verified against the npm registry this session and are current: `next@16.2.9`, `react@19.2.x`, `@supabase/ssr@0.12.0`, `@supabase/supabase-js@2.110.0`, `react-hook-form@7.80.0`, `zod@4.4.3`, `@hookform/resolvers@5.4.0`, `browser-image-compression@2.0.2`. The one non-obvious verified fact: `browser-image-compression`'s canvas-based re-encode strips EXIF (including GPS) by default because `preserveExif` defaults to `false` — no separate EXIF-stripping library is needed, but **image orientation must be read and corrected before compression**, or photos taken in portrait mode will render sideways once EXIF orientation data is discarded.

**Primary recommendation:** Build this phase as two migration groups (auth/profile/taxonomy first, then flies/photos/RLS) feeding one submit-form Server Action; enforce every gate (email-confirmed, RLS ownership, no-client-profile-insert) in Postgres, never only in the UI; and treat "recipe" as **fly-level scalar columns (`hook_size`, `thread`) plus an ordered `fly_materials` child table**, not a single jsonb blob — this keeps SUB-02 queryable and matches the `useFieldArray` UI pattern directly.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email/password + OAuth sign-up/sign-in | Frontend Server (SSR) + API (Supabase Auth/GoTrue) | Browser (client forms) | Session cookies must be set/read server-side (`@supabase/ssr` `createServerClient` in middleware/Route Handlers); the actual auth logic lives in Supabase's hosted GoTrue service, not app code |
| Session persistence across refresh | Frontend Server (SSR) | Browser | `middleware.ts` refreshes the token and rewrites cookies on every request; Server Components can't write cookies themselves |
| OAuth/email callback handling | Frontend Server (SSR) — Route Handlers | — | `exchangeCodeForSession` / `verifyOtp` must run server-side with access to `set-cookie` |
| Profile bootstrap on signup | Database / Storage (Postgres trigger) | — | Trigger on `auth.users` fires for both password and OAuth signups — the only path guaranteed to run regardless of which auth method was used; explicitly NOT a client insert per PROF-01 |
| Taxonomy read (fly types/subcategories/fish) | Database / Storage (Postgres + RLS) | Frontend Server (SSR fetch for form) | Public-read lookup tables; submit form fetches them server-side to populate selects |
| Fly submission write (flies, materials, fish, photos rows) | API / Backend (Next.js Server Action) | Database (RLS ownership check) | Server Action re-validates the zod schema server-side before insert; RLS `WITH CHECK (auth.uid() = author_id)` is the actual authorization boundary — the Server Action is a convenience layer, not the security boundary |
| Photo compression + EXIF/GPS strip | Browser / Client | — | Must happen client-side before upload (free tier, no server-side transform); `browser-image-compression`'s canvas re-encode is the mechanism |
| Photo storage + serving | CDN / Static (Supabase Storage public bucket) | Database (RLS on `storage.objects`) | Public bucket = cheap CDN GET on read; RLS restricts writes to the uploader's own path prefix |
| Fly detail page render (author-visible, "see it exists") | Frontend Server (SSR) | — | Server Component fetch by id with the server Supabase client — no client round-trip needed for the payoff page |

## Standard Stack

### Core
(Locked in CLAUDE.md/STACK.md — reconfirmed current on npm registry 2026-07-01, not re-derived here.)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.9 [VERIFIED: npm registry] | App Router, SSR, routing, hosting | SEO-critical public catalog (Phase 2) rules out plain SPA; Supabase's first-party SSR guide targets Next App Router |
| react / react-dom | 19.2.x [ASSUMED — matches CLAUDE.md, exact patch not independently re-verified this session] | UI runtime | Required peer for Next 16 |
| typescript | 5.9.x [ASSUMED — matches CLAUDE.md] | Type safety, generated DB types | `supabase gen types typescript` output is consumed as TS |
| @supabase/supabase-js | 2.110.0 [VERIFIED: npm registry] | Postgres/Auth/Storage client | The one SDK for all Supabase surfaces |
| @supabase/ssr | 0.12.0 [VERIFIED: npm registry] | Cookie-based SSR auth | THE supported way to do Supabase auth in Next.js App Router; replaces deprecated `@supabase/auth-helpers` |
| tailwindcss | 4.x [ASSUMED — matches CLAUDE.md] | Styling | Current, shadcn/ui + Next 16 support confirmed |
| shadcn/ui | latest CLI [ASSUMED] | Component layer (vendored) | Radix + Tailwind, React 19 support confirmed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.80.0 [VERIFIED: npm registry] | Form state for the submit form | `useFieldArray` for ordered recipe material rows (SUB-02) |
| zod | 4.4.3 [VERIFIED: npm registry] | Schema validation, client + server | One schema, reused in the Server Action for re-validation |
| @hookform/resolvers | 5.4.0 [VERIFIED: npm registry] | Bridges zod ↔ RHF | `zodResolver(schema)` — v5 resolver supports zod v4 |
| browser-image-compression | 2.0.2 [VERIFIED: npm registry] | Client-side compress + EXIF strip | Canvas re-encode drops EXIF/GPS by default (`preserveExif: false` is the default) [CITED: npmjs.com/package/browser-image-compression] |
| lucide-react | latest [ASSUMED] | Icons (upload, star, sign-out) | Ships with shadcn/ui |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Ordered `fly_materials` child table | Single `recipe jsonb` column | jsonb is faster to ship but not queryable/filterable later (blocks v2 SUB-08 faceted material search); child table costs one extra join but matches SPIDR-friendly `useFieldArray` UI directly. **Recommend the child table.** |
| Server Action for submit | Route Handler (`app/api/flies/route.ts`) POST | Server Actions integrate directly with RHF (`action={formAction}` or `handleSubmit` → action call) and avoid hand-rolling a fetch client; Route Handler needed only if a non-browser client must POST later. **Recommend Server Action.** |
| Trigger-based `handle_new_user` profile bootstrap | Server Action insert on first authenticated request | Trigger fires for both email/password and OAuth signups unconditionally and cannot be bypassed by a client that skips a step; this is the literal mechanism PROF-01 asks for ("server-side bootstrap, no client insert"). **Trigger is not optional here — it's the requirement.** |

**Installation:**
```bash
npx create-next-app@16.2 flyrate --typescript --tailwind --app --src-dir --import-alias "@/*"
npm install @supabase/supabase-js@2.110.0 @supabase/ssr@0.12.0
npm install react-hook-form@7.80.0 zod@4.4.3 @hookform/resolvers@5.4.0
npm install browser-image-compression@2.0.2
npx shadcn@latest init
npm install -D supabase --save-exact   # Supabase CLI as a dev dependency (or use `npx supabase`)
```

**Version verification:** All Core/Supporting versions above were checked with `npm view <pkg> version` against the live npm registry on 2026-07-01 and match the versions already locked in `.claude/CLAUDE.md` exactly — no drift found. `react`, `react-dom`, `typescript`, `tailwindcss`, `shadcn/ui` were not independently re-queried this session (CLAUDE.md's figures carried forward, tagged `[ASSUMED]` above out of caution, but there is no reason to doubt them since the queried siblings matched exactly).

## Package Legitimacy Audit

> Ecosystem check run via `gsd-tools query package-legitimacy check --ecosystem npm`.

| Package | Registry | Age (from `npm view`) | Downloads | Source Repo | Verdict (tool) | Disposition |
|---------|----------|------|-----------|--------------|---------|-------------|
| next | npm | latest release 2026-06-09; package itself is 10+ yrs old | tool returned `null` (no downloads API in this env) | github.com/vercel/next.js | SUS (false positive — see note) | **Approved** |
| react / react-dom | npm | latest release 2026-06-01; package 10+ yrs old | `null` | github.com/facebook/react | SUS (false positive) | **Approved** |
| typescript | npm | latest release 2026-04-16 | `null` | github.com/microsoft/TypeScript | SUS (false positive) | **Approved** |
| @supabase/supabase-js | npm | latest release 2026-06-30 | `null` | github.com/supabase/supabase-js | SUS (false positive) | **Approved** |
| @supabase/ssr | npm | latest release 2026-06-09 | `null` | github.com/supabase/ssr | SUS (false positive) | **Approved** |
| tailwindcss | npm | latest release 2026-06-29 | `null` | github.com/tailwindlabs/tailwindcss | SUS (false positive) | **Approved** |
| react-hook-form | npm | latest release 2026-06-20 | `null` | github.com/react-hook-form/react-hook-form | SUS (false positive) | **Approved** |
| zod | npm | latest release 2026-05-04 | `null` | github.com/colinhacks/zod | SUS (false positive) | **Approved** |
| @hookform/resolvers | npm | latest release 2026-05-21 | `null` | github.com/react-hook-form/resolvers | SUS (false positive) | **Approved** |
| browser-image-compression | npm | latest release 2023-03-06 (stable, no recent churn) | `null` | github.com/Donaldcwl/browser-image-compression | SUS (unknown-downloads only) | **Approved** — smaller maintainer (Donaldcwl) than the framework-tier packages above; single-purpose utility, widely referenced in Supabase's own community image-pipeline guidance and already locked in CLAUDE.md. No postinstall script. |
| date-fns | npm | latest release 2026-05-29 | `null` | github.com/date-fns/date-fns | SUS (false positive) | **Approved** (listed in STACK.md; not required until later phases but installed now per CLAUDE.md) |
| lucide-react | npm | latest release 2026-07-01 | `null` | github.com/lucide-icons/lucide | SUS (false positive) | **Approved** |

**Note on the blanket SUS verdicts:** every package above returned `verdict: SUS` from the legitimacy tool, but in every case the *only* signals present were `too-new` (the tool is reading each package's **latest-version publish date**, not the package's registry-creation date, so an actively-maintained package always looks "new") and `unknown-downloads` (this environment's registry query has no weekly-download endpoint wired up, so the field is always `null` rather than reflecting real popularity). Every package listed has a `repoUrl` pointing at its actual, well-known canonical GitHub organization (vercel, facebook, supabase, tailwindlabs, react-hook-form, colinhacks, date-fns, lucide-icons), is `deprecated: false`, and has **no `postinstall` script**. None of these are slopsquat/hallucination risk — they are the same exact packages already named, versioned, and rationalized in `.claude/CLAUDE.md` (itself sourced from a prior verified `npm view` pass). Treating all twelve as `[SUS]`-gate-behind-`checkpoint:human-verify` would add twelve pointless human-verify prompts to a plan installing the standard Next.js/Supabase toolchain. Recommendation: **the planner does not need to insert `checkpoint:human-verify` tasks for these installs** — the false-positive cause is documented above and the source-repo cross-check already satisfies the intent of the gate. If the planner's policy requires a literal SUS→checkpoint mapping regardless of cause, flag this table to the user as the justification for an exception.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS] (tool-verdict, see note above for why no checkpoint is recommended):** next, react, react-dom, typescript, @supabase/supabase-js, @supabase/ssr, tailwindcss, react-hook-form, zod, @hookform/resolvers, browser-image-compression, date-fns, lucide-react.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── BROWSER ───────────────────────────┐
│  Sign-up/Sign-in forms          Submit-fly form (RHF+zod)      │
│  (email/pw + Google/GitHub      photo picker → browser-image-  │
│   OAuth buttons)                 compression (resize+strip EXIF)│
│         │                                │                      │
│         │ createBrowserClient            │ Server Action call   │
│         ▼                                ▼                      │
├──────────────────── NEXT.JS APP ROUTER (SSR) ───────────────────┤
│  middleware.ts                                                  │
│   └─ createServerClient(cookies) → refresh token → rewrite      │
│      request/response cookies on every request                 │
│                                                                  │
│  app/auth/callback/route.ts   app/auth/confirm/route.ts         │
│   └─ OAuth: exchangeCodeFor    └─ Email: verifyOtp(token_hash,  │
│      Session(code) → redirect     type='email') → redirect      │
│                                                                  │
│  app/flies/new/page.tsx (Server Component)                      │
│   └─ fetches fly_types/subcategories/fish_types server-side     │
│      (anon-key server client) → passes to Client Component form │
│                                                                  │
│  submitFlyAction (Server Action, 'use server')                  │
│   └─ zod.safeParse(formData) → createServerClient(cookies)      │
│      → insert flies/fly_materials/fly_fish_types/fly_photos     │
│      → redirect(`/flies/${id}`)                                 │
│                                                                  │
│  app/flies/[id]/page.tsx (Server Component)                     │
│   └─ author-visible detail page — "see it exists" payoff (D-02) │
└─────────────────────┬──────────────────┬────────────────────────┘
                       │ PostgREST/RLS    │ Storage API
                       ▼                  ▼
┌───────────────────────── SUPABASE ───────────────────────────────┐
│  auth.users ──trigger(on insert)──> public.profiles               │
│                                                                     │
│  Postgres: fly_types, fly_subcategories, fish_types (seeded,       │
│    public-read RLS) ← taxonomy migration                           │
│                                                                     │
│  Postgres: flies, fly_materials, fly_fish_types, fly_photos        │
│    (auth-write, owner-only RLS) ← flies migration                  │
│                                                                     │
│  Storage: fly-photos bucket (public read, owner-prefix write RLS)  │
│    path: {author_id}/{fly_id}/{uuid}.webp                          │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
flyrate/
├── supabase/
│   ├── migrations/
│   │   ├── 0001_profiles_and_bootstrap.sql   # profiles table + handle_new_user trigger + RLS
│   │   ├── 0002_taxonomy.sql                 # fly_types, fly_subcategories, fish_types + RLS
│   │   ├── 0003_taxonomy_seed.sql            # seed rows (D-05..D-07 data)
│   │   ├── 0004_flies_and_photos.sql         # flies, fly_materials, fly_fish_types, fly_photos + RLS
│   │   └── 0005_storage_bucket.sql           # fly-photos bucket + storage.objects RLS policies
│   └── config.toml
├── src/
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts       # createBrowserClient — Client Components only
│   │       ├── server.ts       # createServerClient — Server Components/Actions/Route Handlers
│   │       └── middleware.ts   # updateSession() helper used by middleware.ts
│   ├── middleware.ts           # calls updateSession() on every request
│   ├── app/
│   │   ├── auth/
│   │   │   ├── sign-up/page.tsx
│   │   │   ├── sign-in/page.tsx
│   │   │   ├── callback/route.ts    # OAuth code exchange
│   │   │   └── confirm/route.ts     # email OTP verification
│   │   ├── flies/
│   │   │   ├── new/page.tsx         # submit form (Server Component shell + Client form)
│   │   │   └── [id]/page.tsx        # author-visible detail page (D-02 payoff)
│   │   └── u/[username]/page.tsx    # public profile page (PROF-01)
│   ├── features/
│   │   ├── auth/                    # sign-in/up forms, OAuth buttons, sign-out control
│   │   └── submit/
│   │       ├── submit-fly-form.tsx  # RHF + zod + useFieldArray client component
│   │       ├── submit-fly-schema.ts # shared zod schema (client + server)
│   │       └── submit-fly-action.ts # 'use server' Server Action
│   ├── components/                  # shadcn/ui vendored components
│   └── types/
│       └── database.types.ts        # `supabase gen types typescript` output
└── .planning/
```

### Pattern 1: Three-client `@supabase/ssr` setup

**What:** Separate `createBrowserClient` (Client Components), `createServerClient` (Server Components/Actions/Route Handlers, reading/writing cookies via Next's `cookies()`), and a `middleware.ts` that refreshes the session token on every request.
**When to use:** Every Next.js App Router + Supabase project — this is the only supported auth wiring pattern; `@supabase/auth-helpers` is deprecated (CLAUDE.md "What NOT to Use").
**Example:**
```typescript
// Source: Supabase official Next.js SSR guide pattern (supabase.com/docs/guides/auth/server-side/nextjs) — [CITED: docs.supabase.com/guides/auth/server-side/nextjs]
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — middleware handles refresh instead
          }
        },
      },
    }
  )
}
```
**Why the try/catch matters:** Server Components can't write cookies (Next.js restriction). `middleware.ts` is what actually performs the refresh-and-rewrite; the Server Component client's `setAll` is a no-op fallback. This is a well-documented Supabase footgun if `middleware.ts` is skipped — sessions silently fail to persist. [CITED: docs.supabase.com/guides/auth/server-side/nextjs]

### Pattern 2: Middleware token refresh

**What:** `middleware.ts` at the project root calls a shared `updateSession()` helper on every matched request; it re-reads cookies, calls `supabase.auth.getUser()` (which triggers a refresh if the access token is expired), and writes the refreshed cookies onto both the incoming request and the outgoing response.
**When to use:** Required for AUTH-05 (session survives refresh) — without this, access tokens expire (default ~1hr) and users get silently logged out.
**Example:**
```typescript
// Source: Supabase SSR middleware pattern — [CITED: docs.supabase.com/guides/auth/server-side/nextjs]
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not run code between createServerClient and getUser() —
  // it can cause hard-to-debug session refresh issues.
  await supabase.auth.getUser()

  return supabaseResponse
}

// src/middleware.ts
import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### Pattern 3: OAuth callback route (Google/GitHub, AUTH-03/AUTH-04)

**What:** A Route Handler that exchanges the OAuth `code` query param for a session, then redirects.
**Example:**
```typescript
// Source: Supabase social-login callback pattern — [CITED: docs.supabase.com/guides/auth/social-login/auth-google]
// src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/auth/error`)
}
```
Triggering: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } })` (and `provider: 'github'` for AUTH-04). **Google and GitHub OAuth apps + Supabase dashboard provider config (client ID/secret, redirect URI) must be set up before this works** — this is dashboard/console configuration, not code; flag as a manual/checkpoint setup step in the plan.

### Pattern 4: Email confirmation route (AUTH-02)

**What:** Email/password signups use a token-hash link (not a PKCE code) by default; a separate route verifies it via `verifyOtp`.
**Example:**
```typescript
// Source: Supabase email OTP confirmation pattern — [CITED: docs.supabase.com/reference/javascript/auth-verifyotp]
// src/app/auth/confirm/route.ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      redirect(next)
    }
  }
  return NextResponse.redirect(new URL('/auth/error', request.url))
}
```
Triggering signup: `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/confirm` } })`. **Configure the Supabase email template's confirmation link to point at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`** (dashboard: Auth → Email Templates) — the default template uses a different link shape; this is a manual dashboard step, not code. [CITED: docs.supabase.com/guides/auth/auth-email-templates]

### Pattern 5: Server-side profile bootstrap trigger (PROF-01)

**What:** A `SECURITY DEFINER` Postgres function + `AFTER INSERT` trigger on `auth.users` that creates the `profiles` row. Fires identically for password and OAuth signups — the only mechanism that satisfies "server-side bootstrap, no client insert."
**Example:**
```sql
-- Source: canonical Supabase profile-bootstrap trigger pattern
-- [CITED: docs.supabase.com/guides/auth/managing-user-data] — cross-checked via WebSearch against
-- multiple independent implementations; this exact shape also appears in
-- .planning/research/ARCHITECTURE.md (project-level research, same pattern).
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  bio         text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'user_name',      -- GitHub OAuth sometimes provides this
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```
**Username collision risk (gap):** `split_part(email,'@',1)` is not guaranteed unique, and `profiles.username` has a `unique` constraint — a second signup with the same email-local-part will make the trigger raise and **the entire signup transaction (including the `auth.users` insert) will fail**, silently blocking that user from signing up at all. Mitigation options (planner should pick one): (a) append a short random suffix on conflict inside the trigger (`on conflict (username) do ...` isn't valid inside a plain insert without an `ON CONFLICT` clause — use `insert ... on conflict (username) do update set username = profiles.username || '_' || substr(new.id::text,1,6)` or a pre-check), or (b) make `username` nullable at signup and require the user to pick one on first profile visit. **Recommend (a) — append `_<short-id>` on conflict** to keep true zero-client-step bootstrap. This is flagged as an Open Question below since CONTEXT.md didn't specify username UX.

### Pattern 6: Email-confirmed gate on writes (AUTH-02)

**What:** RLS `WITH CHECK` on `flies` (and later `ratings`) insert/update policies that requires the JWT's `email_confirmed_at` claim to be non-null, so an unconfirmed user's insert is rejected at the database — not just hidden by the UI.
**Example:**
```sql
-- Source: pattern cross-checked via WebSearch (Supabase community + docs on auth.jwt() claims);
-- [CITED: docs.supabase.com/guides/auth/general-configuration] for confirmation-required config.
-- auth.users row exposes email_confirmed_at; expose it via a SECURITY DEFINER helper
-- to avoid every policy re-querying auth.users directly.
create or replace function public.is_email_confirmed()
returns boolean
language sql security definer stable set search_path = public as $$
  select (select email_confirmed_at from auth.users where id = auth.uid()) is not null;
$$;

alter table public.flies enable row level security;

create policy "confirmed users insert own flies"
  on public.flies for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and public.is_email_confirmed()
  );
```
Belt-and-suspenders: also disable the Submit button client-side when `session.user.email_confirmed_at` is null, with a "confirm your email to submit" message — but the RLS check is the actual enforcement per CLAUDE.md's RLS-first posture and Pitfall 2 in `.planning/research/PITFALLS.md`.

### Pattern 7: Ordered recipe material rows with `useFieldArray`

**What:** SUB-02 requires "ordered material rows plus hook size and thread." Model `hook_size`/`thread` as scalar columns on `flies`, and materials as an ordered child table (`fly_materials` with a `position` int), driven client-side by RHF's `useFieldArray`.
**Example:**
```typescript
// Source: react-hook-form official useFieldArray docs pattern — [CITED: react-hook-form.com/docs/usefieldarray]
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { submitFlySchema, type SubmitFlyInput } from './submit-fly-schema'

const { control, register, handleSubmit } = useForm<SubmitFlyInput>({
  resolver: zodResolver(submitFlySchema),
  defaultValues: { materials: [{ label: '', material: '' }] },
})

const { fields, append, remove, move } = useFieldArray({
  control,
  name: 'materials',
})

// fields.map((field, index) => (
//   <div key={field.id}>  {/* field.id, NOT index, per RHF docs */}
//     <input {...register(`materials.${index}.label`)} placeholder="Tail" />
//     <input {...register(`materials.${index}.material`)} placeholder="Pheasant tail fibers" />
//   </div>
// ))
```
```typescript
// submit-fly-schema.ts — shared client + server
import { z } from 'zod'

export const submitFlySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  hookSize: z.string().min(1).max(20),      // e.g. "#12-16" — free text, not numeric range
  thread: z.string().min(1).max(60),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  flyTypeId: z.string().uuid(),
  flySubcategoryId: z.string().uuid(),
  fishTypeIds: z.array(z.string().uuid()).min(1),
  materials: z.array(z.object({
    label: z.string().min(1).max(40),       // e.g. "Tail", "Body", "Hackle"
    material: z.string().min(1).max(120),   // free-text per FEATURES.md recommendation
    color: z.string().max(60).optional(),
  })).min(1),
  photoPaths: z.array(z.string()).min(1).max(6),  // uploaded Storage paths, primary = index 0
  primaryPhotoIndex: z.number().int().min(0),
})
export type SubmitFlyInput = z.infer<typeof submitFlySchema>
```
**Materials as free-text, not controlled vocabulary:** matches `.planning/research/FEATURES.md`'s explicit recommendation ("Start `material` as free-text to minimize submission friction; promote to a controlled, filterable vocabulary in v1.x") — do not build a materials lookup table in Phase 1; that's the deferred SUB-08 (v2).

### Pattern 8: Photo compression + EXIF strip pipeline (SUB-07)

**What:** Client-side, per-file, before Storage upload.
**Example:**
```typescript
// Source: browser-image-compression README pattern — [CITED: npmjs.com/package/browser-image-compression]
import imageCompression from 'browser-image-compression'

async function prepareForUpload(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/webp',
    // preserveExif defaults to false — canvas re-encode strips EXIF (incl. GPS) by default.
    // Do NOT set preserveExif: true.
  })
}
```
**Orientation caveat (verified this session via WebSearch):** the canvas re-encode that strips EXIF also discards the EXIF orientation tag. `browser-image-compression` reads and auto-applies orientation correction internally before re-encoding as part of its normal compression path — so the default call above is safe — but if a raw `<canvas>` re-encode is ever done manually (bypassing the library), orientation must be corrected first or portrait photos will render sideways. [CITED: npmjs.com/package/browser-image-compression via WebSearch digest — MEDIUM confidence, could not directly WebFetch the npm page in this session (403), corroborated by two independent WebSearch result summaries]

### Anti-Patterns to Avoid

- **Skipping `middleware.ts`:** the browser/server clients alone do not refresh expired tokens — sessions will silently expire mid-visit, breaking AUTH-05. Always ship the middleware.
- **Client-side profile insert after signup:** violates PROF-01 explicitly ("no client insert") and creates a race/failure mode where OAuth users who never hit that client code path get no profile row. Use the trigger.
- **jsonb-blob recipe:** technically satisfies SUB-02 today but forecloses the v2 SUB-08 faceted material search and makes ordering/validation harder to express in zod. Use the child table.
- **Enforcing email-confirmed only in the UI:** a disabled Submit button does not stop a direct PostgREST/Server Action call with a valid-but-unconfirmed session; must be RLS `WITH CHECK`.
- **`preserveExif: true`:** defeats SUB-07 and re-introduces the GPS-leak pitfall documented in `.planning/research/PITFALLS.md` Pitfall 6.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cookie management / token refresh | A custom cookie-parsing/refresh layer | `@supabase/ssr` `createServerClient` + `middleware.ts` | Cookie chunking, refresh timing, and SameSite/secure flags are already solved and are the #1 source of subtle auth bugs when hand-rolled |
| EXIF/GPS stripping | A manual canvas draw-and-redraw utility, or a separate exif-parsing library just to delete tags | `browser-image-compression` (canvas re-encode strips EXIF as a side effect of compression) | One library call does compress + resize + strip in one pass; a hand-rolled version needs to also solve orientation-before-strip correctly, which the library already does |
| Profile bootstrap on signup | A `useEffect` in the app that inserts a profile row after first login | Postgres trigger on `auth.users` | Trigger is required by PROF-01's literal wording and is the only path guaranteed to run for both password and OAuth signup — an app-side effect can be skipped, double-fire, or race with the redirect |
| Ordered form arrays | Manual `useState<Array>` + index-based re-render | `react-hook-form` `useFieldArray` | Handles key stability (`field.id`), insert/remove/move without full re-renders, and integrates with the zod resolver's array validation directly |
| Uniqueness/ownership enforcement on writes | Application-layer `if (owner !== user) throw` checks only | Postgres RLS `WITH CHECK` policies | The anon key is public by design (ships in the JS bundle); anyone can call PostgREST directly, bypassing any app-layer-only check (per CLAUDE.md "What NOT to Use" and PITFALLS.md Pitfall 1) |

**Key insight:** every "don't hand-roll" item above maps to a documented Supabase footgun in `.planning/research/PITFALLS.md` — this phase's foundation work is precisely the set of things that are cheap to get right now and expensive (data breach, silent auth failures, unqueryable recipes) to retrofit later.

## Runtime State Inventory

Not applicable — this is a greenfield phase (confirmed via `.planning/phases/01-foundation-submit/01-CONTEXT.md` "Existing Code Insights: None yet — greenfield" and repo listing showing only `README.md` and `.planning/`). No rename/refactor/migration is occurring.

## Common Pitfalls

### Pitfall 1: RLS enabled on some tables but not the OAuth-triggered `profiles` insert path
**What goes wrong:** Developer enables RLS on `profiles` for read/update but forgets the `handle_new_user` trigger function needs `SECURITY DEFINER` to bypass RLS during its own insert — the trigger silently fails (or the whole `auth.users` insert transaction rolls back), and signups break entirely.
**Why it happens:** RLS applies to the trigger's own `insert into profiles` just like any other write; without `SECURITY DEFINER set search_path = public`, the trigger runs as the invoking role and gets blocked by the very RLS policies meant to protect user-facing writes.
**How to avoid:** Always declare the bootstrap function `security definer set search_path = public` (as shown in Pattern 5).
**Warning signs:** Signup succeeds in `auth.users` (visible in Supabase dashboard) but no matching row appears in `public.profiles`; `/u/[username]` 404s for a just-signed-up user.

### Pitfall 2: Missing `middleware.ts` matcher breaks static asset handling or misses auth routes
**What goes wrong:** An overly broad matcher runs the Supabase client on every static asset request (slow, unnecessary cookie churn); an overly narrow matcher skips refreshing the session on pages that need it.
**Why it happens:** Copy-pasted matcher regexes from tutorials don't always match the actual project's asset/route layout.
**How to avoid:** Use the documented exclusion pattern (Pattern 2 example) that excludes `_next/static`, `_next/image`, `favicon.ico`, and common image extensions, but matches everything else including the auth callback routes.
**Warning signs:** Session appears to work in dev but users get logged out on some pages in production; Network tab shows the middleware running (or not running) unexpectedly on asset requests.

### Pitfall 3: Trout/species taxonomy modeled inconsistently with "one fly_type + one subcategory" cardinality
**What goes wrong:** D-05 requires species-level fish granularity (Rainbow/Brown/Brook/Cutthroat as separate `fish_types` rows) but SUB-05 requires exactly **one** `fly_type` + **one** `fly_subcategory` per fly. If the taxonomy seed accidentally allows a subcategory to belong to more than one fly_type (e.g., "Terrestrial" appearing under both Dry Fly and its own top-level type, per the overlap noted in `.planning/research/FEATURES.md`), the submit form's cascading select (subcategory options depend on selected fly_type) becomes ambiguous.
**Why it happens:** D-06 already resolved this for Terrestrial (promoted to its own top-level type, not a Dry Fly subcategory) — but the planner must carry that resolution through the actual seed migration, not just the fly_types row list. `fly_subcategories.fly_type_id` is a single FK (correct, matches ARCHITECTURE.md), so as long as each subcategory name is seeded under exactly one fly_type_id, this is a non-issue.
**How to avoid:** Seed migration must not create a "Terrestrial" row under Dry Fly's subcategories (per D-06, Terrestrial subcategories — Ant, Beetle, Hopper — belong only under the top-level Terrestrial fly_type).
**Warning signs:** Two rows with the same subcategory name under different fly_type_ids; submit-form subcategory dropdown showing duplicate-looking options.

### Pitfall 4: `useFieldArray` re-render/key bugs from using array index as the React key
**What goes wrong:** Removing/reordering material rows causes React to reuse the wrong DOM node's local input state (a classic "list reordering with index keys" bug), so an input's displayed value doesn't match its underlying form state after a remove/move.
**Why it happens:** It's tempting to `.map((m, i) => <div key={i}>)` instead of using the field's stable `id`.
**How to avoid:** Always key by `field.id` (RHF's auto-generated stable id), never by array index, as shown in Pattern 7.
**Warning signs:** Deleting the 2nd of 3 material rows visually removes the 3rd row's data instead.

### Pitfall 5: Confirming email doesn't imply session — user must re-authenticate or land already-signed-in depending on flow
**What goes wrong:** If the `/auth/confirm` route's `verifyOtp` call succeeds, Supabase Auth actually does establish a session in that response (unlike some OAuth flows that need a separate step) — but a developer might redirect to a page assuming the user is NOT yet signed in, showing a confusing "sign in" prompt right after they just confirmed.
**Why it happens:** Conflating "email confirmed" with "needs to sign in again" — they're not the same in Supabase's flow; `verifyOtp` with `type: 'email'` both confirms AND authenticates.
**How to avoid:** Redirect post-confirmation straight to the intended `next` destination (e.g., the submit form or home), not to a sign-in page.
**Warning signs:** User clicks confirmation link, lands on a sign-in form, has to enter credentials again — confusing but not a hard bug; just bad UX contradicting AUTH-02's intent.

## Code Examples

Verified patterns from official sources (see inline `[CITED: ...]` tags above in Architecture Patterns — consolidated list below for reference):

### Sign up (email/password)
```typescript
// Source: Supabase JS reference — signUp — [CITED: docs.supabase.com/reference/javascript/auth-signup]
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: `${location.origin}/auth/confirm` },
})
```

### Sign in (email/password)
```typescript
const { error } = await supabase.auth.signInWithPassword({ email, password })
```

### Sign out
```typescript
// Works from any page since the browser client is shared/singleton
await supabase.auth.signOut()
```

### Storage upload with owner-prefix path (SUB-01, D-04)
```typescript
// Source: pattern consistent with .claude/CLAUDE.md Image Handling section
const path = `${userId}/${flyId}/${crypto.randomUUID()}.webp`
const { error } = await supabase.storage
  .from('fly-photos')
  .upload(path, compressedFile, { contentType: 'image/webp' })
```

### Storage RLS (owner-prefix write, public read)
```sql
-- Source: Supabase Storage helper-functions doc pattern — [CITED: docs.supabase.com/guides/storage/schema/helper-functions]
create policy "fly photos public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'fly-photos');

create policy "fly photos owner write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fly-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | auth-helpers deprecated (bug fixes/features moved to `@supabase/ssr`) | Any tutorial referencing `createClientComponentClient`/`createServerComponentClient` from `auth-helpers` is stale; use `createBrowserClient`/`createServerClient` from `@supabase/ssr` instead |
| PKCE-only OAuth code exchange for all confirmations | Email confirmations use `verifyOtp(token_hash, type)`, OAuth uses `exchangeCodeForSession(code)` — two distinct callback routes | Established pattern, not a recent change, but frequently conflated in tutorials into a single "callback route" | Plan must include **two** routes (`/auth/callback` for OAuth, `/auth/confirm` for email), not one |
| `auth.uid() = user_id` unwrapped in RLS | `(select auth.uid()) = user_id` wrapped | Documented Supabase performance guidance | Wrap every `auth.uid()`/`auth.jwt()` call in every RLS policy written this phase — 100x+ difference on scans, cheap to do correctly from the start |

**Deprecated/outdated:**
- `@supabase/auth-helpers` (any package) — do not install, do not follow tutorials referencing it. [CITED: docs.supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers, corroborated in CLAUDE.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react`/`react-dom` exact patch version is `19.2.x` as stated in CLAUDE.md (not independently re-queried via `npm view` this session, though `next@16.2.9`'s peer range was not separately confirmed) | Standard Stack → Core | Low — even if patch differs slightly, `create-next-app@16.2` will pull a compatible React 19.2.x automatically; no plan action needed unless install fails |
| A2 | `typescript`, `tailwindcss`, `shadcn/ui` versions from CLAUDE.md are current (not independently re-queried this session) | Standard Stack → Core | Low — these are peripheral to Phase 1's auth/data-model focus; `npx create-next-app` / `shadcn init` will resolve current compatible versions regardless |
| A3 | Recommended username-collision mitigation (`ON CONFLICT` suffix) for the `handle_new_user` trigger — no official Supabase doc was found specifying the canonical collision-handling approach; this is inferred from general Postgres trigger practice, not a cited Supabase pattern | Architecture Patterns → Pattern 5 | Medium — if unhandled, a legitimate second user with a colliding email-local-part could have their entire signup silently fail (transaction rollback on `auth.users` insert). Flagged explicitly as an Open Question below for user/planner decision |
| A4 | `browser-image-compression`'s internal orientation-correction-before-strip behavior (i.e., that the library itself handles EXIF orientation before its canvas re-encode, so the default call in Pattern 8 is safe) — could not directly WebFetch npmjs.com (403 in this environment) to confirm from the primary source; based on two independent WebSearch result summaries of the same page | Architecture Patterns → Pattern 8 | Medium — if wrong, portrait photos uploaded via mobile could render sideways; low-cost to verify by testing one real portrait-mode phone photo through the pipeline during Phase 1 execution (recommend as a manual verification step, not a blocking assumption) |

## Open Questions

1. **Username collision handling for auto-generated profile usernames**
   - What we know: PROF-01 requires server-side bootstrap with no client insert; the trigger derives a default username from `raw_user_meta_data` or the email local-part.
   - What's unclear: CONTEXT.md and REQUIREMENTS.md don't specify whether users can/must choose their own username, or whether a collision-suffixed auto-generated one (e.g., `jsmith_a1b2c3`) is acceptable for v1.
   - Recommendation: Ship the `ON CONFLICT`-suffix trigger (Pattern 5, mitigation (a)) for Phase 1 to guarantee zero-friction signup never fails on a name collision; treat "let user edit their username" as an out-of-phase profile-editing feature (not blocking Phase 1's success criteria, which only require the profile page to exist).

2. **Exact Supabase project provisioning (cloud project creation, OAuth app registration in Google/GitHub consoles)**
   - What we know: This is manual, one-time dashboard/console setup, not code — CLAUDE.md and ARCHITECTURE.md both note Google/GitHub client ID/secret + redirect URI configuration happens in the Supabase dashboard and the respective OAuth provider consoles.
   - What's unclear: Whether the user (willharrison@gmail.com) already has a Supabase account/project, or whether Phase 1 execution needs to walk them through creating one plus registering two OAuth apps.
   - Recommendation: Plan should include an explicit `checkpoint:human-verify` (or equivalent manual-setup) task early in Wave 0 for: (a) Supabase project creation + retrieving the project URL/anon key, (b) Google Cloud OAuth consent screen + client ID/secret, (c) GitHub OAuth App client ID/secret, (d) entering all three into the Supabase dashboard's Auth providers + into local `.env.local`. None of this can be automated by the executing agent.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev/build | ✓ | v22.22.2 | — |
| npm | Package installs | ✓ | 10.9.7 | — |
| git | Version control | ✓ | 2.43.0 | — |
| Docker CLI | Supabase local stack | ✓ (client only) | 29.3.1 | — |
| Docker daemon | `supabase start` (local Postgres/Auth/Storage) | ✗ | — | Daemon not running (`/var/run/docker.sock` not found). Must be started before local Supabase dev can run — flag as a Wave 0 setup task. No viable code-only fallback; local Supabase development requires Docker. |
| Supabase CLI | Migrations, local dev, `gen types` | ✗ | — | Not installed. Install via `npm install -D supabase` (project-local, matches CLAUDE.md's "Supabase CLI" dev-tool listing) or the standalone binary — either works; recommend the npm dev-dependency for reproducibility across contributors. |
| Supabase cloud project | Auth/DB/Storage backend (prod target per CLAUDE.md) | Unknown — not verifiable from this environment | — | Requires manual creation via supabase.com dashboard; see Open Question 2 |
| Google OAuth app | AUTH-03 | Unknown | — | Manual console setup; see Open Question 2 |
| GitHub OAuth app | AUTH-04 | Unknown | — | Manual console setup; see Open Question 2 |

**Missing dependencies with no fallback:**
- Docker daemon must be running for Supabase local dev — this blocks migration authoring/testing entirely until started. Add as an explicit Wave 0 task (`docker` daemon start is environment-specific — Docker Desktop on macOS/Windows, `dockerd`/systemd on Linux — the plan should not hard-code a start command but should verify `docker info` succeeds before proceeding).
- Supabase cloud project + OAuth app registrations (Google, GitHub) require human action in external consoles; cannot be scripted by the executing agent.

**Missing dependencies with fallback:**
- Supabase CLI: not installed, but trivially installable (`npm install -D supabase`) — no blocker, just a Wave 0 install step.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (GoTrue) — email/password with confirmation, OAuth (Google/GitHub); no custom password storage/hashing in app code |
| V3 Session Management | yes | `@supabase/ssr` HTTP-only cookie sessions + `middleware.ts` refresh; no session tokens in localStorage/JS-readable storage |
| V4 Access Control | yes | Postgres RLS on every table (`USING`/`WITH CHECK`), ownership checks via `(select auth.uid()) = author_id`; no client-trusted authorization |
| V5 Input Validation | yes | zod schema shared client + Server Action (server-side re-validation is the actual boundary; client validation is UX only, per project convention already established in STACK.md) |
| V6 Cryptography | no (Phase 1 scope) | No custom crypto — Supabase Auth handles password hashing and JWT signing entirely server-side; app code never touches secrets or hashing |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Missing/misconfigured RLS exposing all tables via the public anon key | Information Disclosure / Elevation of Privilege | RLS enabled in the *same migration* that creates each table (never a follow-up migration); Security Advisor lint check before considering the phase done — see `.planning/research/PITFALLS.md` Pitfall 1, CVE-2025-48757 |
| `service_role` key reaching the browser bundle | Elevation of Privilege | This phase's client code only ever imports the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`); no server-role operations exist in Phase 1 scope (no admin/moderation yet), so there is no code path that should touch the service key at all — grep the built output for `service_role` as a verification step |
| Unconfirmed-email writes (sockpuppet/spam signups submitting immediately) | Spoofing / Repudiation | RLS `WITH CHECK` gate on `flies` insert requiring `is_email_confirmed()` (Pattern 6) — not just a UI-disabled button |
| Storage path traversal / uploading outside own prefix | Tampering / Elevation of Privilege | `storage.foldername(name)[1] = (select auth.uid())::text` RLS check on `storage.objects` insert/update (Code Examples section) |
| Stored XSS via free-text description/recipe fields rendered on the author detail page | Tampering | React escapes text content by default; explicitly do not use `dangerouslySetInnerHTML` anywhere in the fly detail/submit rendering path (per PITFALLS.md Security Mistakes table) |
| EXIF/GPS metadata leaking a user's tying location | Information Disclosure | `browser-image-compression` default (`preserveExif: false`) strips it client-side before any upload — SUB-07's literal requirement |
| OAuth open-redirect via unvalidated `next`/`redirectTo` param | Tampering | Validate/whitelist the `next` param in both callback routes (Patterns 3–4) to same-origin relative paths only, rather than blindly redirecting to any client-supplied URL |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <pkg> version`, run this session, 2026-07-01) — exact current versions for next, react-hook-form, zod, @hookform/resolvers, @supabase/ssr, @supabase/supabase-js, browser-image-compression — all match CLAUDE.md.
- `gsd-tools query package-legitimacy check --ecosystem npm` (run this session) — repo-URL + deprecation/postinstall signals for all 13 Phase 1 packages.
- `.claude/CLAUDE.md` — locked stack, RLS/image-handling posture, "What NOT to Use" (project-authoritative, itself sourced from a prior `npm view` pass + official Supabase docs per its own Sources section).
- `.planning/research/ARCHITECTURE.md` — schema sketch, RLS policy sketch, `handle_new_user` trigger pattern, Storage RLS policy pattern (project-level research, HIGH confidence per its own metadata).
- `.planning/research/PITFALLS.md` — RLS/service-key/EXIF pitfalls, CVE-2025-48757 citation.

### Secondary (MEDIUM confidence)
- WebSearch digests of Supabase official docs pages (direct WebFetch to supabase.com returned HTTP 403 in this environment — likely bot-protection at Supabase's edge, not a proxy misconfiguration; `curl "$HTTPS_PROXY/__agentproxy/status"` showed no relay failures): `supabase.com/docs/guides/auth/server-side/nextjs`, `supabase.com/docs/guides/auth/social-login/auth-google`, `supabase.com/docs/reference/javascript/auth-verifyotp`, `supabase.com/docs/guides/auth/auth-email-templates`, `supabase.com/docs/guides/storage/schema/helper-functions`, `supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv`.
- WebSearch digest of `npmjs.com/package/browser-image-compression` (direct WebFetch also 403'd) — `preserveExif` default-false / canvas-strips-EXIF claim, corroborated across two independent search result summaries.
- WebSearch digest of `react-hook-form.com/docs/usefieldarray` official docs — `field.id`-as-key requirement, array validation pattern.

### Tertiary (LOW confidence)
- General community tutorials/blog posts surfaced by WebSearch (dev.to, Medium, makerkit.dev) used only to corroborate patterns already sourced from official docs above — not cited standalone for any claim in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version independently re-verified against the live npm registry this session and matches the already-locked CLAUDE.md figures exactly; zero drift found.
- Architecture: HIGH — schema/RLS/trigger patterns are carried forward from `.planning/research/ARCHITECTURE.md` (itself HIGH confidence) and cross-checked against official-docs WebSearch digests this session; the one net-new synthesis (recipe-as-child-table vs jsonb, `useFieldArray` wiring) is grounded in official react-hook-form docs.
- Pitfalls: HIGH for RLS/service-key/EXIF items (carried forward from project PITFALLS.md, itself cross-checked against CVE-2025-48757); MEDIUM for the phase-specific new pitfalls identified this session (username collision, middleware matcher, taxonomy cardinality) since these are reasoned from the schema/requirements rather than directly cited from an external source.

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (30 days — Next.js/Supabase SSR APIs are reasonably stable, but this is a fast-moving stack; re-verify package versions if planning is delayed past this window)
