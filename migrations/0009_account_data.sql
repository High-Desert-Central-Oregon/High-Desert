-- ============================================================================
-- Migration 0009 — member-owned data: export + account deletion  (Part 3)
-- ----------------------------------------------------------------------------
-- Fulfils the commitment that member data is exportable and that a member can
-- "take it and leave" (Pattern 16, CLAUDE.md invariant 8).
--
-- EXPORT needs no schema: a member already reads their own rows under RLS, so
-- the export route (app/protected/account/export) just reads them as the member.
--
-- DELETION is "delete the person, never rewrite the tamper-evident record":
--   • PRESERVE, re-anchored to a scrubbed tombstone: votes, moderation_actions,
--     audit_log (the append-only record) and proposals (they anchor votes). A
--     hard delete would CASCADE votes (votes.user_id -> profiles -> auth.users)
--     and silently change closed tallies — so we anonymise, never delete them.
--   • ERASE: the personal rows (rsvps, events, verifications, neighborhood
--     requests, consents) and the personal statement inside an appeal.
--   • The profile row is kept as a tombstone so every preserved FK stays valid;
--     its PII is scrubbed here, and its guarded trust fields + the auth identity
--     are scrubbed by the service-role admin client in the server action (which
--     has no auth.uid(), so the trust-field guard doesn't apply — we never
--     loosen the guard itself; invariant 2).
-- Folded into schema.sql. Safe to re-run.
-- ============================================================================

-- A tombstone marker. A scrubbed profile stays (to anchor the preserved record)
-- but is no longer an active member; deleted_at records the erasure.
alter table profiles add column if not exists deleted_at timestamptz;

-- Defense in depth: a tombstoned account is never verified and never a moderator,
-- so the DB-level deletion (the RPC below) revokes all participation on its own —
-- the admin-side trust-field scrub + auth ban is then full erasure, not the thing
-- standing between a deleted member and the platform.
create or replace function public.is_verified()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                  where id = auth.uid() and verified and deleted_at is null);
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                  where id = auth.uid() and role in ('moderator','admin') and deleted_at is null);
$$;

-- Self-pinned: a member can only erase their OWN account (acts on auth.uid()).
-- SECURITY DEFINER so it can reach past the append-only RLS on consents/appeals
-- and write the audit entry, but it is hard-pinned to the caller — there is no
-- user-id parameter, so it can never be aimed at someone else.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be signed in to delete your account';
  end if;

  -- ERASE personal artefacts (none anchor the tamper-evident record).
  delete from event_rsvps           where user_id   = v_uid;
  delete from events                where creator_id = v_uid;  -- cascades their rsvps
  delete from verifications         where user_id   = v_uid;   -- evidence already purged on decision
  delete from neighborhood_requests where user_id   = v_uid;
  delete from consents              where user_id   = v_uid;

  -- Keep the appeal RECORD (part of the moderation trail) but erase the personal
  -- statement inside it.
  update appeals set body = '[removed when the member deleted their account]'
   where user_id = v_uid;

  -- PRESERVE, untouched: votes, proposals (author_id -> this row, set null on a
  -- future hard delete), moderation_actions, audit_log. They stay linked to the
  -- tombstone below — counted and tamper-evident, no longer identifiable.

  -- Tombstone the profile (non-guarded columns here; the guarded trust fields
  -- verified/role/tenure_start are scrubbed by the admin client, which bypasses
  -- the self-edit guard because it has no auth.uid()).
  update profiles set
      display_name    = 'Former member',
      neighborhood_id = null,
      locale          = 'en',
      deleted_at      = now()
   where id = v_uid;

  -- Record the erasure itself (no PII) in the permanent, append-only log.
  perform public.log_audit('account.deleted', 'profile', v_uid, '{}'::jsonb);
end; $$;

-- Members may call it for themselves; the body enforces "only yourself".
grant execute on function public.delete_my_account() to authenticated;
