-- Apply after 0049. Preserve append-only history; order new actions by receipt.
begin;
lock table public.moderation_actions in share row exclusive mode;
create table steppe_security_private.moderation_order (
 action_id uuid primary key references public.moderation_actions(id),
 position bigint generated always as identity unique);
revoke all on steppe_security_private.moderation_order from public,anon,authenticated;
insert into steppe_security_private.moderation_order(action_id)
 select id from public.moderation_actions order by created_at,id;
create function steppe_security_private.stamp_moderation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.target_type||':'||new.target_id::text,50));
 new.created_at:=clock_timestamp();
 return new;
end; $$;
create function steppe_security_private.order_moderation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into steppe_security_private.moderation_order(action_id) values(new.id);
 return new;
end; $$;
revoke all on function steppe_security_private.stamp_moderation(),steppe_security_private.order_moderation() from public,anon,authenticated;
create trigger aa_stamp_moderation before insert on public.moderation_actions for each row execute function steppe_security_private.stamp_moderation();
create trigger aa_order_moderation after insert on public.moderation_actions for each row execute function steppe_security_private.order_moderation();
create or replace function public.is_content_hidden(p_type text,p_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select m.action='remove' from public.moderation_actions m
 join steppe_security_private.moderation_order o on o.action_id=m.id
 where m.target_type=p_type and m.target_id=p_id and m.action in ('remove','restore')
 order by o.position desc limit 1),false);
$$;
-- Invoker view retains its RLS boundary; helper reveals only an ordering key
-- for the already-readable moderation action, never a private table grant.
create function public.moderation_position(p_action uuid) returns bigint
language sql stable security definer set search_path=public,pg_temp as $$
 select position from steppe_security_private.moderation_order
 where action_id=p_action and public.is_active_account();
$$;
revoke all on function public.moderation_position(uuid) from public,anon;
grant execute on function public.moderation_position(uuid) to authenticated;
create or replace view public.content_moderation with(security_invoker=on) as
 select distinct on (target_type,target_id)
 id as action_id,target_type,target_id,action,reason,actor_id,created_at
 from public.moderation_actions where action in ('remove','restore')
 order by target_type,target_id,public.moderation_position(id) desc,id desc;

-- Moderator writes bind attribution to the authenticated actor. Service-only
-- redemption has no member UID and copies the original token minter.
create function steppe_security_private.guard_inviter() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare previous uuid; proposed uuid;
begin
 if tg_table_name='invite_tokens' then
  proposed:=new.created_by;
  if tg_op='UPDATE' then previous:=old.created_by; end if;
 else
  proposed:=new.invited_by;
  if tg_op='UPDATE' then previous:=old.invited_by; end if;
 end if;
 if tg_op='INSERT' then
  if auth.uid() is not null then
   if tg_table_name='invite_tokens' then new.created_by:=auth.uid(); else new.invited_by:=auth.uid(); end if;
  end if;
 elsif proposed is distinct from previous then
  -- The sole mutation is the FK's ON DELETE SET NULL privacy lifecycle.
  if not (proposed is null and not exists(select 1 from auth.users where id=previous)) then
   raise exception 'inviter attribution is immutable' using errcode='42501';
  end if;
 end if;
 return new;
end; $$;
revoke all on function steppe_security_private.guard_inviter() from public,anon,authenticated;
create trigger inviter_attribution before insert or update on public.invite_tokens for each row execute function steppe_security_private.guard_inviter();
create trigger inviter_attribution before insert or update on public.invited_emails for each row execute function steppe_security_private.guard_inviter();
notify pgrst,'reload schema';
commit;
