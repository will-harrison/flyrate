import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

/**
 * Auth error landing page. Both /auth/callback (OAuth) and /auth/confirm (email)
 * redirect here when the code exchange / OTP verification fails or the link is
 * invalid or expired. Uses the destructive Alert per the UI-SPEC.
 */
export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <Alert variant="destructive">
        <AlertTitle>That link expired — request a new one</AlertTitle>
        <AlertDescription>
          We couldn&apos;t complete sign-in. The link may have expired or already
          been used. Try signing in again to get a fresh one.
        </AlertDescription>
      </Alert>
      <Button asChild className="w-full">
        <Link href="/auth/sign-in">Back to sign in</Link>
      </Button>
    </main>
  );
}
