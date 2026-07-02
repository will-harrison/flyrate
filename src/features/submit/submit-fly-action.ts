"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { submitFlySchema } from "./submit-fly-schema";

/**
 * Server Action: insert a submitted fly + its children, then redirect the author
 * to /flies/[id] (D-02 "see it exist" payoff).
 *
 * SECURITY MODEL:
 *   - This action RE-PARSES the full payload with `submitFlySchema` server-side
 *     (T-04-06 — the client zod validation is UX only; this is the input boundary).
 *   - The ACTUAL authorization boundary is the RLS `WITH CHECK` in migration 0005:
 *     the flies-insert policy requires `(select auth.uid()) = author_id AND
 *     public.is_email_confirmed()`. An unconfirmed or non-owner insert is rejected
 *     by the DB here even though this action ran — the action is a convenience +
 *     validation layer, not the gate.
 *   - `flyId` is generated client-side so photos can be uploaded under the
 *     {userId}/{flyId}/{uuid} path prefix BEFORE the row exists; we insert the
 *     flies row with that explicit id so paths and row agree.
 */

// flyId travels alongside the schema fields (the photos were uploaded under it).
const actionInputSchema = z.object({ flyId: z.string().uuid() });

export type SubmitFlyActionResult = { error: string };

export async function submitFlyAction(
  input: unknown,
): Promise<SubmitFlyActionResult> {
  const idParse = actionInputSchema.safeParse(input);
  const parse = submitFlySchema.safeParse(input);

  if (!idParse.success || !parse.success) {
    return { error: "Some fields need attention before you can submit." };
  }

  const { flyId } = idParse.data;
  const v = parse.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?next=/flies/new");
  }

  // 1. Insert the fly. RLS enforces owner + email-confirmed (AUTH-02 DB gate).
  const { error: flyError } = await supabase.from("flies").insert({
    id: flyId,
    author_id: user.id,
    name: v.name,
    description: v.description ?? null,
    hook_size: v.hookSize,
    thread: v.thread,
    difficulty: v.difficulty,
    fly_type_id: v.flyTypeId,
    fly_subcategory_id: v.flySubcategoryId,
  });

  if (flyError) {
    // Most likely cause: RLS rejected an unconfirmed/non-owner insert.
    return {
      error:
        "We couldn't save your fly. Confirm your email address, then try again.",
    };
  }

  // 2. Ordered material rows (SUB-02) — position = array index.
  if (v.materials.length > 0) {
    const { error: materialsError } = await supabase
      .from("fly_materials")
      .insert(
        v.materials.map((m, index) => ({
          fly_id: flyId,
          position: index,
          label: m.label,
          material: m.material,
          color: m.color ?? null,
        })),
      );
    if (materialsError) {
      return { error: "We couldn't save the recipe. Please try again." };
    }
  }

  // 3. Target fish junction rows (SUB-06).
  const { error: fishError } = await supabase.from("fly_fish_types").insert(
    v.fishTypeIds.map((fishTypeId) => ({
      fly_id: flyId,
      fish_type_id: fishTypeId,
    })),
  );
  if (fishError) {
    return { error: "We couldn't save the target fish. Please try again." };
  }

  // 4. Photos (D-04) — position = index; the chosen cover is at primaryPhotoIndex.
  const { data: photoRows, error: photosError } = await supabase
    .from("fly_photos")
    .insert(
      v.photoPaths.map((storagePath, index) => ({
        fly_id: flyId,
        storage_path: storagePath,
        position: index,
      })),
    )
    .select("id, position");
  if (photosError || !photoRows) {
    return { error: "We couldn't save the photos. Please try again." };
  }

  // 5. Set the user-chosen cover (primary_photo_id) from the matching position.
  const cover = photoRows.find((p) => p.position === v.primaryPhotoIndex);
  if (cover) {
    const { error: coverError } = await supabase
      .from("flies")
      .update({ primary_photo_id: cover.id })
      .eq("id", flyId);
    if (coverError) {
      return { error: "We couldn't set the cover photo. Please try again." };
    }
  }

  // 6. Payoff: land the author on the fly's own detail page (D-02).
  redirect(`/flies/${flyId}?submitted=1`);
}
