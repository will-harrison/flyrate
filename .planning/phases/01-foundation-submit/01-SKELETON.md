# Walking Skeleton — Flyrate

**Phase:** 1
**Generated:** 2026-07-01

## Capability Proven End-to-End

A visitor can sign up with email/password, the session survives a browser refresh, a `public.profiles` row is created server-side by a Postgres trigger (no client insert), and the signed-in user sees their derived username rendered by a server component on a page served by the running Next.js app against the live Supabase Postgres.

This is the thinnest slice that exercises the full locked stack: Next.js App Router scaffold + `@supabase/ssr` browser/server/middleware clients + a real DB write (trigger-created profile row) + a real DB read (server component fetches the profile) + a real UI interaction (sign-up form) + a documented local full-stack run command.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.x App Router, React 19.2.x, TypeScript 5.9.x, `src/` dir, import alias `@/*` | LOCKED in `.claude/CLAUDE.md`. Public catalog (Phase 2) is SEO-critical → SSR/RSC required; Supabase's first-party SSR auth guide targets Next App Router. |
| Data layer | Supabase (cloud-hosted Postgres) via `@supabase/supabase-js` 2.110.x; versioned SQL migrations in `supabase/migrations/` authored + applied with the Supabase CLI | LOCKED. Managed Postgres + Auth + Storage; schema/RLS/seed live as versioned migrations, never dashboard click-config. |
| Auth | Supabase Auth (GoTrue) via `@supabase/ssr` 0.12.x — HTTP-only cookie sessions, `createBrowserClient` (Client Components), `createServerClient` (Server Components / Route Handlers / Server Actions), `middleware.ts` token refresh. Email/password + Google + GitHub OAuth. | LOCKED. `@supabase/ssr` is the only supported wiring; `@supabase/auth-helpers` is deprecated ("What NOT to Use"). Never ships the service-role key to the browser. |
| Authorization | Postgres Row Level Security enabled in the SAME migration that creates each table; ownership + email-confirmed gates enforced in RLS `WITH CHECK`, not just UI. `(select auth.uid())` wrapped in every policy for the documented performance win. | LOCKED foundation decision — RLS is effectively impossible to retrofit safely. CVE-2025-48757 class of bug. |
| Profile bootstrap | `SECURITY DEFINER` Postgres function `public.handle_new_user()` + `AFTER INSERT` trigger `on_auth_user_created` on `auth.users` → inserts `public.profiles`. Username collisions resolved with an `ON CONFLICT` suffix (RESEARCH Open Q1 mitigation (a)). | PROF-01 literal requirement: "server-side bootstrap, no client insert." Trigger fires for both password and OAuth signups. |
| Taxonomy modeling | Lookup TABLES (`fly_types`, `fly_subcategories`, `fish_types`), never Postgres `enum` types. `fly_subcategories.fly_type_id` FK enforces hierarchy; fly↔fish is many-to-many via junction. | LOCKED — taxonomy is admin-managed/evolving (user suggestions in Phase 4); altering an enum is a lock/migration and cannot be RLS-governed. |
| Image pipeline | Client-side compress + EXIF/GPS strip via `browser-image-compression` 2.0.x (canvas re-encode, `preserveExif: false` default), then upload to a public Storage bucket `fly-photos`; store the object path in the DB. Free tier — no Pro server-side transforms. | LOCKED (Supabase free tier). SUB-07: EXIF/GPS stripped before upload; privacy (tying-location leak) mitigation. |
| Deployment target | Local full-stack run against the cloud Supabase project: `npm run dev` (Next.js) + `supabase db push` to apply migrations to the linked cloud project. No hosting deploy in Phase 1 (Vercel deferred). | Docker daemon is NOT running and Supabase CLI is NOT installed in this env; local Supabase stack requires Docker. Simplest correct path is to push migrations to the cloud project and run the app locally against it. |
| Directory layout | Feature folders under `src/features/*` (auth, submit); Supabase clients under `src/lib/supabase/*`; App Router routes under `src/app/*`; generated DB types at `src/types/database.types.ts`; shadcn components vendored under `src/components/`. | Matches RESEARCH.md Recommended Project Structure; keeps interactive islands (auth, submit) isolated from server-rendered pages. |

## Stack Touched in Phase 1

- [x] Project scaffold (Next.js 16 App Router, TS, Tailwind v4, shadcn init, ESLint) — Plan 02
- [x] Routing — real routes: `/`, `/auth/sign-up`, `/auth/sign-in`, `/auth/callback`, `/auth/confirm`, `/u/[username]`, `/flies/new`, `/flies/[id]` — Plans 02–04
- [x] Database — real write (trigger-created `profiles` row; fly insert) AND real read (server component fetch of profile / fly / taxonomy) — Plans 02–04
- [x] UI — interactive elements wired to the backend: sign-up/sign-in forms, sign-out, the single-scroll submit form — Plans 02–04
- [x] Deployment — documented local full-stack run: `supabase db push` + `npm run dev` against the linked cloud Supabase project — Plans 01–02

## Out of Scope (Deferred to Later Slices)

- Public / anonymous browse, search, catalog listing, and filtering — Phase 2 (DISC-*).
- SEO metadata, OG tags, sitemap, public crawlable catalog/detail pages — Phase 2. The `/flies/[id]` page built here is author-visible only.
- Community rating, average/count display, Bayesian ranking, fraud guards, leaderboards, "recent" view — Phase 3 (RATE-*, LEAD-*). The star display on the detail page is a read-only "No ratings yet" stub.
- Profile submission/rating history — Phase 4 (PROF-02/03). Phase 1 only guarantees the profile page exists (PROF-01).
- User category suggestions + admin moderation console — Phase 4 (TAX-02/03, MOD-*).
- User-editable usernames (auto-derived + collision-suffixed is sufficient for v1 per RESEARCH Open Q1).
- Pro-plan server-side image transforms; drag-and-drop photo reorder; faceted material search (v2 SUB-08).
- Production hosting deploy (Vercel).

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Public Catalog & Discovery:** make the catalog + `/flies/[id]` public, anonymous, SEO-crawlable (SSR/SSG + metadata + sitemap); browse/search/filter by fly type, subcategory, fish, difficulty.
- **Phase 3 — Rate, Rank & Leaderboards:** ratings table (`UNIQUE(fly_id,user_id)`, no-self-rating RLS `WITH CHECK` + trigger), Bayesian aggregate trigger, average/count display, global/category/fish leaderboards, "recent" view.
- **Phase 4 — Community & Moderation:** profile submission/rating history, user taxonomy suggestions (pending queue), admin moderation console (approve/reject suggestions, unpublish flies, remove ratings).
