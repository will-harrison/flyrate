import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchTaxonomy } from "@/features/submit/taxonomy";
import { SubmitFlyForm } from "@/features/submit/submit-fly-form";

/**
 * /flies/new — submit form shell (Server Component).
 *
 * 1. Redirects unauthenticated users to sign in (with next back here).
 * 2. Fetches the seeded taxonomy server-side (TAX-01 — options come only from
 *    the lookup tables) and passes it to the client form.
 * 3. Passes the user's id/email + email-confirmed flag so the client can build
 *    owner-prefixed upload paths and show the unconfirmed-email belt (RLS is the
 *    real gate).
 */
export default async function NewFlyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?next=/flies/new");
  }

  const taxonomy = await fetchTaxonomy();
  const emailConfirmed = Boolean(user.email_confirmed_at);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <SubmitFlyForm
        taxonomy={taxonomy}
        userId={user.id}
        userEmail={user.email ?? null}
        emailConfirmed={emailConfirmed}
      />
    </main>
  );
}
