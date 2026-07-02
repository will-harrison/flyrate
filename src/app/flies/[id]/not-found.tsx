import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Not-found state for /flies/[id] — rendered when notFound() is called because
 * the id does not resolve to a fly.
 */
export default function FlyNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Fly not found</h1>
      <p className="text-muted-foreground">
        We couldn&apos;t find that fly. It may have been removed, or the link is
        wrong.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
