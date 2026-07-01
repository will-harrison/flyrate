import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/features/auth/redirect";

/**
 * OAuth callback (Google / GitHub — AUTH-03 / AUTH-04).
 *
 * The provider redirects here with a `code` (and the `next` we forwarded via
 * signInWithOAuth's redirectTo). We exchange the code for a session server-side
 * — the exchange runs against the server client so the refreshed session cookie
 * is written via set-cookie — then redirect to the user's intended destination.
 *
 * The destination is passed through safeNext() so a client-supplied `next` can
 * never redirect an authenticated user to a foreign origin (threat T-03-01).
 *
 * This route is DISTINCT from /auth/confirm: OAuth exchanges a PKCE `code`;
 * email confirmation verifies a `token_hash` via verifyOtp. Conflating them
 * breaks one of the two flows.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
