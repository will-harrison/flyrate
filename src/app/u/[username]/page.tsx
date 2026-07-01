import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type ProfilePageProps = {
  params: Promise<{ username: string }>;
};

/**
 * Public profile page (PROF-01). Server Component: fetches the profiles row by
 * username via the server Supabase client and renders it. This is the "read"
 * half of the walking-skeleton loop — signup writes a profile row (via the
 * handle_new_user trigger) and this page reads it back server-side.
 *
 * Navigating here also exercises middleware token refresh (this route is matched
 * by the middleware matcher), which is what makes the AUTH-05 refresh check
 * meaningful when performed on this page.
 */
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, bio, created_at")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {profile.username}
        </h1>
        {profile.bio ? (
          <p className="text-muted-foreground leading-7">{profile.bio}</p>
        ) : (
          <p className="text-muted-foreground text-sm">No bio yet.</p>
        )}
      </div>
    </main>
  );
}
