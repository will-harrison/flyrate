import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/features/auth/user-menu";
import { Button } from "@/components/ui/button";

/**
 * Server-rendered site header. Reads the session server-side (via the server
 * Supabase client's getUser()) and, when signed in, shows the user-menu Avatar
 * (profile link + Sign Out) on every page (AUTH-06). Signed-out visitors get
 * Sign In / Create Account links instead.
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
        {user && username ? (
          <nav className="flex items-center gap-2">
            <UserMenu username={username} />
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Create Account</Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
