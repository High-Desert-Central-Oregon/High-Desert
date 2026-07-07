-- ============================================================================
-- Migration 0016 — verification-evidence Storage bucket + its two RLS policies
-- ----------------------------------------------------------------------------
-- Promotes the "create the bucket by hand in the dashboard" step (previously only
-- documented in schema.sql's NOTES) into reviewable, reproducible SQL. This closes
-- pre-launch audit finding A-DB-1: the private evidence bucket and its policies
-- were the ONE verify-then-forget guarantee not enforced by SQL — a bucket created
-- public, or without the moderators-only read policy, would leak verification
-- evidence. Scripting it removes that manual-mistake vector.
--
-- SUPABASE-ONLY: requires the `storage` schema (storage.buckets / storage.objects),
-- so this is NOT part of the plain-`psql -f schema.sql` path (same reason pg_cron
-- scheduling stays a deploy step). Apply it against the Supabase-backed project
-- AFTER schema.sql — in the SQL editor as the project owner, or via `supabase db
-- push`. Idempotent and safe to re-run: re-running FORCES the bucket back to
-- private and re-asserts both policies.
--
-- Pairs with: the app never grants a member/moderator DELETE on this bucket —
-- eviction is the service-role `decideVerification` action (delete-before-commit);
-- the trg_purge_evidence trigger nulls the pointer. See lib/verification.ts (the
-- size/MIME limits below mirror MAX_EVIDENCE_BYTES + ALLOWED_EVIDENCE_TYPES) and
-- lib/supabase/admin.ts.
-- ============================================================================

-- Private bucket. `on conflict … set public = false` is deliberate: re-running
-- this migration repairs a bucket that was ever accidentally created public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-evidence',
  'verification-evidence',
  false,
  10485760,  -- 10 MB, mirrors lib/verification.ts MAX_EVIDENCE_BYTES
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Upload: a member may write only inside their own `<uid>/…` folder. This is the
-- storage-side gate behind the client upload in verify-form.tsx (the server action
-- re-checks the path prefix too — defense in depth).
drop policy if exists "evidence upload (own folder)" on storage.objects;
create policy "evidence upload (own folder)" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: moderators only (they view via a short-lived signed URL, review/actions.ts).
-- No member read path exists; no SELECT for the uploader themselves.
drop policy if exists "evidence read (moderators)" on storage.objects;
create policy "evidence read (moderators)" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-evidence'
    and public.is_moderator()
  );

-- Intentionally NO update/delete policy: members and moderators cannot mutate or
-- remove evidence through RLS. The only deleter is the service-role admin client
-- (bucket-wide, RLS-bypassing) in decideVerification — "verify, then forget".
