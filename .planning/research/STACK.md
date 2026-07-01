# Stack Research

**Domain:** Community catalog / rating web app (photo-centric CRUD + public SEO pages) on React + Supabase
**Researched:** 2026-07-01
**Confidence:** HIGH (versions verified against npm registry 2026-07-01; patterns verified against Supabase/shadcn/Next.js official docs)

> Fixed constraints (not relitigated): modern React front end; Supabase (Postgres + Auth + Storage + auto REST/Realtime + RLS); email/password + Google/GitHub auth; anonymous browse/search, account required to submit/rate; photos in Supabase Storage. Everything below is the prescriptive stack *around* those.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js (App Router)** | 16.2.x | React meta-framework, routing, SSR/SSG, image handling, hosting target | Flyrate is a **public, SEO-critical catalog** (leaderboards, per-category/per-fish pages, individual fly pages must be crawlable and shareable). Server-rendered/statically-generated public pages beat a client-only SPA here. App Router + Server Components let anonymous pages render on the server with no auth round-trip, while interactive submit/rate flows stay client-side. Supabase's **first-party SSR auth guide targets Next.js App Router directly** (`@supabase/ssr`), so this is the lowest-friction path. |
| **React** | 19.2.x | UI runtime | Current stable; required peer for Next 16 and shadcn/ui. Server Components + Actions are stable and used for the SSR data-fetch pattern. |
| **TypeScript** | 5.9.x | Type safety across app + DB types | Non-negotiable for a Supabase project — generate DB types from the schema (`supabase gen types typescript`) so queries, RLS-shaped rows, and taxonomy enums are type-checked end to end. |
| **@supabase/supabase-js** | 2.110.x | Supabase client (Postgres queries, Auth, Storage, Realtime) | The one SDK for all Supabase surfaces. Use its query builder for reads/writes against RLS-protected tables and views. |
| **@supabase/ssr** | 0.12.x | Cookie-based Supabase auth for SSR frameworks | **The** supported way to do Supabase auth in Next.js. Replaces the deprecated `@supabase/auth-helpers`. Provides `createBrowserClient` (Client Components) and `createServerClient` (Server Components / Route Handlers / Server Actions), storing the session in HTTP-only cookies and refreshing tokens in middleware. |
| **Tailwind CSS** | 4.x | Styling | v4 is current, fully supported by shadcn/ui and Next 16. Zero-runtime, great for a content-dense responsive catalog. |
| **shadcn/ui** | latest CLI (Radix-based) | Component layer (not a dependency — you vendor the components) | Copy-in components (Button, Dialog, Form, Select, Card, Table, Star/Rating primitives you compose) on top of Radix + Tailwind. Full React 19 + Tailwind v4 support confirmed. You own the code — no lock-in, easy to theme for a photo-first UI. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@tanstack/react-query** | 5.101.x | Client-side server-state cache for interactive/authenticated views | Use for the **client** islands: rate-a-fly mutations with optimistic star updates, "my submissions" dashboard, infinite-scroll/trending feeds, filter panels that re-query without full navigation. Public SEO pages fetch server-side (RSC) and skip it. See "Alternatives" for why over SWR. |
| **react-hook-form** | 7.80.x | Form state | The fly-submission form is the most complex UI (recipe fields, difficulty, taxonomy selects, multi-photo, validation). RHF is uncontrolled/perf-friendly and the shadcn `Form` component is built around it. |
| **zod** | 4.x | Schema validation (client + server) | One schema validates the submission form (via `@hookform/resolvers`) **and** re-validates in the Server Action / Route Handler before writing to Supabase. Never trust client validation alone. |
| **@hookform/resolvers** | 5.4.x | Bridge Zod ↔ react-hook-form | Wires the Zod schema into RHF. |
| **browser-image-compression** | 2.0.x | Client-side downscale/compress before upload | Fly photos come straight off phones (5–12 MP). Compress in the browser before `supabase.storage.upload()` to cut egress, storage, and upload time. This is the free path; Supabase server-side image transforms are **Pro-plan only** (see caveats). |
| **date-fns** | 4.x | Date formatting ("submitted 3 days ago", trending windows) | Tree-shakeable; avoid moment.js. |
| **lucide-react** | latest | Icon set | Ships with shadcn/ui; stars, filters, upload icons. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Vitest** 4.x | Unit/component tests | Fast, Vite-native, Jest-compatible API. Test Zod schemas, ranking/aggregation helpers, and components with React Testing Library. |
| **@testing-library/react** | Component testing | Standard for user-centric component tests. |
| **Playwright** 1.61.x | E2E tests | Cover the critical loops: anonymous search/browse, sign-in (email + OAuth mock), submit-with-photo, rate-a-fly, leaderboard renders. |
| **Supabase CLI** | Local Postgres + migrations + type gen | Run Postgres/Auth/Storage locally in Docker; keep schema, RLS policies, and taxonomy seed data as **versioned SQL migrations** (do not click-configure in the dashboard). `supabase gen types typescript` produces the TS types. |
| **ESLint 9 + Prettier** | Lint/format | Use `eslint-config-next`. |
| **@tanstack/react-query-devtools** | Query cache inspection | Dev-only. |

