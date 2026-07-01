import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/features/auth/sign-out-button";

/**
 * Server-rendered site header. Reads the session server-side (via the server
 * Supabase client's getUser()) and, when signed in, shows the user's derived
 * username linking to their public profile plus a Sign Out control (AUTH-06).
 * Signed-out visitors see nothing but the wordmark — the home page carries the
 * sign-up entry.
 */
export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    username = profile?.username ?? null;
  }

  return (
    <header className="bg-secondary/40 border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Flyrate
        </Link>
        {user ? (
          <nav className="flex items-center gap-2">
            {username ? (
              <Link
                href={`/u/${username}`}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                {username}
              </Link>
            ) : null}
            <SignOutButton />
          </nav>
        ) : null}
      </div>
    </header>
  );
}
