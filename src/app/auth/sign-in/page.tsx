import Link from "next/link";

import { OAuthButtons } from "@/features/auth/oauth-buttons";
import { SignInForm } from "@/features/auth/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/**
 * Sign-in page. Hosts the email/password form and the OAuth buttons
 * (Google/GitHub) separated by an "or" label.
 *
 * A `next` search param (same-origin, validated by safeNext) is forwarded into
 * both flows so the user returns to their intended page after signing in.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Sign in to submit flies and rate the community&apos;s patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <SignInForm next={next} />
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs uppercase">or</span>
            <Separator className="flex-1" />
          </div>
          <OAuthButtons next={next} />
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/auth/sign-up" className="text-foreground font-medium underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
