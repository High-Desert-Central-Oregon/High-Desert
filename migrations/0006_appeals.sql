-- ============================================================================
-- Migration 0006 — appeals: file + resolve, with separation of duties (Part 3)
-- ----------------------------------------------------------------------------
-- Two rules can't be expressed cleanly in RLS (the target is polymorphic, and
-- "a different moderator" compares rows), so appeals are filed and resolved ONLY
-- through these SECURITY DEFINER functions, and the direct insert/update RLS
-- policies are removed so the rules can't be bypassed via PostgREST.
-- Append-only throughout: a resolution updates the appeal's status and writes an
-- audit entry; an overturn issues a NEW 'restore' action. History is never
-- edited. Safe to re-run.
-- ============================================================================

-- The affected member may file ONE appeal against a 'remove' action on content
-- they own (event creator / proposal author).
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
  end if;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'only the affected member may appeal this action';
  end if;

  insert into appeals (moderation_action_id, user_id, body)
  values (p_moderation_action_id, auth.uid(), p_body)
  returning id into v_appeal;
  return v_appeal;
end; $$;

-- A DIFFERENT moderator resolves an open appeal: uphold or overturn, with a
-- required reason. Overturning issues a NEW 'restore' action (un-hiding the
-- content). The outcome is logged to the append-only audit log.
create or replace function public.resolve_appeal(p_appeal_id uuid, p_uphold boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_action uuid; v_actor uuid; v_type text; v_target uuid;
begin
  if not public.is_moderator() then
    raise exception 'only moderators may resolve appeals';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'a reason is required';
  end if;

  select a.moderation_action_id, m.actor_id, m.target_type, m.target_id
    into v_action, v_actor, v_type, v_target
  from appeals a join moderation_actions m on m.id = a.moderation_action_id
  where a.id = p_appeal_id and a.status = 'open';
  if v_action is null then raise exception 'appeal not found or already resolved'; end if;

  -- Separation of duties: no one judges an appeal of their own action.
  if v_actor = auth.uid() then
    raise exception 'separation of duties: you cannot resolve an appeal of your own action';
  end if;

  update appeals
     set status = case when p_uphold then 'upheld' else 'overturned' end::appeal_status
   where id = p_appeal_id;

  -- Overturning un-hides the content via a NEW restore row (history preserved).
  if not p_uphold then
    insert into moderation_actions (target_type, target_id, actor_id, action, reason)
    values (v_type, v_target, auth.uid(), 'restore', 'Appeal overturned: ' || p_reason);
  end if;

  perform public.log_audit(
    case when p_uphold then 'appeal.upheld' else 'appeal.overturned' end,
    'appeal', p_appeal_id,
    jsonb_build_object('moderation_action_id', v_action, 'reason', p_reason));
end; $$;

-- Filing and resolving go ONLY through the functions above. Drop the direct
-- write policies so the affected-member and separation-of-duties checks can't be
-- bypassed. Reads stay: a member sees their own appeal; moderators see all.
drop policy if exists ap_insert on appeals;
drop policy if exists ap_update on appeals;
