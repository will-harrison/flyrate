"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Sign-out control for the header user-menu (AUTH-06). Calls signOut() on the
 * shared browser client so it works from any page, then routes home and
 * refreshes so the server-rendered header re-renders in its signed-out state.
 *
 * Rendered as a full-width menu item inside the header DropdownMenu.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={pending}
      className="w-full justify-start"
    >
      {pending ? "Signing out…" : "Sign Out"}
    </Button>
  );
}
