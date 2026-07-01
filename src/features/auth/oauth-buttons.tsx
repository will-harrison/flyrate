"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * OAuth sign-in buttons for Google (AUTH-03) and GitHub (AUTH-04).
 *
 * Rendered as neutral shadcn `outline` buttons (never accent-colored) per the
 * UI-SPEC — the accent teal is reserved for the primary email/password CTA.
 * lucide-react has no brand icons, so the Google/GitHub glyphs are inline
 * monochrome SVGs.
 *
 * signInWithOAuth redirects to `${origin}/auth/callback`, where the code is
 * exchanged for a session server-side (see src/app/auth/callback/route.ts).
 * The `next` param rides through so the callback can return the user to their
 * intended destination (validated by safeNext there).
 */
export function OAuthButtons({ next }: { next?: string }) {
  const [pending, setPending] = useState<"google" | "github" | null>(null);

  async function signIn(provider: "google" | "github") {
    setPending(provider);
    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    });

    // On success the browser is redirected to the provider, so we never reach
    // here; only an immediate client error leaves us on the page.
    if (error) setPending(null);
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => signIn("google")}
        disabled={pending !== null}
      >
        <GoogleGlyph />
        {pending === "google" ? "Redirecting…" : "Continue with Google"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => signIn("github")}
        disabled={pending !== null}
      >
        <GitHubGlyph />
        {pending === "github" ? "Redirecting…" : "Continue with GitHub"}
      </Button>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      role="img"
    >
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.07-1.47-.22-2.12H12v3.86h6.35c-.13 1.06-.82 2.66-2.36 3.73l-.02.14 3.43 2.66.24.02c2.18-2.01 3.42-4.97 3.42-8.29Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.12 0 5.73-1.03 7.64-2.8l-3.64-2.82c-.98.68-2.28 1.15-4 1.15-3.05 0-5.64-2.01-6.56-4.79l-.14.01-3.56 2.76-.05.13C3.6 21.3 7.5 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.44 14.74A7.4 7.4 0 0 1 5.04 12c0-.96.17-1.88.4-2.74l-.01-.18-3.6-2.8-.12.06A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.41l4.16-3.23Z"
      />
      <path
        fill="#EB4335"
        d="M12 4.75c2.16 0 3.62.93 4.45 1.71l3.25-3.17C17.72 1.19 15.12 0 12 0 7.5 0 3.6 2.7 1.28 6.59l4.15 3.23C6.36 6.76 8.95 4.75 12 4.75Z"
      />
    </svg>
  );
}

function GitHubGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="currentColor"
      role="img"
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58l-.01-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22l-.01 3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}
