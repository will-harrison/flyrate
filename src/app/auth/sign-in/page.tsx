import Link from "next/link";

import { OAuthButtons } from "@/features/auth/oauth-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Sign-in page. Task 1 ships the OAuth buttons (Google/GitHub). The email/
 * password form + "or" Separator are added in Task 2.
 *
 * A `next` search param (same-origin, validated downstream by safeNext) is
 * forwarded into the OAuth flow so the user returns to their intended page
 * after signing in.
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
        <CardContent className="grid gap-4">
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
