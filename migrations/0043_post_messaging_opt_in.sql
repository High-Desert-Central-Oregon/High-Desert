-- Per-post messaging consent. Apply BY HAND as owner before the app release.
-- No existing post is opted in. Existing conversations keep their current
-- participant/reply/block rules; only contact through a post gains this gate.
begin;
alter table public.posts add column if not exists allow_messages boolean not null default false;
comment on column public.posts.allow_messages is
  'Author-controlled permission to start contact through this post. Existing conversations can continue; blocks still stop all sends.';
grant insert(allow_messages), update(allow_messages) on public.posts to authenticated;

create or replace function public.guard_post_columns()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  new.group_id:=old.group_id;
  new.author_id:=old.author_id;
  new.created_at:=old.created_at;
  -- An older client changing category keeps a coherent tag set.
  if new.category is distinct from old.category and new.tags is not distinct from old.tags then
    new.tags:=case when new.category::text='event' then '{}'::text[] else array[new.category::text] end;
  end if;
  if (new.title,new.body,new.category,new.neighborhood_id,new.tags,new.allow_messages)
    is distinct from (old.title,old.body,old.category,old.neighborhood_id,old.tags,old.allow_messages) then
    new.edited_at:=now();
  else new.edited_at:=old.edited_at;
  end if;
  return new;
end; $$;

create or replace function public.start_thread(
  p_with uuid, p_body text, p_about_post uuid default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me     uuid := auth.uid();
  v_a      uuid;
  v_b      uuid;
  v_thread threads%rowtype;
  v_ok     boolean := false;
begin
  if v_me is null or not public.is_verified()
     or not exists (select 1 from public.profiles p where p.id = v_me and p.deleted_at is null) then
    raise exception 'Only verified members can send messages';
  end if;
  if p_with = v_me then
    raise exception 'You cannot message yourself';
  end if;
  if btrim(coalesce(p_body, '')) = '' or char_length(p_body) > 4000 then
    raise exception 'Write a message first';
  end if;

  -- Database consent gate, scoped to the caller's readable board. The same
  -- refusal covers missing, unreadable, hidden, wrong-author and opted-out
  -- posts. Lock the post so a simultaneous opt-out/deletion serializes with
  -- this send; permission is checked even when the pair already has a thread.
  if p_about_post is not null then
    perform 1 from public.posts po
      where po.id = p_about_post and po.author_id = p_with
        and po.allow_messages
        and public.is_group_member(po.group_id)
        and not public.is_content_hidden('post', po.id)
      for share;
    v_ok := found;
  end if;
  if not v_ok then
    raise exception 'This post is not available for messaging';
  end if;

  -- Reachability — blocked either way, deleted, or unverified counterpart:
  -- ONE message, no oracle.
  if exists (select 1 from member_blocks bl
              where (bl.blocker_id = v_me and bl.blocked_id = p_with)
                 or (bl.blocker_id = p_with and bl.blocked_id = v_me))
     or not exists (select 1 from profiles p
                     where p.id = p_with and p.verified and p.deleted_at is null)
  then
    raise exception 'This neighbor can''t be reached right now';
  end if;

  v_a := least(v_me, p_with);
  v_b := greatest(v_me, p_with);

  select * into v_thread from threads t
   where t.member_a = v_a and t.member_b = v_b;
  if not found then
    -- Rate valve (M-G7: provisional config, cohort-ratifiable): at most 10
    -- NEW conversations per member per rolling day. A cap, never a score —
    -- and only on NEW pairs: re-contacting an existing thread is a reply,
    -- not a new conversation.
    if (select count(*) from threads t
         where t.started_by = v_me
           and t.created_at > now() - interval '24 hours') >= 10 then
      raise exception 'That''s plenty of new conversations for one day — try again tomorrow';
    end if;
    begin
      insert into threads (member_a, member_b, started_by, about_post_id)
      values (v_a, v_b, v_me, p_about_post)
      returning * into v_thread;
      insert into thread_state (thread_id, member_id)
      values (v_thread.id, v_a), (v_thread.id, v_b);
    exception when unique_violation then
      -- Lost the pair race; the winner's thread is THE thread (its anchor
      -- stands — never overwritten, :1699). Raise if somehow still absent.
      select * into v_thread from threads t
       where t.member_a = v_a and t.member_b = v_b;
      if not found then raise; end if;
    end;
  end if;

  insert into messages (thread_id, sender_id, body)
  values (v_thread.id, v_me, p_body);
  update thread_state set last_read_at = now(), left_at = null
   where thread_id = v_thread.id and member_id = v_me;

  return v_thread.id;
end; $$;

revoke all on function public.start_thread(uuid, text, uuid) from public, anon;
grant execute on function public.start_thread(uuid, text, uuid) to authenticated;

notify pgrst,'reload schema';
commit;
