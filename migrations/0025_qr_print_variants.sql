-- ============================================================================
-- Migration 0025 — QR print variants (posters + seed card)
-- ----------------------------------------------------------------------------
-- Extends the existing first-party, zero-PII aggregate qr_counts counter beyond
-- the two printed business-card variants. The table still stores only:
--   variant × kind × day × count
-- and never IP addresses, user agents, cookies, or identifiers.
-- ============================================================================

alter table qr_counts
  drop constraint if exists qr_counts_variant_check;

alter table qr_counts
  add constraint qr_counts_variant_check
  check (
    variant in (
      'quiet',
      'square',
      'poster_owned',
      'poster_built',
      'poster_common',
      'seed_card'
    )
  );

create or replace function public.increment_qr_count(p_variant text, p_kind text)
returns void language plpgsql set search_path = public as $$
begin
  if p_variant not in (
    'quiet',
    'square',
    'poster_owned',
    'poster_built',
    'poster_common',
    'seed_card'
  ) or p_kind not in ('scan','join') then
    raise exception 'invalid qr counter';
  end if;
  insert into qr_counts (variant, kind, day, count)
  values (p_variant, p_kind, current_date, 1)
  on conflict (variant, kind, day)
  do update set count = qr_counts.count + 1;
end; $$;

revoke all on function public.increment_qr_count(text, text) from public;
grant execute on function public.increment_qr_count(text, text) to service_role;
