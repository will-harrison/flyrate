import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * Reads/writes the session cookie via next/headers. The setAll try/catch is
 * required: Server Components cannot write cookies, so setAll is a no-op there
 * and middleware.ts performs the actual token refresh (see Pattern 1).
 *
 * Reads only the public anon key — never a service-role key.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll was called from a Server Component — safe to ignore.
            // middleware.ts refreshes the session cookie instead.
          }
        },
      },
    },
  );
}
