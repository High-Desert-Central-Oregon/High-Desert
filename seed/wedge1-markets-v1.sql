-- ============================================================================
-- STEPPE — Wedge-1 seed: Central Oregon vendor & farmers markets  (v1)
-- ----------------------------------------------------------------------------
-- Seeds the Everyone calendar with REAL, verified recurring markets in Redmond
-- and the surrounding Central Oregon towns, plus a public "Vendor Markets"
-- group (category: markets) as their home. Research date: 2026-07-11. Every
-- entry below carries only facts verified from the organizer's own site or a
-- dated 2026 local source; anything that couldn't be verified was OMITTED
-- (see the end of this header) rather than invented.
--
-- WHAT IT INSERTS (idempotent — safe to re-run):
--   • categories: 'markets' ("Markets") — created_by null, like the seeded
--     taxonomy (migration 0013).
--   • groups: 'vendor-markets' — public, open-join, category markets, owned
--     by the founder below (+ an active maintainer membership row).
--   • events: each market's remaining 2026 occurrences AFTER the run date —
--     one row per market day (the schema has no recurrence primitive), times
--     entered as Redmond wall-clock via America/Los_Angeles (DST-safe).
--     Events are community-wide (neighborhood_id null): the events surface IS
--     the Everyone calendar (0013 §1 — no events.group_id exists).
--   • audit_log: one 'seed.wedge1_markets' row via log_audit() (invariant 6).
--
-- HOW TO RUN (manual, like seed/bootstrap-founder.sql — NOT applied by CI):
--   Supabase Studio → SQL editor (runs as owner; RLS bypassed by design for
--   seeds) → paste the whole file → Run. Requires the founder profile
--   (bootstrap-founder.sql) AND migration 0017 (events.category_id) first —
--   the market events are tagged with the 'markets' category at insert.
--   Already ran the pre-0017 version? Applying 0017 backfills the tag.
--   Bodies are EN + ES paired.
--
-- SEASON-END OPERATIONALIZATION (flagged, not silent): three organizers state
-- a closing MONTH, not a date. The series below end on the last in-pattern
-- weekday of that verified month — trim rows if an organizer closes earlier:
--   • Redmond FM      "May–August"        ⇒ final Friday   2026-08-28
--   • Sisters FM      "June–October"      ⇒ final Sunday   2026-10-25
--   • CROP FM         "June–September"    ⇒ final Saturday 2026-09-26
--
-- OMITTED (existence known, 2026 schedule unverifiable on research date):
--   • Saturday Market at General Duffy's Waterhole (404 SW Forest Ave,
--     Redmond) — the venue's site names the market but publishes no 2026
--     day/hours/season; the regional event page 404s; the 2026-07-02 Redmond
--     Spokesman calendar doesn't carry it.
--   • Central Oregon Saturday Market (Bend) — only aggregator/review pages
--     surfaced; no organizer schedule for 2026.
--
-- SOURCES (verified 2026-07-11):
--   Redmond FM:  redmondoregonfarmersmarket.org; Redmond Spokesman 2026-04-27
--                ("opens this week", Fridays 3–7, Centennial Park) and
--                2026-06-30 calendar ("every Friday through August; 3 p.m.;
--                free; Centennial Park, corner of SW Seventh Street and
--                Evergreen Avenue"); organizer site: "no market July 31st".
--   Bend FM:     bendfarmersmarket.com (+ /market-location: Brooks Alley,
--                875 NW Brooks St); Central Oregon Daily + Bend Source
--                2026-04: Wednesdays 11–3, May 6 – Oct 14, rain or shine;
--                EBT/SNAP with Double Up Food Bucks.
--   NWX FM:      nwxfarmersmarket.com: Saturdays 10–2, May 30 – Sep 26,
--                Northwest Crossing Drive between Mt. Washington Drive and
--                Compass Park; "Produced by C3 Events".
--   Sisters FM:  sistersfarmersmarket.com/where-when: Sundays 10–2, June –
--                October, opening day June 7, Fir Street Park, 150 N. Fir
--                Street; "Closed Sundays, September 27th and October 11th."
--   Madras SM:   Madras Pioneer 2026-07-08 + KWSO 2026 calendars: Saturdays
--                9–2 through Sept. 5, Sahalee Park (corner of 7th and B);
--                listed by the City of Madras (madras.gov); site:
--                madrassaturdaymarket.com.
--   CROP FM:     cropfarmersmarket.org: "Open Saturdays, June through
--                September", 9 AM – 1 PM, Stryker Park, NE 4th St and Elm St,
--                Prineville (organizer hours win over aggregator listings).
-- ============================================================================

do $$
declare
  -- ►►► EDIT THIS ONE, then run the whole file. ◄◄◄
  v_email text := 'greg@steppe.community';  -- creator shown on the seeded rows

  v_uid   uuid;
  v_cat   uuid;
  v_grp   uuid;
  v_total int := 0;
  v_n     int;
begin
  -- Resolve the creator (must already exist — see bootstrap-founder.sql).
  select p.id into v_uid
    from public.profiles p
    join auth.users u on u.id = p.id
   where u.email = v_email;
  if v_uid is null then
    raise exception 'No profile for %. Run seed/bootstrap-founder.sql first.', v_email;
  end if;

  -- 1 · The 'markets' category (taxonomy-style: created_by null).
  insert into public.categories (slug, name)
  values ('markets', 'Markets')
  on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug = 'markets';

  -- 2 · The Vendor Markets group: public + open (anyone verified can join).
  insert into public.groups
    (slug, name, description, category_id, visibility, join_policy, is_system, created_by)
  values
    ('vendor-markets', 'Vendor Markets',
     'Vendor and farmers markets in Redmond and around Central Oregon — schedules, locations, and organizer links. Season dates come from each market''s organizer. / Mercados de vendedores y de agricultores en Redmond y el centro de Oregón: horarios, ubicaciones y enlaces de los organizadores. Las fechas de temporada provienen de cada organizador.',
     v_cat, 'public', 'open', false, v_uid)
  on conflict (slug) do nothing;
  select id into v_grp from public.groups where slug = 'vendor-markets';

  insert into public.group_members (group_id, user_id, role, status)
  values (v_grp, v_uid, 'maintainer', 'active')
  on conflict (group_id, user_id) do nothing;

  -- 3 · Events — one row per remaining 2026 market day (run-date forward).
  --     starts_at is the market's OPENING time, Redmond wall-clock; the full
  --     hours live in the body (events have no ends_at column).

  -- Redmond Farmers Market — Fridays 3–7 p.m., Centennial Park.
  insert into public.events (creator_id, category_id, title, body, starts_at, location)
  select v_uid, v_cat, 'Redmond Farmers Market',
         'Weekly farmers market at Centennial Park — local produce, meats, honey, baked goods, art, and handmade goods, with live music and a Kids Corner. Fridays 3–7 p.m. through August; no market July 31. Organized by the Redmond Oregon Farmers Market (redmondoregonfarmersmarket.org).'
         || e'\n\n' ||
         'Mercado de agricultores semanal en Centennial Park: frutas y verduras locales, carnes, miel, pan, arte y productos hechos a mano, con música en vivo y un rincón para niños. Viernes de 3 a 7 p. m. hasta finales de agosto; no habrá mercado el 31 de julio. Organizado por Redmond Oregon Farmers Market (redmondoregonfarmersmarket.org).',
         (d::date + time '15:00') at time zone 'America/Los_Angeles',
         'Centennial Park, SW 7th St & Evergreen Ave, Redmond'
    from generate_series(date '2026-05-01', date '2026-08-28', interval '7 days') d
   where d::date > current_date
     and d::date <> date '2026-07-31'   -- organizer: "no market July 31st"
     and not exists (select 1 from public.events e
                      where e.title = 'Redmond Farmers Market'
                        and e.starts_at = (d::date + time '15:00') at time zone 'America/Los_Angeles');
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- Bend Farmers Market — Wednesdays 11 a.m.–3 p.m., Brooks Alley.
  insert into public.events (creator_id, category_id, title, body, starts_at, location)
  select v_uid, v_cat, 'Bend Farmers Market',
         'Downtown Bend''s farmers market in Brooks Alley — produce, pasture-raised meats, eggs, cheeses, flowers, and baked goods from local farms and ranches. Wednesdays 11 a.m.–3 p.m., rain or shine, through October 14. Accepts EBT/SNAP with Double Up Food Bucks. Organized by the Bend Farmers Market (bendfarmersmarket.com).'
         || e'\n\n' ||
         'El mercado de agricultores del centro de Bend en Brooks Alley: frutas y verduras, carnes de pastoreo, huevos, quesos, flores y pan de granjas y ranchos locales. Miércoles de 11 a. m. a 3 p. m., llueva o haga sol, hasta el 14 de octubre. Acepta EBT/SNAP con Double Up Food Bucks. Organizado por Bend Farmers Market (bendfarmersmarket.com).',
         (d::date + time '11:00') at time zone 'America/Los_Angeles',
         'Brooks Alley, 875 NW Brooks St, Bend'
    from generate_series(date '2026-05-06', date '2026-10-14', interval '7 days') d
   where d::date > current_date
     and not exists (select 1 from public.events e
                      where e.title = 'Bend Farmers Market'
                        and e.starts_at = (d::date + time '11:00') at time zone 'America/Los_Angeles');
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- NorthWest Crossing Saturday Farmers Market — Saturdays 10 a.m.–2 p.m.
  insert into public.events (creator_id, category_id, title, body, starts_at, location)
  select v_uid, v_cat, 'NorthWest Crossing Saturday Farmers Market',
         'Saturday farmers market on Bend''s westside — produce stands, local makers, cottage bakers, and live music along Northwest Crossing Drive. Saturdays 10 a.m.–2 p.m. through September 26. Produced by C3 Events (nwxfarmersmarket.com).'
         || e'\n\n' ||
         'Mercado de agricultores de los sábados en el lado oeste de Bend: puestos de frutas y verduras, artesanos locales, panaderos caseros y música en vivo a lo largo de Northwest Crossing Drive. Sábados de 10 a. m. a 2 p. m. hasta el 26 de septiembre. Producido por C3 Events (nwxfarmersmarket.com).',
         (d::date + time '10:00') at time zone 'America/Los_Angeles',
         'Northwest Crossing Dr (between Mt. Washington Dr & Compass Park), Bend'
    from generate_series(date '2026-05-30', date '2026-09-26', interval '7 days') d
   where d::date > current_date
     and not exists (select 1 from public.events e
                      where e.title = 'NorthWest Crossing Saturday Farmers Market'
                        and e.starts_at = (d::date + time '10:00') at time zone 'America/Los_Angeles');
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- Sisters Farmers Market — Sundays 10 a.m.–2 p.m., Fir Street Park.
  insert into public.events (creator_id, category_id, title, body, starts_at, location)
  select v_uid, v_cat, 'Sisters Farmers Market',
         'Sisters'' farmers market at Fir Street Park — 45+ local vendors, fresh produce, and handmade goods, one block north of Cascade Ave. Sundays 10 a.m.–2 p.m., June–October; closed September 27 and October 11 for citywide events. Organized by the Sisters Farmers Market (sistersfarmersmarket.com).'
         || e'\n\n' ||
         'El mercado de agricultores de Sisters en Fir Street Park: más de 45 vendedores locales, productos frescos y artículos hechos a mano, a una cuadra al norte de Cascade Ave. Domingos de 10 a. m. a 2 p. m., de junio a octubre; cerrado el 27 de septiembre y el 11 de octubre por eventos de la ciudad. Organizado por Sisters Farmers Market (sistersfarmersmarket.com).',
         (d::date + time '10:00') at time zone 'America/Los_Angeles',
         'Fir Street Park, 150 N Fir St, Sisters'
    from generate_series(date '2026-06-07', date '2026-10-25', interval '7 days') d
   where d::date > current_date
     and d::date not in (date '2026-09-27', date '2026-10-11')  -- citywide events
     and not exists (select 1 from public.events e
                      where e.title = 'Sisters Farmers Market'
                        and e.starts_at = (d::date + time '10:00') at time zone 'America/Los_Angeles');
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- Madras Saturday Market — Saturdays 9 a.m.–2 p.m., Sahalee Park.
  insert into public.events (creator_id, category_id, title, body, starts_at, location)
  select v_uid, v_cat, 'Madras Saturday Market',
         'Madras'' Saturday market at Sahalee Park (7th & B) — artisan items, baked goods, handmade products, and food. Saturdays 9 a.m.–2 p.m. through September 5. Organized by the Madras Saturday Market (madrassaturdaymarket.com).'
         || e'\n\n' ||
         'El mercado de los sábados de Madras en Sahalee Park (7th y B): artículos artesanales, pan casero, productos hechos a mano y comida. Sábados de 9 a. m. a 2 p. m. hasta el 5 de septiembre. Organizado por Madras Saturday Market (madrassaturdaymarket.com).',
         (d::date + time '09:00') at time zone 'America/Los_Angeles',
         'Sahalee Park, SE 7th St & B St, Madras'
    from generate_series(date '2026-06-06', date '2026-09-05', interval '7 days') d
   where d::date > current_date
     and not exists (select 1 from public.events e
                      where e.title = 'Madras Saturday Market'
                        and e.starts_at = (d::date + time '09:00') at time zone 'America/Los_Angeles');
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- CROP Farmers Market — Saturdays 9 a.m.–1 p.m., Stryker Park, Prineville.
  insert into public.events (creator_id, category_id, title, body, starts_at, location)
  select v_uid, v_cat, 'CROP Farmers Market',
         'Prineville''s farmers market at Stryker Park — Crook County farmers, ranchers, and artisans with fresh local produce, handmade goods, and artisanal foods (CROP = Crooked River Open Pastures). Saturdays 9 a.m.–1 p.m., June–September. Organized by the CROP Farmers Market (cropfarmersmarket.org).'
         || e'\n\n' ||
         'El mercado de agricultores de Prineville en Stryker Park: agricultores, ganaderos y artesanos del condado de Crook con productos frescos locales, artículos hechos a mano y alimentos artesanales (CROP = Crooked River Open Pastures). Sábados de 9 a. m. a 1 p. m., de junio a septiembre. Organizado por CROP Farmers Market (cropfarmersmarket.org).',
         (d::date + time '09:00') at time zone 'America/Los_Angeles',
         'Stryker Park, NE 4th St & Elm St, Prineville'
    from generate_series(date '2026-06-06', date '2026-09-26', interval '7 days') d
   where d::date > current_date
     and not exists (select 1 from public.events e
                      where e.title = 'CROP Farmers Market'
                        and e.starts_at = (d::date + time '09:00') at time zone 'America/Los_Angeles');
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- 4 · The permanent record (invariant 6).
  perform public.log_audit('seed.wedge1_markets', 'group', v_grp,
    jsonb_build_object('version', 'v1', 'events_inserted', v_total,
                       'markets', 6, 'research_date', '2026-07-11'));

  raise notice 'Wedge-1 markets seed: % future event rows inserted (6 markets; group vendor-markets ready).', v_total;
end $$;
