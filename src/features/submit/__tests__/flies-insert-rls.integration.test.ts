/**
 * AUTH-02 DB-gate integration test (T-04-02).
 *
 * Proves — automatically, not only at the Task 6 human-verify — that an
 * UNCONFIRMED but authenticated user's direct INSERT into public.flies is
 * REJECTED by RLS. This is the real authorization boundary: migration 0005's
 * flies-insert `WITH CHECK ((select auth.uid()) = author_id AND
 * public.is_email_confirmed())` blocks writers whose email is not confirmed,
 * even if they bypass the UI and call PostgREST directly with a valid session.
 *
 * ── HOW TO RUN (authored-but-deferred) ────────────────────────────────────────
 * This test needs (a) Vitest installed and (b) a LIVE cloud project with
 * migrations 0002-0006 applied and email-confirmation REQUIRED in Auth settings.
 * Neither is available in the ephemeral build container, so it is guarded to
 * SKIP when the Supabase env vars are absent (it will not fail a credential-less
 * CI). To run it locally after Plan 04 Task 2's `supabase db push`:
 *
 *   1. npm install -D vitest
 *   2. ensure .env.local has NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   3. In Supabase Auth settings, keep "Confirm email" ON (default) so new
 *      signups are unconfirmed until they click the link.
 *   4. npx vitest run src/features/submit/__tests__/flies-insert-rls.integration.test.ts
 *
 * The test signs up a fresh user (which, with email-confirmation required,
 * leaves them authenticated-but-unconfirmed), then attempts the insert and
 * asserts it is rejected and no row is created.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Skip cleanly when credentials are absent (build container / credential-less CI).
const describeOrSkip = url && anonKey ? describe : describe.skip;

describeOrSkip("flies insert is RLS-gated on email confirmation (AUTH-02)", () => {
  let supabase: SupabaseClient;
  let createdUserId: string | null = null;

  it("rejects an unconfirmed user's direct flies INSERT", async () => {
    supabase = createClient(url as string, anonKey as string);

    // A unique throwaway email; with confirmation required this user is
    // authenticated but UNCONFIRMED immediately after signUp.
    const email = `rls-test+${crypto.randomUUID()}@example.com`;
    const password = `Pw-${crypto.randomUUID()}`;

    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    expect(signUpError).toBeNull();

    const userId = signUp.user?.id ?? null;
    createdUserId = userId;
    expect(userId).toBeTruthy();

    // Sanity: the session's email must NOT be confirmed for this test to be meaningful.
    expect(signUp.user?.email_confirmed_at ?? null).toBeNull();

    // Fetch valid taxonomy IDs (taxonomy is public-readable via `USING (true)`).
    // Supplying them makes the insert payload satisfy every NOT NULL / FK
    // constraint, so the ONLY remaining reason the write can be rejected is the
    // email-confirmed RLS predicate — isolating the AUTH-02 boundary this test
    // claims to prove (rather than a payload NOT NULL/FK error masking it).
    const { data: flyType } = await supabase
      .from("fly_types")
      .select("id")
      .limit(1)
      .single();
    const { data: subcategory } = await supabase
      .from("fly_subcategories")
      .select("id")
      .eq("fly_type_id", flyType?.id as string)
      .limit(1)
      .single();
    // Guard: without seeded taxonomy the test cannot isolate the gate — fail
    // loudly rather than silently reproducing the weak NOT NULL/FK rejection.
    expect(flyType?.id, "taxonomy seed (0004) must be applied").toBeTruthy();
    expect(subcategory?.id, "taxonomy seed (0004) must be applied").toBeTruthy();

    // Attempt a direct insert bypassing the Server Action entirely. The payload
    // is now fully valid — the email-confirmed RLS check is the sole gate left.
    const { data: inserted, error: insertError } = await supabase
      .from("flies")
      .insert({
        author_id: userId as string,
        name: "RLS probe fly",
        hook_size: "#14",
        thread: "8/0 black",
        difficulty: "beginner",
        fly_type_id: flyType?.id as string,
        fly_subcategory_id: subcategory?.id as string,
      } as never)
      .select("id");

    // The write must NOT succeed for an unconfirmed user.
    expect(insertError).not.toBeNull();
    expect(inserted ?? []).toHaveLength(0);

    // Belt-and-suspenders: confirm no row landed for this author.
    const { data: rows } = await supabase
      .from("flies")
      .select("id")
      .eq("author_id", userId as string);
    expect(rows ?? []).toHaveLength(0);
  });

  afterAll(async () => {
    // Best-effort sign-out; the throwaway unconfirmed user cannot be deleted
    // with the anon key (requires the service-role key / admin API) — document
    // that manual cleanup of rls-test+* users may be needed on the project.
    if (supabase) {
      await supabase.auth.signOut();
    }
    void createdUserId;
  });
});
