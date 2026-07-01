import Link from "next/link";

import { SignUpForm } from "@/features/auth/sign-up-form";
import { OAuthButtons } from "@/features/auth/oauth-buttons";
import { Separator } from "@/components/ui/separator";

/**
 * Sign-up page. Hosts Plan 02's email/password SignUpForm plus the OAuth buttons
 * (Google/GitHub) separated by an "or" label — the same three account-creation
 * methods offered at sign-in. The SignUpForm renders its own Card; the OAuth
 * block sits beneath it.
 */
export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <SignUpForm />
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs uppercase">or</span>
        <Separator className="flex-1" />
      </div>
      <OAuthButtons />
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="text-foreground font-medium underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
