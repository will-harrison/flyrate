-- Migration 0006 — fly-photos Storage bucket + storage.objects RLS
--
-- Delivers the photo-storage half of SUB-01/SUB-07/D-04:
--   * a PUBLIC bucket 'fly-photos' (public read = cheap CDN GET for the catalog;
--     no signed URLs needed — the app stores the object path and serves via
--     getPublicUrl, per CLAUDE.md Image handling).
--   * owner-prefix write RLS on storage.objects: a user may only write objects
--     whose first path segment equals their own uid — the path convention is
--     {user_id}/{fly_id}/{uuid}.webp (CLAUDE.md), so (storage.foldername(name))[1]
--     is the uploader's uid. This blocks T-04-03 (uploading under another user's
--     prefix).
--   * every auth.uid() wrapped as (select auth.uid()) (RLS perf).

-- ---------------------------------------------------------------------------
-- Bucket: fly-photos (public). Idempotent on re-push.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fly-photos', 'fly-photos', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- storage.objects RLS. RLS is already enabled on storage.objects by Supabase;
-- we only add policies scoped to this bucket.
-- ---------------------------------------------------------------------------

-- Public read of any object in the bucket (photo catalog).
create policy "fly photos public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'fly-photos');

-- Owner-prefix insert: first folder segment must equal the caller's uid.
create policy "fly photos owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fly-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Owner-prefix update (e.g. re-upload/replace under own prefix).
create policy "fly photos owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fly-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'fly-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Owner-prefix delete (remove own photos).
create policy "fly photos owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fly-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
