-- Owner-run correction after 0052; safe to repeat.
-- Hosted defaults left direct anonymous privileges on the ballot table.
-- Revoke only this role's table/column grants; preserve member and service ACLs,
-- row policies, triggers, ballot records, and schema-wide default privileges.
begin;
revoke all privileges on table public.votes from anon;
notify pgrst, 'reload schema';
commit;
