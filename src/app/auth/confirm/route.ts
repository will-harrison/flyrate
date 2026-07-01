import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/features/auth/redirect";

/**
 * Email confirmation (AUTH-02).
 *
 * Email/password signups send a token-hash link (NOT a PKCE code) — configure
 * the Supabase email template's confirmation link as
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (a manual
 * dashboard step). We verify it with verifyOtp, which BOTH confirms the email
 * AND establishes a session in the same response.
 *
 * Pitfall 5: verifyOtp signs the user in — so on success we redirect straight to
 * their intended destination, never back to a sign-in prompt. The destination
 * is passed through safeNext() so a client-supplied `next` cannot redirect the
 * now-authenticated user to a foreign origin (threat T-03-01).
 *
 * DISTINCT from /auth/callback: that route exchanges an OAuth `code`; this route
 * verifies an email `token_hash`. Conflating them breaks one of the two flows.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
