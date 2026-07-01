import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

/**
 * Refreshes the Supabase session token on every matched request and rewrites
 * the session cookie onto both the request and the response.
 *
 * This is what makes AUTH-05 (session survives refresh) work — without it,
 * access tokens expire (~1hr) and users are silently logged out.
 *
 * CRITICAL: do not run any code between createServerClient(...) and
 * supabase.auth.getUser() — it causes hard-to-debug session refresh bugs.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do NOT insert any code between createServerClient above and
  // getUser() below. Doing so can cause intermittent session-refresh failures.
  await supabase.auth.getUser();

  return supabaseResponse;
}
