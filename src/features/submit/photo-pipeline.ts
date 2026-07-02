"use client";

import imageCompression from "browser-image-compression";

import { createClient } from "@/lib/supabase/client";

/**
 * Client-side photo pipeline (SUB-07 + SUB-01, 01-RESEARCH Pattern 8).
 *
 * prepareForUpload: compress + resize + strip EXIF/GPS, re-encoding to webp.
 *   `browser-image-compression`'s canvas re-encode drops EXIF (including GPS)
 *   because `preserveExif` DEFAULTS to false — we deliberately never set it true
 *   (that would re-introduce the GPS-leak, T-04-04 / SUB-07). The library reads
 *   and applies EXIF orientation before re-encoding, so portrait phone photos are
 *   not left sideways after the tag is discarded (01-RESEARCH A4 caveat — verify
 *   with a real portrait photo at the Task 6 human-verify).
 *
 * uploadPhoto: builds the owner-prefixed path {userId}/{flyId}/{uuid}.webp
 *   (CLAUDE.md Image handling) and uploads via the browser client. The storage
 *   RLS in migration 0006 only permits writes whose first path segment equals the
 *   caller's uid — so the path convention is also the security boundary (T-04-03).
 */
export const PHOTO_BUCKET = "fly-photos";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: "image/webp",
  // preserveExif intentionally OMITTED — it defaults to false, which is the
  // SUB-07 EXIF/GPS-strip mechanism. Do NOT set it true.
} as const;

export async function prepareForUpload(file: File): Promise<File> {
  return imageCompression(file, COMPRESSION_OPTIONS);
}

/**
 * Compress+strip a single file and upload it under the user's own prefix.
 * Returns the stored Storage object path (persisted in fly_photos.storage_path).
 */
export async function uploadPhoto(
  userId: string,
  flyId: string,
  file: File,
): Promise<string> {
  const compressed = await prepareForUpload(file);
  const path = `${userId}/${flyId}/${crypto.randomUUID()}.webp`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, compressed, { contentType: "image/webp" });

  if (error) {
    throw error;
  }

  return path;
}
