-- Migration 0002 — is_email_confirmed() email-confirmed write-gate helper
--
-- Delivers the DB-level primitive behind AUTH-02: an unconfirmed-but-authenticated
-- session must be blocked from privileged writes at the DATABASE, not merely by a
-- disabled button in the UI (threat T-03-02). Plan 04's flies-insert RLS policy
-- calls this helper in its WITH CHECK so unconfirmed users cannot insert flies.
--
-- APPLY SEQUENCING (consolidated-push model — read carefully):
--   This migration is AUTHORED here (Plan 01-03) but is NOT pushed within this
--   plan. Its apply to the live cloud DB is CONSOLIDATED into Plan 01-04 Task 2's
--   single `supabase db push`, which applies 0002 alongside 0003-0006 in one push
--   (idempotent for already-applied migrations, so 0001 is skipped there). This
--   keeps every Docker/CLI-dependent push in the one autonomous:false task rather
--   than splitting them across plans. If a 0002 apply ever fails, it surfaces in
--   Plan 01-04 Task 2 (the push step), NOT here.
--
-- Design notes (see .planning/phases/01-foundation-submit/01-RESEARCH.md Pattern 6):
--   * SECURITY DEFINER so the helper can read auth.users.email_confirmed_at (the
--     caller's role cannot select from auth.users directly).
--   * STABLE — read-only, no write path; the planner can safely cache within a
--     statement. LANGUAGE sql (not plpgsql) keeps it a trivial single SELECT.
--   * set search_path = public pins name resolution (SECURITY DEFINER hardening).
--   * auth.uid() wrapped as (select auth.uid()) for the documented RLS perf win
--     and so it evaluates once per statement, not per row, when called from a
--     policy predicate.
--   * Parameterless + single-column read of ONLY the caller's own row — the broad
--     SECURITY DEFINER surface is accepted (threat T-03-04) precisely because
--     there is no injection surface and no write path.

create or replace function public.is_email_confirmed()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select (
    select email_confirmed_at
    from auth.users
    where id = (select auth.uid())
  ) is not null;
$$;

comment on function public.is_email_confirmed() is
  'AUTH-02 write-gate: returns true when the current session''s email is confirmed. Called from RLS WITH CHECK on privileged inserts (e.g. flies, ratings) so unconfirmed users are blocked at the DB, not just the UI.';

-- Expose to the roles that evaluate RLS policies. anon can call it (it simply
-- returns false when there is no authenticated uid); authenticated needs it for
-- the write-gate predicate.
grant execute on function public.is_email_confirmed() to anon, authenticated;
