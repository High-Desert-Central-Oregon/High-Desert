-- ============================================================================
-- Migration 0017 — interim event categorization (events.category_id)
-- ----------------------------------------------------------------------------
-- Adds a nullable category to events, reusing the EXISTING categories taxonomy
-- (0013) rather than inventing an event-only one. This is the schema-light
-- interim behind the events surface's marker kickers: an uncategorized event
-- renders the bundle's plain EVENT marker (ochre); a categorized one renders
-- its category's marker + name — exactly like the groups directory.
--
-- Nullable and optional by design: nothing existing breaks, no RLS change is
-- needed (the column rides the events row policies; categories are readable
-- to authenticated members per 0013), and creators simply don't set it yet —
-- the create-event form gains the picker when categorization graduates from
-- interim. No ranking or filtering hangs off it (invariant 7): it is a label.
--
-- BACKFILL (guarded): tags the six Wedge-1 market events
-- (seed/wedge1-markets-v1.sql) with the 'markets' category where that seed
-- has already run. Fresh databases where the seed hasn't run skip it — the
-- amended seed now sets category_id at insert instead.
--
-- Idempotent and safe to re-run. Apply manually (SQL editor as owner, or
-- supabase db push) BEFORE deploying UI that writes the column; the events
-- page reads defensively and renders the default EVENT marker until then.
-- ============================================================================

alter table public.events
  add column if not exists category_id uuid references public.categories(id);

comment on column public.events.category_id is
  'Optional taxonomy label (categories, 0013). Interim event categorization: display-only — never an ordering or ranking input (invariant 7).';

-- Tag the Wedge-1 market events, when both sides already exist.
update public.events e
   set category_id = c.id
  from public.categories c
 where c.slug = 'markets'
   and e.category_id is null
   and e.title in (
     'Redmond Farmers Market',
     'Bend Farmers Market',
     'NorthWest Crossing Saturday Farmers Market',
     'Sisters Farmers Market',
     'Madras Saturday Market',
     'CROP Farmers Market'
   );
