"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, Plus, Star, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SelectNative } from "@/components/ui/select-native";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  MAX_PHOTOS,
  submitFlyFormSchema,
  type SubmitFlyFormValues,
} from "./submit-fly-schema";
import { submitFlyAction } from "./submit-fly-action";
import { uploadPhoto } from "./photo-pipeline";
import type { TaxonomyOptions } from "./taxonomy";

type SubmitFlyFormProps = {
  taxonomy: TaxonomyOptions;
  userId: string;
  userEmail: string | null;
  emailConfirmed: boolean;
};

const DIFFICULTIES = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

/**
 * Single-scroll fly-submission form (D-01) — one Card per section: Photos,
 * Recipe, Taxonomy, Difficulty, Description. react-hook-form owns the non-photo
 * fields; photos are held as File objects in component state and only compressed,
 * EXIF-stripped and uploaded (photo-pipeline) at submit time. The Server Action
 * then re-validates the full payload and inserts. RLS is the real gate.
 */
export function SubmitFlyForm({
  taxonomy,
  userId,
  userEmail,
  emailConfirmed,
}: SubmitFlyFormProps) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const form = useForm<SubmitFlyFormValues>({
    resolver: zodResolver(submitFlyFormSchema),
    defaultValues: {
      name: "",
      description: "",
      hookSize: "",
      thread: "",
      flyTypeId: "",
      flySubcategoryId: "",
      fishTypeIds: [],
      materials: [{ label: "", material: "", color: "" }],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "materials",
  });

  const selectedFlyTypeId = form.watch("flyTypeId");
  const subcategoryOptions = selectedFlyTypeId
    ? (taxonomy.subcategoriesByFlyType[selectedFlyTypeId] ?? [])
    : [];

  // Object-URL previews for the picked files; revoke on change to avoid leaks.
  const previews = useMemo(
    () => photos.map((file) => URL.createObjectURL(file)),
    [photos],
  );
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;
    setPhotoError(null);
    setPhotos((prev) => {
      const next = [...prev, ...picked].slice(0, MAX_PHOTOS);
      return next;
    });
    // Reset the input so the same file can be re-picked after removal.
    event.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPrimaryIndex((prev) => {
      if (index === prev) return 0;
      return index < prev ? prev - 1 : prev;
    });
  }

  async function resendConfirmation() {
    if (!userEmail) return;
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email: userEmail });
    setResent(true);
  }

  async function onValid(values: SubmitFlyFormValues) {
    setSubmitError(null);
    setPhotoError(null);

    if (photos.length === 0) {
      setPhotoError("Add at least one photo.");
      return;
    }

    const flyId = crypto.randomUUID();

    const photoPaths: string[] = [];
    try {
      for (const file of photos) {
        photoPaths.push(await uploadPhoto(userId, flyId, file));
      }
    } catch {
      setSubmitError(
        "That photo didn't upload — check your connection and try again.",
      );
      return;
    }

    const result = await submitFlyAction({
      flyId,
      ...values,
      photoPaths,
      primaryPhotoIndex: Math.min(primaryIndex, photoPaths.length - 1),
    });

    // On success the action redirects (throws) and this line is never reached.
    if (result?.error) {
      setSubmitError(result.error);
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onValid)}
        className="flex flex-col gap-8"
        noValidate
      >
        {!emailConfirmed ? (
          <Alert>
            <AlertTitle>Confirm your email to submit a fly.</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>
                We sent you a confirmation link. Confirm your email, then reload
                this page to submit.
              </span>
              {resent ? (
                <span className="text-muted-foreground text-sm">
                  Confirmation email sent.
                </span>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={resendConfirmation}
                >
                  Resend confirmation email
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>
              Some fields need attention before you can submit.
            </AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        {/* ---- Name ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Submit a fly</CardTitle>
            <CardDescription>
              Catalog a fly you tied and let the community rate it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fly name</FormLabel>
                  <FormControl>
                    <Input placeholder="Parachute Adams" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ---- Photos ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Photos</CardTitle>
            <CardDescription>
              Upload at least one photo of your fly. JPG or PNG, up to{" "}
              {MAX_PHOTOS} photos — the first one you choose becomes the cover.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {photos.length === 0 ? (
              <div className="border-input text-muted-foreground flex flex-col items-center gap-1 rounded-md border border-dashed p-6 text-center">
                <p className="text-foreground font-semibold">
                  Add your first photo
                </p>
                <p className="text-sm">
                  Upload at least one photo of your fly.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {previews.map((url, index) => (
                  <div
                    key={url}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-md border",
                      index === primaryIndex && "ring-primary ring-2",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Fly photo ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    {index === primaryIndex ? (
                      <Badge className="absolute top-1 left-1 gap-1">
                        <Star className="size-3" /> Cover
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPrimaryIndex(index)}
                        className="bg-background/80 text-foreground absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-xs"
                      >
                        Set cover
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => removePhoto(index)}
                      className="bg-destructive absolute top-1 right-1 flex size-6 items-center justify-center rounded-full text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < MAX_PHOTOS ? (
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                You&apos;ve reached the {MAX_PHOTOS}-photo limit.
              </p>
            )}
            {photoError ? (
              <p className="text-destructive text-sm">{photoError}</p>
            ) : null}
          </CardContent>
        </Card>

        {/* ---- Recipe ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Recipe</CardTitle>
            <CardDescription>
              List what you tied this fly with, in order — e.g. Tail, Body,
              Hackle, Wing.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="hookSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hook size</FormLabel>
                    <FormControl>
                      <Input placeholder="#12–16" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="thread"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thread</FormLabel>
                    <FormControl>
                      <Input placeholder="8/0 olive" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3">
              <FormLabel>Materials</FormLabel>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="border-input flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start"
                >
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    <Input
                      placeholder="Label (Tail)"
                      aria-label={`Material ${index + 1} label`}
                      {...form.register(`materials.${index}.label`)}
                    />
                    <Input
                      placeholder="Material (Pheasant tail)"
                      aria-label={`Material ${index + 1} material`}
                      {...form.register(`materials.${index}.material`)}
                    />
                    <Input
                      placeholder="Color (optional)"
                      aria-label={`Material ${index + 1} color`}
                      {...form.register(`materials.${index}.color`)}
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move material up"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move material down"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove material row"
                      className="text-destructive"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => append({ label: "", material: "", color: "" })}
              >
                <Plus className="size-4" /> Add material
              </Button>
              {form.formState.errors.materials?.message ? (
                <p className="text-destructive text-sm">
                  {form.formState.errors.materials.message}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* ---- Taxonomy ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Taxonomy</CardTitle>
            <CardDescription>
              Choose the fly type, subcategory, and the fish it targets.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="flyTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fly type</FormLabel>
                    <FormControl>
                      <SelectNative
                        value={field.value}
                        onChange={(e) => {
                          field.onChange(e);
                          form.setValue("flySubcategoryId", "");
                        }}
                      >
                        <option value="" disabled>
                          Select a fly type
                        </option>
                        {taxonomy.flyTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </SelectNative>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="flySubcategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory</FormLabel>
                    <FormControl>
                      <SelectNative
                        value={field.value}
                        onChange={field.onChange}
                        disabled={!selectedFlyTypeId}
                      >
                        <option value="" disabled>
                          {selectedFlyTypeId
                            ? "Select a subcategory"
                            : "Choose a fly type first"}
                        </option>
                        {subcategoryOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </SelectNative>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="fishTypeIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target fish</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {taxonomy.fishTypes.map((fish) => {
                        const selected = field.value.includes(fish.id);
                        return (
                          <button
                            key={fish.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              field.onChange(
                                selected
                                  ? field.value.filter(
                                      (id: string) => id !== fish.id,
                                    )
                                  : [...field.value, fish.id],
                              )
                            }
                            className={cn(
                              "rounded-md border px-3 py-1.5 text-sm transition-colors",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input hover:bg-accent",
                            )}
                          >
                            {fish.name}
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ---- Difficulty ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Difficulty</CardTitle>
            <CardDescription>How hard is this fly to tie?</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div
                      role="radiogroup"
                      aria-label="Difficulty"
                      className="flex flex-wrap gap-2"
                    >
                      {DIFFICULTIES.map((d) => {
                        const selected = field.value === d.value;
                        return (
                          <label
                            key={d.value}
                            className={cn(
                              "cursor-pointer rounded-md border px-4 py-2 text-sm transition-colors",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input hover:bg-accent",
                            )}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              name={field.name}
                              value={d.value}
                              checked={selected}
                              onBlur={field.onBlur}
                              onChange={() => field.onChange(d.value)}
                            />
                            {d.label}
                          </label>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ---- Description ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Description</CardTitle>
            <CardDescription>
              Anything about how it fishes, when to use it, or how you tie it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Fish it in the film during a mayfly hatch…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="bg-background/80 sticky bottom-0 flex justify-end border-t py-4 backdrop-blur">
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || !emailConfirmed}
          >
            {isSubmitting ? "Submitting…" : "Submit Fly"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
