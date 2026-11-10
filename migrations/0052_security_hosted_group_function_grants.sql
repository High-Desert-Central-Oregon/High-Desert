-- Requires 0046 only. At its stop-gate, apply this correction before 0047.
-- Fresh installs may apply it in numeric order after 0051.
-- Owner-run correction after 0046; safe to repeat. Do not rerun 0046.
-- Hosted public-schema defaults granted service_role EXECUTE directly.
-- Preserve the applied migration bytes and all authenticated/owner grants.
begin;
revoke execute on function
  public.can_read_group_audit(text,uuid,jsonb),
  public.can_rsvp_event(uuid),
  public.guard_rsvp_identity()
from service_role;
notify pgrst, 'reload schema';
commit;
