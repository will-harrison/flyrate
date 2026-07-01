import { SignUpForm } from "@/features/auth/sign-up-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-10 px-4 py-16">
      <section className="flex max-w-2xl flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Flyrate</h1>
        <p className="text-muted-foreground text-base leading-7">
          Submit the flies you tie, rate the community&apos;s patterns, and
          discover the best flies for what you want to fish.
        </p>
      </section>
      <SignUpForm />
    </main>
  );
}
