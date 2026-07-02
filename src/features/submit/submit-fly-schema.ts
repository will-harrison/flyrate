import { z } from "zod";

/**
 * Shared submit-fly validation (01-RESEARCH Pattern 7).
 *
 * Two schemas, one source of truth:
 *   - `submitFlyFormSchema` — the recipe/taxonomy/difficulty FIELDS the client
 *     react-hook-form owns. Photos are NOT here: the form keeps File objects in
 *     component state and only turns them into uploaded Storage paths at submit
 *     time, so `photoPaths`/`primaryPhotoIndex` don't exist until after upload.
 *   - `submitFlySchema` — the FULL payload (fields + photoPaths + primaryPhotoIndex)
 *     re-parsed inside submit-fly-action.ts before any DB write. This is the real
 *     input-validation boundary — never trust the client (T-04-06). The RLS
 *     `WITH CHECK` in migration 0005 is the AUTHORIZATION boundary.
 *
 * Photo cap = 6 (D-04, Claude's discretion finalised at 6).
 */
export const MAX_PHOTOS = 6;

const submitFlyCore = z.object({
  name: z.string().min(1, "Give your fly a name.").max(120),
  description: z.string().max(2000).optional(),
  // Free text, not a numeric range — e.g. "#12-16" (01-RESEARCH Pattern 7).
  hookSize: z.string().min(1, "Add a hook size.").max(20),
  thread: z.string().min(1, "Add a thread.").max(60),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  flyTypeId: z.string().uuid("Choose a fly type."),
  flySubcategoryId: z.string().uuid("Choose a subcategory."),
  fishTypeIds: z
    .array(z.string().uuid())
    .min(1, "Select at least one target fish."),
  materials: z
    .array(
      z.object({
        label: z.string().min(1, "Add a label.").max(40),
        material: z.string().min(1, "Add a material.").max(120),
        color: z.string().max(60).optional(),
      }),
    )
    .min(1, "List at least one material."),
});

/** Client form fields (photos handled in component state, not here). */
export const submitFlyFormSchema = submitFlyCore;
export type SubmitFlyFormValues = z.infer<typeof submitFlyFormSchema>;

/** Full payload validated server-side in the Server Action. */
export const submitFlySchema = submitFlyCore
  .extend({
    // Already-uploaded Storage object paths ({userId}/{flyId}/{uuid}.webp).
    photoPaths: z
      .array(z.string().min(1))
      .min(1, "Add at least one photo.")
      .max(MAX_PHOTOS, `Up to ${MAX_PHOTOS} photos.`),
    // User-chosen cover (index into photoPaths).
    primaryPhotoIndex: z.number().int().min(0),
  })
  .refine((v) => v.primaryPhotoIndex < v.photoPaths.length, {
    message: "The chosen cover photo is out of range.",
    path: ["primaryPhotoIndex"],
  });

export type SubmitFlyInput = z.infer<typeof submitFlySchema>;
