-- Multiple Exchange tags. Apply before deploying the member usability release.
-- Existing category remains the primary tag for older clients. No new access.
begin;
alter table public.posts add column tags text[] not null default '{}';
alter table public.posts add constraint posts_tags_check check (
  cardinality(tags) between 0 and 5
  and array_position(tags, null) is null
  and tags <@ array['need','offer','aid','job','goods']::text[]
);
update public.posts set tags=array[category::text] where category::text <> 'event';
grant insert(tags), update(tags) on public.posts to authenticated;
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
  if (new.title,new.body,new.category,new.neighborhood_id,new.tags)
    is distinct from (old.title,old.body,old.category,old.neighborhood_id,old.tags) then
    new.edited_at:=now();
  else new.edited_at:=old.edited_at;
  end if;
  return new;
end; $$;
-- Keep category and tags coherent for both old and new inserts/updates.
create function public.normalize_post_tags() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if cardinality(new.tags)=0 and new.category::text<>'event' then new.tags:=array[new.category::text]; end if;
  if cardinality(new.tags)>0 and not (new.category::text=any(new.tags)) then
    raise exception 'primary category must be one of the tags' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger trg_normalize_post_tags before insert or update on public.posts
for each row execute function public.normalize_post_tags();
commit;
