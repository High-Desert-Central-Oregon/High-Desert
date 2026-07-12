-- ============================================================================
-- Migration 0019 — appeals know posts (X1 follow-through)
-- ----------------------------------------------------------------------------
-- 0018 added Exchange posts and moderation of them rides the existing
-- moderation_actions flow — but file_appeal() (0006) resolves the "affected
-- member" only for events and proposals, so the author of a removed POST was
-- refused their own appeal ('only the affected member may appeal this
-- action') — breaking the P7 promise the removed state makes. This teaches
-- the ownership lookup about posts. Everything else (appeals table, RLS,
-- resolve_appeal, the different-moderator rule) is target-type-agnostic and
-- unchanged.
--
-- Idempotent (create or replace); manual apply only (SQL editor as owner),
-- like 0013/0017/0018. Apply promptly after 0018 — until then a removed
-- post's author sees a refusal instead of a filed appeal.
-- ============================================================================

create or replace function public.file_appeal(p_moderation_action_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_type text; v_target uuid; v_owner uuid; v_appeal uuid;
begin
  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'an appeal statement is required';
  end if;

  select target_type, target_id into v_type, v_target
  from moderation_actions
  where id = p_moderation_action_id and action = 'remove';
  if v_target is null then raise exception 'no removal to appeal'; end if;

  if exists (select 1 from appeals where moderation_action_id = p_moderation_action_id) then
    raise exception 'this action has already been appealed';
  end if;

  if v_type = 'event' then
    select creator_id into v_owner from events where id = v_target;
  elsif v_type = 'proposal' then
    select author_id into v_owner from proposals where id = v_target;
  elsif v_type = 'post' then
    select author_id into v_owner from posts where id = v_target;
  end if;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'only the affected member may appeal this action';
  end if;

  insert into appeals (moderation_action_id, user_id, body)
  values (p_moderation_action_id, auth.uid(), p_body)
  returning id into v_appeal;
  return v_appeal;
end; $$;
