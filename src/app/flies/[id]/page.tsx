import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type FlyDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
};

// Shape of the joined query (typed locally — the nested embed inference from the
// hand-authored Database types is cast through unknown for clarity).
type FlyDetail = {
  id: string;
  name: string;
  description: string | null;
  hook_size: string;
  thread: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  primary_photo_id: string | null;
  created_at: string;
  fly_type: { name: string } | null;
  fly_subcategory: { name: string } | null;
  fly_materials: {
    position: number;
    label: string;
    material: string;
    color: string | null;
  }[];
  fly_photos: { id: string; storage_path: string; position: number }[];
  fly_fish_types: { fish_types: { id: string; name: string } | null }[];
};

const FLY_SELECT = `
  id, name, description, hook_size, thread, difficulty, primary_photo_id, created_at,
  fly_type:fly_types ( name ),
  fly_subcategory:fly_subcategories ( name ),
  fly_materials ( position, label, material, color ),
  fly_photos ( id, storage_path, position ),
  fly_fish_types ( fish_types ( id, name ) )
`;

/**
 * /flies/[id] — author-visible fly detail page (D-02 "see it exist" payoff).
 *
 * Server Component: fetches the fly + photos + materials + fish + taxonomy names
 * and renders everything the author entered. The description is rendered as plain
 * text (React auto-escapes — raw HTML injection is never used; stored-XSS
 * mitigation T-04-05). Photos are served via the public bucket's getPublicUrl.
 * Rating is a
 * read-only stub ("No ratings yet") — RATE-* is Phase 3.
 */
export default async function FlyDetailPage({
  params,
  searchParams,
}: FlyDetailPageProps) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("flies")
    .select(FLY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const fly = data as unknown as FlyDetail;

  const publicUrl = (path: string) =>
    supabase.storage.from("fly-photos").getPublicUrl(path).data.publicUrl;

  // Primary/cover photo first, then the rest by position.
  const photos = [...fly.fly_photos].sort((a, b) => {
    if (a.id === fly.primary_photo_id) return -1;
    if (b.id === fly.primary_photo_id) return 1;
    return a.position - b.position;
  });
  const materials = [...fly.fly_materials].sort(
    (a, b) => a.position - b.position,
  );
  const fishNames = fly.fly_fish_types
    .map((row) => row.fish_types?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      {submitted ? (
        <Alert className="mb-6">
          <AlertTitle>Your fly is live.</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Everyone can now see the fly you just submitted.</span>
            <Link
              href={`/flies/${fly.id}`}
              className="text-sm underline underline-offset-4"
            >
              Dismiss
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <h1 className="mb-4 text-3xl font-semibold tracking-tight">{fly.name}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {fly.fly_type ? <Badge>{fly.fly_type.name}</Badge> : null}
        {fly.fly_subcategory ? (
          <Badge variant="secondary">{fly.fly_subcategory.name}</Badge>
        ) : null}
        <Badge variant="outline" className="capitalize">
          {fly.difficulty}
        </Badge>
        {fishNames.map((name) => (
          <Badge key={name} variant="outline">
            {name}
          </Badge>
        ))}
      </div>

      {/* Photo gallery: cover large, remaining in a grid */}
      {photos.length > 0 ? (
        <div className="mb-8 flex flex-col gap-3">
          <div className="bg-muted aspect-video w-full overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={publicUrl(photos[0].storage_path)}
              alt={`${fly.name} — cover photo`}
              className="h-full w-full object-cover"
            />
          </div>
          {photos.length > 1 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {photos.slice(1).map((photo) => (
                <div
                  key={photo.id}
                  className="bg-muted aspect-square overflow-hidden rounded-md border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrl(photo.storage_path)}
                    alt={`${fly.name} photo`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Read-only rating stub (Phase 3 delivers real ratings) */}
      <div className="text-muted-foreground mb-8 flex items-center gap-2">
        <div className="flex" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-5" />
          ))}
        </div>
        <span className="text-sm">No ratings yet</span>
      </div>

      {/* Recipe */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">Recipe</h2>
        <dl className="divide-border divide-y rounded-lg border">
          <div className="flex gap-4 px-4 py-3">
            <dt className="w-28 shrink-0 font-semibold">Hook size</dt>
            <dd>{fly.hook_size}</dd>
          </div>
          <div className="flex gap-4 px-4 py-3">
            <dt className="w-28 shrink-0 font-semibold">Thread</dt>
            <dd>{fly.thread}</dd>
          </div>
          {materials.map((m, index) => (
            <div key={index} className="flex gap-4 px-4 py-3">
              <dt className="w-28 shrink-0 font-semibold">{m.label}</dt>
              <dd>
                {m.material}
                {m.color ? (
                  <span className="text-muted-foreground"> — {m.color}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Description */}
      {fly.description ? (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">Description</h2>
          <p className="leading-7 whitespace-pre-wrap">{fly.description}</p>
        </section>
      ) : null}
    </main>
  );
}