## Installation

```bash
# Scaffold (Next.js 16, TS, Tailwind v4, App Router)
npx create-next-app@latest flyrate --typescript --tailwind --app --eslint

# Supabase SDK + SSR auth
npm install @supabase/supabase-js @supabase/ssr

# Data fetching / forms / validation
npm install @tanstack/react-query react-hook-form zod @hookform/resolvers

# Utilities
npm install browser-image-compression date-fns lucide-react

# shadcn/ui (interactive scaffold — vendors components into the repo)
npx shadcn@latest init

# Dev / testing
npm install -D vitest @testing-library/react @testing-library/jest-dom \
  @playwright/test @tanstack/react-query-devtools prettier

# Supabase CLI (local stack + migrations + type generation)
npm install -D supabase
```

## Data Model & RLS Patterns (Postgres side)

This is where the domain lives; the front-end stack just consumes it.

### Taxonomy (predefined + admin-approved suggestions)

- **Use lookup tables, NOT Postgres `enum` types**, for `fly_types`, `fly_subcategories`, and `fish_types`. Rationale: the taxonomy is explicitly *evolving and admin-managed* (requirements allow user suggestions + approval). Altering a Postgres enum is a migration/lock; inserting a row into a table is a normal write and RLS-governable.
- `fly_subcategories.fly_type_id` FK enforces the "subcategory belongs to a type" hierarchy.
- Fly ↔ fish is many-to-many ("one or more target fish types") → junction table `fly_fish_types (fly_id, fish_type_id)`.
- `category_suggestions` table with a `status` column (`pending`/`approved`/`rejected`). RLS: authenticated users can `INSERT` suggestions; only admins can `UPDATE` status; approval writes into the real lookup table.

### Ratings & aggregation (5-star, no self-rating)

- `ratings (fly_id, user_id, stars smallint CHECK (stars BETWEEN 1 AND 5), created_at)` with a **`UNIQUE (fly_id, user_id)`** constraint → one rating per user per fly (upsert to change).
- **Enforce "can't rate your own fly" in an RLS `WITH CHECK` policy**, not just the UI: `WITH CHECK (auth.uid() <> (SELECT submitted_by FROM flies WHERE id = fly_id))`. Belt-and-suspenders with a trigger is reasonable but RLS is the primary guard.
- **Averages/counts:** do not compute in the client. Two solid options:
  - **Regular view with `security_invoker = true`** (`fly_ratings_summary` = `avg(stars)`, `count(*)` grouped by fly) for always-fresh numbers. Fine at Flyrate's expected volume and the default recommendation.
  - **Materialized view** only if leaderboards get slow at scale; refresh on a schedule (pg_cron) or trigger. Caveat: Postgres does not support RLS on materialized views, so only materialize non-sensitive aggregate data and keep it out of the public API schema unless intentionally public.
- Leaderboards (global / per-category / per-fish / trending) are **queries/views over the summary**, ordered by average (apply a minimum-vote threshold or a Bayesian/weighted average to avoid a single 5-star fly topping the board).

