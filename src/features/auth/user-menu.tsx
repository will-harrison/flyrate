"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { SignOutButton } from "@/features/auth/sign-out-button";

/**
 * Header user-menu (AUTH-06). An Avatar (user initials) that opens a dropdown
 * containing the profile link and the Sign Out control. Present on every
 * authenticated page via SiteHeader.
 *
 * Built on native <details>/<summary> for keyboard + screen-reader
 * accessibility without pulling @radix-ui/react-dropdown-menu into this plan
 * (threat T-03-SC: no new package installs). A click-outside listener closes the
 * menu, matching the interaction of a Radix DropdownMenu.
 */
export function UserMenu({ username }: { username: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const initials = username.slice(0, 2).toUpperCase();

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      const el = detailsRef.current;
      if (el && el.open && !el.contains(event.target as Node)) {
        el.open = false;
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <details ref={detailsRef} className="relative">
      <summary
        aria-label="Open user menu"
        className="border-border bg-secondary text-secondary-foreground flex size-9 cursor-pointer list-none items-center justify-center rounded-full border text-sm font-medium select-none [&::-webkit-details-marker]:hidden"
      >
        {initials}
      </summary>
      <div className="bg-popover text-popover-foreground absolute right-0 z-50 mt-2 w-48 rounded-md border p-1 shadow-md">
        <Link
          href={`/u/${username}`}
          onClick={close}
          className="hover:bg-accent hover:text-accent-foreground block rounded-sm px-2 py-1.5 text-sm"
        >
          Your profile
        </Link>
        <div className="bg-border my-1 h-px" role="none" />
        <SignOutButton />
      </div>
    </details>
  );
}
