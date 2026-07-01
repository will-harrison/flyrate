import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Supabase client for use in Client Components only.
 *
 * Reads the public anon key (NEVER the service-role key). RLS is the real
 * authorization boundary — the anon key is public by design and ships in the
 * browser bundle.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