### RLS posture for anonymous browse + gated write

- Enable RLS on every table.
- `flies`, taxonomy tables, ratings, and summary views: `SELECT` policy `USING (true)` (or `USING (status = 'approved')`) so the **anon** key can read for public SEO pages.
- `INSERT`/`UPDATE`/`DELETE` on `flies`, `ratings`, `category_suggestions`: `USING (auth.uid() IS NOT NULL)` + ownership checks (`auth.uid() = submitted_by`).
- Admin actions: gate via a custom claim / `profiles.role = 'admin'` check inside policies. **Never** ship the Supabase **service-role key** to the browser; use it only inside server-side code (Route Handlers / Server Actions) for admin/moderation operations that must bypass RLS.

### Image handling

- Bucket `fly-photos`; **path convention `{user_id}/{fly_id}/{uuid}.webp`** so a Storage RLS policy can allow writes only under the user's own prefix (`(storage.foldername(name))[1] = auth.uid()::text`).
- Compress client-side (`browser-image-compression`) → upload → store the object path in the DB (not a signed URL).
- Serving: public bucket + `getPublicUrl` for a photo-catalog is simplest. Supabase's on-the-fly `transform` (width/height/quality, auto-WebP) is great for thumbnails/cards **but is Pro-plan-gated** — on the free tier, generate a compressed thumbnail client-side at upload instead.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Next.js (App Router)** | Vite + React Router v7 (framework mode) / TanStack Router | Choose only if you're willing to give up first-class SSR SEO or self-run an SSR server. Flyrate's public catalog needs crawlable server-rendered pages, which Vite-SPA doesn't give out of the box — so Next wins here. TanStack Start is compelling but younger and not the path Supabase documents. |
| **Next.js** | Remix (now folded into React Router v7) | Remix's data model is excellent, but Supabase's canonical SSR-auth docs, Vercel's official Supabase starter, and the larger ecosystem all center on Next App Router. Fewer sharp edges. |
| **TanStack Query** | SWR | SWR (smaller, Vercel-made) is fine if the app were near-purely read-only. Flyrate has real mutations (rating with optimistic updates, upserts, "my submissions", moderation queue) where TanStack Query's mutation primitives, cache invalidation, and devtools pay off. Either is acceptable — commit to one. |
| **TanStack Query (manual)** | supabase-cache-helpers | Add cache-helpers if you want automatic cache-key derivation from Supabase queries. Optional convenience layer on top of TanStack Query/SWR; skip until the manual invalidation becomes annoying. |
| **shadcn/ui** | MUI / Chakra / Mantine | Choose a batteries-included lib only if you want prebuilt components without owning code. shadcn's copy-in model + Tailwind gives more control for a distinctive photo-first catalog and no version-lock. |
| **browser-image-compression + Storage transforms** | Cloudinary / imgix | Only if you outgrow Supabase Storage's transform limits or need advanced DAM features. Adds a vendor + cost; unnecessary for v1. |
| **Regular summary view** | Materialized view + pg_cron | Switch when leaderboard queries measurably slow down at scale. Start simple. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **@supabase/auth-helpers** (`-nextjs`) | Deprecated; bug fixes and features moved to `@supabase/ssr`. Following old tutorials here is the #1 Supabase-auth footgun. | `@supabase/ssr` (`createBrowserClient` / `createServerClient`). |
| **Supabase service-role key in the browser / `NEXT_PUBLIC_`** | Bypasses RLS entirely — total data compromise if exposed. | Anon/publishable key on the client; service-role key **only** in server-side code. |
| **Postgres `enum` types for the taxonomy** | Taxonomy must grow via admin approval; changing an enum requires a migration + lock and can't be governed by RLS. | Lookup **tables** with FKs + RLS. |
| **Computing average ratings in the client** | Wrong/inconsistent numbers, N+1 queries, can't sort leaderboards in the DB, leaks all rating rows to the browser. | DB view/materialized view (`avg`, `count`) queried directly. |
| **Legacy `@supabase/auth-ui-react`** for the whole auth UX | Minimal, hard to theme, semi-abandoned. | Build sign-in/up with shadcn `Form` + `supabase.auth` calls, or use Supabase's hosted flows for OAuth. |
| **moment.js** | Large, mutable, in maintenance mode. | `date-fns`. |
| **Redux / Zustand for server data** | Ratings/flies/leaderboards are *server* state, not client state. Hand-rolling caching in a global store reinvents TanStack Query badly. | TanStack Query for server state; local `useState`/`useContext` (or a tiny Zustand store) only for genuine UI state. |
| **Client-side-only rendering for public catalog pages (pure SPA)** | Kills SEO/shareability for leaderboards and fly pages — a core requirement. | RSC/SSR/SSG public pages via Next App Router. |

