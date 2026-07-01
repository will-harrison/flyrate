# Summary — Plan 01-01: Provision Supabase + OAuth providers

**Phase:** 1 (Foundation & Submit) · **Plan:** 01 · **Wave:** 1
**Completed:** 2026-07-01
**Requirements:** AUTH-03, AUTH-04 (provider prerequisites)

## What was done

- **Task 1 (human checkpoint — CONFIRMED by user):** The Supabase cloud project was created; Google and GitHub OAuth providers were registered (with the Supabase `/auth/v1/callback` redirect URI) and enabled in Supabase; Site URL + Redirect URLs set to `http://localhost:3000`; the confirm-signup email template link corrected to `/auth/confirm?token_hash=...&type=email`. User signalled setup complete ("Setup done — proceed").
- **Task 2 (env files):**
  - `.env.example` committed with the three required keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`) as non-secret placeholders, plus a header documenting the anon-key-only rule (service-role key must never appear in a `NEXT_PUBLIC_` var).
  - `.env.local` present and **gitignore-covered** (`git check-ignore -q .env.local` exits 0). Coverage case: **already ignored by the existing `.env` / `.env.*` rules in `.gitignore`** — no new rule needed.
  - No service-role key in either file.

## Environment caveat (important)

This plan was executed in an **ephemeral remote container** with no persisted secrets. Per the checkpoint's guidance ("do NOT paste the anon key or any secret into chat"), `.env.local` here holds **placeholder values only**. Before running the app locally, populate `.env.local` on your local machine with the real Project URL, anon key, and access token from your Supabase dashboard.

## Verification

- `git check-ignore -q .env.local` → exit 0 (ignored). ✓
- `.env.example` lists the three keys with placeholder values. ✓
- No `service_role` token in `.env.example` or `.env.local`. ✓
- Human confirmation recorded that both OAuth providers are enabled with matching callback URIs and the confirm-signup template link is corrected. ✓

## Follow-ups for local completion

- Populate the real values into `.env.local` locally.
- Downstream migrations are applied via `supabase db push` (needs Supabase CLI + `SUPABASE_ACCESS_TOKEN`) — run locally; this container has neither Docker nor the Supabase CLI.
