-- ============================================================================
-- STEPPE — Seed: private Storage bucket for verification evidence
-- ----------------------------------------------------------------------------
-- Implements the storage half of "verify, then forget" (CLAUDE.md invariant 1;
-- schema.sql NOTES). Run AFTER schema.sql, against the same Supabase project.
--
-- The bucket is PRIVATE. Two policies, and deliberately NO delete policy:
--   • members may upload only into their OWN <auth.uid>/… folder;
--   • only moderators may read objects (to review, via short-lived signed URLs);
--   • deletion on a decision is done by the SERVICE-ROLE key from a server
--     action (app/protected/review/actions.ts) — the DB drops the pointer, the
--     action drops the file. There is intentionally no member/moderator DELETE
--     policy, so evidence can never be removed by a logged-in client.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('verification-evidence', 'verification-evidence', false)
on conflict (id) do nothing;

-- Members upload into their own user-id folder, e.g. '<auth.uid>/<uuid>.jpg'.
drop policy if exists "evidence upload (own folder)" on storage.objects;
create policy "evidence upload (own folder)" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only moderators can read evidence (this is what makes signed URLs work for
-- the reviewer queue, and only for them).
drop policy if exists "evidence read (moderators)" on storage.objects;
create policy "evidence read (moderators)" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-evidence'
    and public.is_moderator()
  );