## Stack Patterns by Variant

**If leaderboards stay small/medium volume (expected v1):**
- Regular views (`security_invoker`) for rating summaries + leaderboards.
- Public bucket + client-side thumbnail compression (free tier).
- Because it's the simplest correct setup and avoids Pro-plan and refresh complexity.

**If the catalog grows large / leaderboards get slow:**
- Introduce materialized views refreshed via pg_cron or triggers; add covering indexes on `ratings(fly_id)` and leaderboard sort columns.
- Enable Supabase Pro image transformations for on-the-fly responsive thumbnails.
- Because precomputed aggregates + CDN transforms are the standard scale levers.

**If you want to minimize client JS on public pages:**
- Fetch fly/leaderboard data in Server Components with the server Supabase client; reserve TanStack Query strictly for authenticated interactive islands (rating, dashboard).
- Because anonymous visitors are the largest audience and shouldn't pay for hydration they don't need.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.2.x | react@19.2.x, react-dom@19.2.x | Next 16 requires React 19. |
| shadcn/ui (current CLI) | react@19, tailwindcss@4, next@16 | Official React 19 + Tailwind v4 support confirmed; init with the current CLI, not pre-v4 guides. |
| tailwindcss@4 | Next 16 PostCSS/Turbopack pipeline | v4 uses the new `@theme`/CSS-first config; follow shadcn's Tailwind v4 doc. |
| @supabase/ssr@0.12.x | @supabase/supabase-js@2.110.x, next@16 App Router | Use `createBrowserClient`/`createServerClient` + middleware token refresh. |
| react-hook-form@7.80.x | @hookform/resolvers@5.4.x, zod@4.x | Resolver v5 supports Zod v4. |
| zod@4.x | @hookform/resolvers@5.x | Zod v4 has API changes vs v3; ensure tutorials/snippets target v4. |
| @tanstack/react-query@5.101.x | react@19 | v5 is the current major (v4 API differs — `isPending` not `isLoading`, single-object signatures). |

## Sources

- npm registry (`npm view <pkg> version`), 2026-07-01 — exact current versions for next, react, @supabase/supabase-js, @supabase/ssr, @tanstack/react-query, react-hook-form, zod, @hookform/resolvers, tailwindcss, vitest, @playwright/test. **HIGH**
- Supabase Docs — Server-Side Auth for Next.js / Creating a client for SSR (`@supabase/ssr`, auth-helpers deprecation) — https://supabase.com/docs/guides/auth/server-side/nextjs , https://supabase.com/docs/guides/auth/auth-helpers/nextjs. **HIGH**
- Supabase Docs — Row Level Security; RLS performance best practices — https://supabase.com/docs/guides/database/postgres/row-level-security. **HIGH**
- Supabase Docs — Storage Image Transformations (Pro-plan gating, auto-WebP, transform option) — https://supabase.com/docs/guides/storage/serving/image-transformations. **HIGH**
- Supabase GitHub Discussion #17790 — Materialized views + RLS limitations. **MEDIUM**
- shadcn/ui Docs — Tailwind v4 + React 19 support — https://ui.shadcn.com/docs/tailwind-v4 , https://ui.shadcn.com/docs/react-19. **HIGH**
- TanStack Query vs SWR comparisons (2026 dev.to/refine) — mutation/optimistic-update rationale — **MEDIUM** (opinion, cross-checked against library docs).

---
*Stack research for: community photo-catalog rating app on React + Supabase*
*Researched: 2026-07-01*
