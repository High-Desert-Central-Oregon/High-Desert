# Steppe Calendar (C1) — personal calendar, calendar views & subscription feeds, v1

| | |
|---|---|
| **Status** | Draft for review — nothing here is built. §1–§7 are recommendations awaiting a decision; §8 collects the G-class flags, one of which (**C-G1**) is a governance-vote question, not a founder sign-off |
| **Source posture** | **The bundle contains no calendar UI** (verified in §0 below and previously in `exchange-x1-spec-v1.md` §7). C1 is therefore a *proposal under the token law* — designed in-register rather than decompiled. Every proposed element cites its grammar ancestor in the bundle (`inner.html:<line>`, decompiled exactly as in `docs/audits/preview-parity-audit-v1.md`) or in shipped X1 code |
| **Companions** | `docs/spec/exchange-x1-spec-v1.md` (X1 law; its §7.4 deferrals are C1's terms of reference) · `docs/spec/Steppe-Groups-Calendar-Exchange-Spec-v2.md` §3 (calendar prior art) · `docs/spec/Steppe-Spec-v3-Identity-Privacy-Exchange.md` §2/§8 (privacy + notifications) · `docs/design/exchange-design-tokens-reference.css` (token law) · `DECISIONS.md` 2026-07-12 (G-2 members-only ruling) |
| **Founder direction encoded** | My Calendar on You · agenda\|calendar view toggle with an in-register month grid (**the X1 §7.4 month-grid deferral is founder-overridden** — design it to the law, don't defer again) · tokenized ICS subscription feeds with a required privacy design section · recurrence/import/reminders stay OUT |

**G-class flags** — anything touching governance or the four entrenched promises
(**no ads ever · verify residency then forget it · members govern by secret
ballot · your data leaves with you**) is marked **⚑ C-G#** inline and collected
in §8. None of §4–§6 may land while its flag is unresolved.

> **Amendments (2026-07-12, DECISIONS.md).** Approved to build. Flags
> resolved: **C-G1** member-minted feeds only — public group feeds are not
> shipped in any form; the §8 ballot question is DRAFTED for the cohort
> (filed with the pending G-1 moderation-policy ratification) ·
> **C-G2** approved; the Terms/Privacy counsel packet gains a plain-language
> calendar-links paragraph (pre-counsel, review-gate branch) ·
> **C-G3** approved on the record — `last_fetched_at` as an owner-visible
> security affordance, never aggregated or optimized on ·
> **C-G4** approved on the record — **plaintext token at rest** per §7.5's
> argued trade (the reasoning is preserved in the decision record, not just
> here). One scope amendment: **`events.ends_at` folds INTO migration 0020**
> (amending §0's deferral and §9's row) — the column ships now, nullable,
> with no composer field yet; the ICS layers emit DTEND when present.

## Part I — Verification & precedent inventory

## 0. The bundle has no calendar UI (re-verified)

A fresh whole-source sweep of the decompiled bundle (2,108 lines) for
`calendar | month | grid | week | date-pick` confirms the X1 §7 finding: there
is **no month grid, week strip, or date-picker view anywhere**. The bundle's
entire calendar vocabulary is:

1. **Upcoming date-tile rows** in group detail (:879-894) — the agenda unit;
2. **Event detail** with When/Where/Host + RSVP chips + quiet count (:912-944);
3. **Add to calendar** — a client-side `.ics` download with a copy-details
   fallback panel (:934-941, `addToCalendar` :1710-1718; COMPONENTS :1455,
   PATTERNS :1477: *"No account linking, no upsell"*).

Two bundle facts C1 must carry forward honestly:

- The bundle's demo ICS emits **`DTEND`** (:1712, `'DTEND:'+ev.end`) — but the
  live schema has **no end time** (`events` carries only `starts_at`,
  schema.sql:109-120), and the shipped button already ships DTSTART-only
  (`add-to-calendar.tsx`). C1 keeps DTSTART-only everywhere and logs the
  `ends_at` schema gap in §9 — it is not C1's to fix by the way.
- *"Your calendar app is the calendar; Steppe is the source of truth that
  feeds it"* (X1 §7). C1's feeds (§6) are the completion of that sentence —
  X1 §7.4 explicitly deferred ICS feed URLs as *"a privacy surface — needs its
  own review."* **This document is that review** (§7).

## 0.1 Prior art being cut lighter (v2 §3, per founder direction)

v2 §3 (:44-65) designed: materialized `event_occurrences`, recurrence rules +
horizon job, `event_groups` many-to-many targets, a publication state machine,
and a personal calendar built from **`calendar_subscriptions`** (user_id,
group_id — "follow a group's whole calendar", :54) + **`event_saves`**
(user_id, occurrence_id — "cherry-pick single occurrences", :55), with
My Calendar = subscribed ∪ saved ∪ authored/RSVP'd (:56).

**The lighter cut C1 takes: zero new tables for My Calendar itself.**

| v2 machinery | C1 replacement | why lighter is right |
|---|---|---|
| `calendar_subscriptions` | **`group_members` IS the subscription.** Joining a group is the "follow its calendar" gesture; the rows already exist (0013) and already carry leave-semantics for free | A second follow-verb would let membership and calendar-follow drift apart — a distinction no member asked for. If a "mute this group's events" preference is ever wanted, it's an *exception* table added then, not a *subscription* table added now |
| `event_saves` | **The RSVP is the save.** `event_rsvps` (schema.sql:122-130, `going\|maybe`) already records "I intend to be there" — one row per member per event | A bookmark verb distinct from RSVP is a second intention system. The bundle's own event detail offers exactly RSVP + Add-to-calendar (:928-934) — no save chip on events |
| `event_occurrences` + recurrence | Dated instances stand (the wedge-1 markets seed pattern; X1 §7.4) | OUT per founder direction (§9) |
| publication state machine | Not touched — G-4 resolved post-moderation (DECISIONS 2026-07-12) | — |

So **My Calendar = events I RSVP'd to ∪ events of groups I explicitly belong
to** — precisely the founder's sentence, and precisely two existing tables.
One elegant consequence of 0013's design: Everyone-membership is *implicit and
never materialized* (0013 :100-103, `is_group_member` :62-72), so a
`group_members` join **excludes the Everyone board automatically**. Community-
wide events enter My Calendar only when the member RSVPs — otherwise
My Calendar would just duplicate the Exchange's Upcoming segment. The right
semantics fall out of the data model with no special case.

## 0.2 Grammar precedent inventory (every element C1 proposes, with its ancestor)

| C1 element | grammar ancestor | citation |
|---|---|---|
| Agenda rows + month section heads | shipped X1 Upcoming (date-tile rows under mono month heads, Redmond TZ) | `exchange/upcoming/page.tsx`, `date-tile-row.tsx`; bundle :879-894 |
| View toggle (Agenda \| Month) | segmented-control grammar: mono chip, active = ink + 2px rust underline | `segStyle` :1901; shipped `GovSegments`/`ExchangeSegments` |
| Month-grid cell box | the 46px date tile generalized: hairline box, centered | :882 |
| Weekday header | the tile's month line: mono 8.5px / 600 / .1em / UPPER, ink-soft | :883 (rust reserved for the tile's month; headers are ink-soft) |
| Day numeral | the tile's Besley day numeral, stepped to an existing smaller size | :884 (19px) → 16px (existing step, group-event title :887) |
| **Presence dot in a day cell** | the unread dot — *"Quiet signals only — unread is a DOT, never a number"* | :2085 (9px rust circle) · law :1518 |
| Why NOT per-category dots | *"Category marker … ALWAYS beside its text label — never colour alone"* | ASSETS :1493 — a bare category square in a grid cell would be color-alone; so the cell mark is **one neutral rust presence dot**, category speaks in the day agenda below |
| Today = rust numeral; selected day = bone fill + 2px rust rule | *"rust is accent only (markers, active, chevron, drop cap, sun)"* — today/selected are the active positions | :1513; segStyle active :1901 |
| Month nav chevrons (juniper) | back-navigation is juniper; rust chevrons mean "row opens content" | :916 (back, juniper 2.2) vs :890 (row chevron, rust) |
| My Calendar row on You | You-section rows: 16px rhythm, hairline, 15.5/600 label + 12.5 ink-soft sub + rust chevron | :733-743, :2014-2015 |
| Feed-management register ("your data" voice) | `yData` / `yDataSub`: "Your data / Export anytime" · "Tus datos / Exporta cuando quieras" | :1586/:1589, :1634/:1637 |
| Copyable feed-URL panel | the ICS copy-details panel: bone box, hairline, mono 9px label, mono 11.5px selectable text | :936-938; shipped `add-to-calendar.tsx` |
| Empty state | strata + Besley title + ink-soft sub | :584-597; shipped `EmptyBoard` |
| Privacy voice on You surfaces | "Private by default — you choose what neighbors see." | :1916; shipped `account.voice` |

---

## Part II — Recommendations (decision-ready; each is THE proposal, with rationale)

## 1. Surfaces

### 1.1 My Calendar — `/protected/account/calendar` (filed under You)

The You page (`/protected/account`) gains one section row (You-row grammar,
:2014-2015), placed after Neighborhood and before the moderator rows:

- label `My calendar` / `Mi calendario` (15.5px/600 ink), rust chevron;
- sub (12.5px ink-soft): `Your RSVPs and your groups' gatherings` /
  `Tus RSVP y los eventos de tus grupos`.

The page itself:

- **Masthead** (flush, bone — every root-like surface opens flush): title
  `My calendar` / `Mi calendario`; kicker `RSVPS · YOUR GROUPS · REDMOND TIME`
  / `RSVP · TUS GRUPOS · HORA DE REDMOND`; voice (the one italic)
  `Your gatherings in one column — what you answered and where you belong.` /
  `Tus encuentros en una columna — lo que respondiste y donde perteneces.`
- **VerifiedGate** for unverified members (own `calendar.gate*` strings, §2) —
  an unverified member has no RSVPs and no groups, so the gate *is* the honest
  empty state, with the verify CTA.
- **Content**: the §4.1 union, rendered exactly like the shipped Exchange
  Upcoming — agenda by default (month section heads + `DateTileRow`s, soonest
  first, `Intl` in `America/Los_Angeles`), with the §1.2 toggle. RSVP'd rows
  where my answer is *maybe* append `· MAYBE` / `· QUIZÁ` to the mono
  when-line (plain-language honesty; the going/maybe words already exist at
  `events.rsvpGoing/rsvpMaybe`).
- **Empty state** (verified member, nothing upcoming): strata miniature +
  `Nothing on your calendar yet` / `Aún no hay nada en tu calendario` +
  `RSVP to a gathering, or join a group.` / `Confirma tu asistencia a un
  evento, o únete a un grupo.`
- **Connect to calendar** section at the bottom (§1.4) — the feed management
  home, per founder direction ("revocation/rotation from You").

Chronology is the only order (invariant 7). No count badges anywhere (:1518).

### 1.2 The view toggle — Agenda | Month

Appears on all three Upcoming surfaces: **Exchange Upcoming**, **group
Upcoming**, **My Calendar**. One shared server component.

- **Form**: two links in the segmented grammar at kicker scale — mono
  **10px** / 600 / .1em / UPPER, active = ink + 2px rust underline, inactive =
  ink-soft + transparent (segStyle :1901, stepped from 11.5px chip to the 10px
  kicker step so it reads as an *instrument*, subordinate to the real segment
  bar Board|Upcoming). Right-aligned in a hairline-bottomed row (on the group
  page: inline-right in the existing `UPCOMING` SectionLabel row).
- **Labels**: `Agenda · Month` / `Agenda · Mes`. (The founder's word
  "calendar" renders as **Month** in the UI — the view is a month grid, and
  Pattern 22 says name the thing plainly.)
- **State**: **URL param, not client state** — `?v=month`, agenda is the
  paramless default (agenda-first law). Server-rendered links, JS-optional,
  shareable, zero storage — the same `?s=1` doctrine the search reveal uses.
  `aria-current="page"` on the active one.

### 1.3 The month view (the in-register grid)

`?v=month` (+ `?m=YYYY-MM` to navigate, defaulting to the current Redmond
month; `?d=YYYY-MM-DD` to open a day). One server component, scoped by the
surface (all-my-boards / one group / my-calendar union).

Anatomy, top to bottom:

1. **Month bar** — `‹` link (juniper chevron 2.2, aria `Previous month` /
   `Mes anterior`) · centered mono 10px/600/.18em UPPER ink-soft month+year
   (`Intl`, e.g. `JULY 2026` / `JULIO DE 2026`) · `›` link. Juniper because
   these navigate (:916); rust chevrons are reserved for rows that open
   content (:890). Server clamps `?m` to a sane window (launch-year −1 …
   +5 years) — junk params render the clamped month, not an error.
2. **The grid — a real `<table>`** (semantic HTML law; `<caption>` holds the
   month+year for screen readers, visually merged with the month bar).
   - `<th scope="col">` weekday heads: `Intl` `weekday: "short"`, uppercased —
     mono 8.5px / 600 / .1em ink-soft (:883's spec, ink-soft because rust in
     the tile marks the *month*, not structure). Week starts Sunday (US
     locale default; `Intl` gives `DOM…` for es-US automatically).
   - **Cells**: hairline-bordered (border-collapse — the :882 tile box
     generalized to a lattice), paper ground, min-height 44px (AA tap
     target), vertically: day numeral + dot slot.
   - **Day numeral**: Besley 16px / 600 / ink (existing step :887; the tile's
     19px is for a hero numeral, too loud ×35).
   - **Out-of-month cells are empty** — no gray neighbors, no links to
     elsewhere ("define errors out of existence"; the ‹ › bar is how you
     leave the month).
   - **Today**: numeral in rust (the *active* position, :1513).
   - **Event presence**: a **single 5px rust dot** (`--r-round`) centered
     3px below the numeral — the unread-dot grammar (:2085) without its
     paper ring (no icon underneath to separate from). **One dot regardless
     of how many events** — presence, never a number (:1518). **Never
     per-category dots**: a category square may not appear without its label
     (:1493), so category speaks only in the day agenda below. **No text in
     cells** (founder direction; the grid is a summary instrument).
   - **Days with events are links** (`?v=month&m=…&d=…`), aria-label = the
     full `Intl` date + `— events scheduled` / `— eventos programados`
     (count-free, matching what sighted members see). Days without events
     are plain text, not focusable. The **selected day** gets bone fill +
     2px rust bottom rule (segStyle-active grammar :1901). Full keyboard
     path = the links in document order.
3. **The day agenda** — when `?d` is present, below the grid: a SectionLabel
   with the full date (`Intl`, long form) and that day's `DateTileRow`s —
   the exact agenda unit, category context in each row's when-line where the
   Board would show it. A tapped day with zero remaining events can't occur
   (only event-days are links). No `?d` → nothing below the grid; the grid
   is the summary, one tap opens a day.

Cost honesty: the whole view is one bounded query (the month's window ± the
day panel) and pure HTML/CSS — zero client JS, which answers X1 §7.4's "poor
on slow phones" objection at the root. The grid never becomes a home for
ranking, heat-mapping, or density signals (invariant 7): one dot is the only
mark it may ever carry.

### 1.4 Connect to calendar (feed management, on My Calendar)

Bottom of `/protected/account/calendar`, in the You data-register
(`yData`/`yDataSub` voice :1586/:1589 — this **is** a "your data leaves with
you" surface, promise-positive):

- **SectionLabel** `CONNECT TO CALENDAR` / `CONECTA TU CALENDARIO`.
- Body copy (13px ink-soft, plain language):
  `A private link your calendar app checks for updates. Anyone who has the
  link can read that calendar — treat it like a key. You can replace or
  remove it here anytime.` /
  `Un enlace privado que tu app de calendario consulta. Cualquiera con el
  enlace puede leer ese calendario — trátalo como una llave. Puedes
  reemplazarlo o quitarlo aquí cuando quieras.`
- **No feed yet**: one secondary hairline button (the :934 grammar)
  `Create calendar link` / `Crear enlace de calendario` → server action mints
  (§5.2) → the page re-renders with the feed row.
- **Per feed row** (personal first, then group feeds, hairline rows):
  - scope line — mono 10px: `MY CALENDAR` / `MI CALENDARIO`, or the group's
    name;
  - the URL in the copy-panel grammar (:936-938): bone box, hairline, mono
    9px label `PASTE INTO YOUR CALENDAR APP` / `PÉGALO EN TU APP DE
    CALENDARIO`, mono 11.5px selectable URL;
  - a quiet mono status line: `LAST READ <relative>` / `ÚLTIMA LECTURA …`,
    or `NEVER READ` / `SIN LECTURAS` — the member-visible leak detector
    (§7.4): *your* app polls hourly; a feed you disconnected that keeps
    reading means someone else holds the key;
  - actions: `Replace link` / `Reemplazar enlace` (rotate — old URL dies the
    moment the new one exists) and `Remove` / `Quitar` (delete), each a
    server action with a read-and-confirm step (Pattern 10: rotation breaks
    every app the member connected — deliberate, not effortless).
- **Group feeds are minted from the group page**: the group's Upcoming
  section gains an ActionLink `Connect to your calendar` / `Conecta con tu
  calendario` (members only — RLS enforces §5.2 regardless), which mints (or
  finds) that member's feed for the group and redirects to
  `/protected/account/calendar#feed-<id>`. **The URL itself renders in
  exactly one place** — the You management surface — so copies of the secret
  don't scatter across pages.

## 2. Strings (EN / ES, dictionary keys — moderator vocabulary per G-6)

New `calendar.*` block; a few keys land beside existing blocks where noted.

| key | EN | ES |
|---|---|---|
| `calendar.title` | My calendar | Mi calendario |
| `calendar.rowSub` (account row) | Your RSVPs and your groups' gatherings | Tus RSVP y los eventos de tus grupos |
| `calendar.dateline` | RSVPs · Your groups · Redmond time | RSVP · Tus grupos · Hora de Redmond |
| `calendar.voice` | Your gatherings in one column — what you answered and where you belong. | Tus encuentros en una columna — lo que respondiste y donde perteneces. |
| `calendar.segAgenda` | Agenda | Agenda |
| `calendar.segMonth` | Month | Mes |
| `calendar.maybeTag` | Maybe | Quizá |
| `calendar.emptyTitle` | Nothing on your calendar yet | Aún no hay nada en tu calendario |
| `calendar.emptySub` | RSVP to a gathering, or join a group. | Confirma tu asistencia a un evento, o únete a un grupo. |
| `calendar.prevMonth` / `nextMonth` (aria) | Previous month / Next month | Mes anterior / Mes siguiente |
| `calendar.hasEvents` (aria suffix) | events scheduled | eventos programados |
| `calendar.dayEmptyNote` — *not needed; empty days aren't links* | — | — |
| `calendar.gateTitle` | Verify to see your calendar | Verifícate para ver tu calendario |
| `calendar.gateBody` | Your calendar fills with your RSVPs and your groups — both start with verification. | Tu calendario se llena con tus RSVP y tus grupos — ambos empiezan con la verificación. |
| `calendar.gateCta` | Start verification | Iniciar verificación |
| `calendar.connectHeading` | Connect to calendar | Conecta tu calendario |
| `calendar.connectBody` | A private link your calendar app checks for updates. Anyone who has the link can read that calendar — treat it like a key. You can replace or remove it here anytime. | Un enlace privado que tu app de calendario consulta. Cualquiera con el enlace puede leer ese calendario — trátalo como una llave. Puedes reemplazarlo o quitarlo aquí cuando quieras. |
| `calendar.createLink` | Create calendar link | Crear enlace de calendario |
| `calendar.scopePersonal` | My calendar | Mi calendario |
| `calendar.pasteLabel` | Paste into your calendar app | Pégalo en tu app de calendario |
| `calendar.lastRead` | Last read {when} | Última lectura {when} |
| `calendar.neverRead` | Never read | Sin lecturas |
| `calendar.rotate` | Replace link | Reemplazar enlace |
| `calendar.rotateConfirm` | Replace this link? Apps using the old one stop updating until you paste the new one. | ¿Reemplazar este enlace? Las apps que usan el anterior dejarán de actualizarse hasta que pegues el nuevo. |
| `calendar.remove` | Remove | Quitar |
| `calendar.removeConfirm` | Remove this link? Apps using it stop updating. | ¿Quitar este enlace? Las apps que lo usan dejarán de actualizarse. |
| `calendar.groupConnect` (group page) | Connect to your calendar | Conecta con tu calendario |
| `calendar.feedNamePersonal` (ICS `X-WR-CALNAME`, bilingual — the poller has no locale) | Steppe — My calendar · Mi calendario | *(single bilingual value)* |
| `calendar.icsFeedDescription` | A Steppe community calendar. Details and RSVPs live inside Steppe. | *(feeds are consumed by apps; DESCRIPTION ships the EN string + the event URL — see §6.3)* |

Existing keys reused: `events.rsvpGoing/rsvpMaybe`, `events.addCal/icsNote/
icsDescription`, `exchange.segBoard/segUpcoming`, `groups.upcomingSection`,
`account.voice`. ~30% Spanish headroom respected throughout (:1511).

## 3. Routes & components

| piece | path | kind |
|---|---|---|
| My Calendar page | `app/protected/account/calendar/page.tsx` | server, Suspense + PageSkeleton, VerifiedGate |
| Feed actions | `app/protected/account/calendar/actions.ts` | server actions: mint (personal/group), rotate, remove — `useActionState` pattern |
| View toggle | `components/broadsheet/view-toggle.tsx` | server, shared by the three surfaces |
| Month grid | `components/broadsheet/month-grid.tsx` | server; props: events (id/starts_at), hrefBase, month, selectedDay, locale, dict |
| Shared ICS builder | `lib/ics.ts` | pure TS, isomorphic — used by the client button AND the feed route; adds the RFC 5545 TEXT escaping (`\` `;` `,` newlines) and 75-octet line folding **the current client builder lacks** (a fix the existing Add-to-calendar button inherits for free) |
| Feed endpoint | `app/cal/[token]/route.ts` | public GET, §6 |
| Migration | `migrations/0020_calendar_feeds.sql` | manual apply, §5 |

Exchange Upcoming and the group page take the toggle + grid with no query
changes beyond the month window; the events projection on the Board is
untouched.

## 4. My Calendar data (no new schema)

### 4.1 The union

```
mine := events e
        where e.status in ('active','cancelled')        -- cancelled shows struck in agenda? NO — see below
          and e.starts_at >= now()
          and not hidden('event', e.id)
          and (
                exists (select 1 from event_rsvps r
                         where r.event_id = e.id and r.user_id = me)
             or exists (select 1 from group_members gm
                         where gm.group_id = e.group_id
                           and gm.user_id = me and gm.status = 'active')
          )
        order by e.starts_at asc
        limit 200                                        -- bounded, like the Board's 100
```

- Implemented as two indexed client queries merged + deduped by id in the
  server component (the shipped Board already merges two species this way) —
  or one `.or()` — implementer's choice; **RLS remains the gate either way**
  (`ev_read = is_group_member(group_id)`, 0018), so a member who *left* a
  group silently loses that group's rows — including events they'd RSVP'd to
  inside it. That's correct: My Calendar never shows what the member can no
  longer read.
- The **page** shows `status = 'active'` only (matching the shipped
  Upcoming); the **feeds** include cancelled events with `STATUS:CANCELLED`
  (§6.3) so subscribed apps *update* rather than silently dropping a
  gathering the member planned around. The in-app surface always has the
  fresher truth; the feed needs the tombstone.
- Everyone-board events appear **only via RSVP** (see §0.1 — the
  `group_members` join excludes implicit Everyone membership by
  construction).

### 4.2 Month-window variant

The month view queries `starts_at` in `[first-of-month, first-of-next)` in
Redmond time (`lib/time.ts` `REDMOND_TZ`/`redmondWallTimeToUtcISO` already
hold the conversion), same scoping, no limit concern (a month at cohort scale
is dozens of rows).

## 5. Schema — `0020_calendar_feeds.sql` (manual apply only, stop-and-wait)

One table, three RPCs, 0018-style privilege determinism. **This is the only
migration C1 needs** — My Calendar and the month grid ship on existing schema.

### 5.1 The table

```sql
create table calendar_feeds (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references profiles(id) on delete cascade,
  group_id        uuid references groups(id) on delete cascade,  -- null = personal feed
  token           text not null unique,       -- the capability secret; column-grant-guarded (§5.3, §7.5)
  created_at      timestamptz not null default now(),
  rotated_at      timestamptz,
  last_fetched_at timestamptz
);

-- One feed per scope per member (partial unique indexes — the
-- posts_one_pin_per_board precedent; no PG15 'nulls not distinct' dependency).
create unique index calendar_feeds_one_personal on calendar_feeds (member_id)
  where group_id is null;
create unique index calendar_feeds_one_per_group on calendar_feeds (member_id, group_id)
  where group_id is not null;
```

Rationale:

- **`member_id` always — every feed has an owner**, even group feeds. A group
  feed is *a member's* capability onto a group they belong to, minted by them,
  revoked by them, and **dead the moment their membership ends** (checked at
  serve time, §6.2 — no cleanup job, fail-closed). There is deliberately no
  group-level "official public URL" in C1 — that's **⚑ C-G1**, §8.
- **Not append-only** — feeds are member-private operational state (like
  RSVPs), not part of the permanent record. Delete = revoke. No audit rows
  (minting a feed is not a consequence in the invariant-5 sense; it appears
  in the member's data export instead, §7.6).
- **An Everyone feed is legal** (`group_id` = the system row): every verified
  member may mint the whole-town calendar — it is exactly the Exchange
  Upcoming as a feed, and it's what the Vendor Markets season maps onto today
  (the markets are Everyone-board events tagged via 0017). Its serve-time
  membership check degenerates to `is_verified`, mirroring 0013's
  `is_group_member` special case.

### 5.2 RPCs (all `security definer`, `set search_path = public`)

| function | grant execute to | behavior |
|---|---|---|
| `mint_calendar_feed(p_group uuid default null) returns table (feed_id uuid, feed_token text)` | `authenticated` | Requires `is_verified()`; for `p_group`: `is_group_member(p_group)` and group not archived. Token = `encode(gen_random_bytes(32), 'hex')` (256-bit, pgcrypto already loaded schema.sql:24). **Idempotent**: an existing row for the scope is returned as-is (select-first; unique-violation race retries the select). The client never supplies a token — the server sets the secret (invariant-2 shape) |
| `rotate_calendar_feed(p_feed uuid) returns text` | `authenticated` | Owner-only (`member_id = auth.uid()`); writes a fresh token + `rotated_at = now()`. Old token is dead the instant this commits |
| `calendar_feed_payload(p_token text) returns jsonb` | **`service_role` ONLY** (the 0015 `increment_qr_count` posture — not even `authenticated` may call it; the feed route is the single caller) | Looks up the feed by token; returns `{ok:false}` when absent, owner missing/unverified, group archived, or (group feeds) the owner is no longer an active member — all four indistinguishable to the caller (no revocation oracle). On `ok:true`: stamps `last_fetched_at = now()` and returns `{ok, cal_name, events:[{id, title, starts_at, location, status}]}` per §6.2's scope rules |

**The serve-time RPC re-derives the owner's read scope in SQL** — it must
grant exactly what `ev_read` would grant the owner's own session, never more:
`security definer` bypasses RLS, so the membership/verified checks inside the
function ARE the policy. The §5.4 matrix pins this equivalence.

### 5.3 RLS + privileges (revoke-then-grant determinism, the 0018 lesson)

```sql
alter table calendar_feeds enable row level security;

create policy cf_read   on calendar_feeds for select to authenticated
  using (member_id = auth.uid());
create policy cf_delete on calendar_feeds for delete to authenticated
  using (member_id = auth.uid());
-- NO insert or update policies: mint/rotate go through the RPCs only.

revoke all on calendar_feeds from public, anon, authenticated;
grant select (id, group_id, token, created_at, rotated_at, last_fetched_at)
  on calendar_feeds to authenticated;   -- rows are owner-only via cf_read
grant delete on calendar_feeds to authenticated;
revoke execute on function calendar_feed_payload(text) from public, anon, authenticated;
```

`token` **is** selectable — by its owner only (RLS row-scopes it). That is a
deliberate plaintext-at-rest decision argued in §7.5 and flagged **⚑ C-G4**.
`member_id` is intentionally *not* in the select grant (the owner knows who
they are; nothing else ever reads the table).

### 5.4 Local dry-run matrix (`seed/matrix-0020.sql`, the 0018 pattern — single txn, personas, GUC ids, DO-block 42501 capture)

| # | case | expect |
|---|---|---|
| 0 | privilege determinism via `information_schema` | no insert/update grants to anon/authenticated; select grant lacks `member_id`; anon has nothing |
| 1 | anon: select / mint / rotate / payload | all refused (42501) |
| 2 | unverified member mints | refused |
| 3 | verified member mints personal | 64-hex token; **re-mint returns the same row** |
| 4 | member mints group feed; non-member and *pending* member refused; Everyone mint allowed | per §5.2 |
| 5 | cross-member: select and delete another's feed | invisible / no-op |
| 6 | rotate: owner gets a NEW token (old absent); non-owner refused | — |
| 7 | delete own feed | gone |
| 8 | payload (as service_role): personal = RSVP'd ∪ explicit-group events, deduped, hidden excluded, cancelled included with status | the §6.2 scope, exactly |
| 9 | owner leaves the group → personal feed drops that group's rows; their group feed returns `ok:false` | fail-closed, no cleanup needed |
| 10 | bogus / rotated-away token | `ok:false` |
| 11 | payload stamps `last_fetched_at` | visible to the owner via cf_read |
| 12 | payload as authenticated (even the owner) | refused — service_role only |
| 13 | RSVP'd event in a group the owner left | absent from personal payload (read-scope equivalence with ev_read) |

Emit, then **STOP for manual prod apply** (SQL editor, as owner). Nothing in
Part C ships before the apply is confirmed.

## 6. Feed serving

### 6.1 The endpoint

`GET /cal/<token>` (route handler `app/cal/[token]/route.ts`; an optional
`.ics` suffix is accepted and stripped — some calendar apps and members
expect it). Anon-reachable by design: calendar apps poll with **no auth
headers and no cookies** — the token in the path is the entire credential
(the capability model, §7.1).

Flow: shape-check the token (64 lowercase hex — anything else 404s without a
DB round trip) → `createAdminClient()` → `calendar_feed_payload(token)` →
`ok:false` ⇒ **404** (bare, cacheless; indistinguishable from
never-existed) → `ok:true` ⇒ build ICS via `lib/ics.ts` → 200.

Headers: `Content-Type: text/calendar; charset=utf-8` ·
`Cache-Control: no-store, private` · `Content-Disposition: inline;
filename="steppe.ics"`. No runtime pin (the 0015 route's cacheComponents
note). Rate limiting stays at the platform layer (Vercel), not in code —
noted in §7.3, not built.

`lib/supabase/admin.ts`'s doc comment ("ONLY … exactly two things") grows a
**third** enumerated use: serving calendar feeds — the one read RLS cannot
express because the caller has no auth context at all, guarded by a
service_role-only RPC that re-implements the owner's read scope (§5.2).

### 6.2 Scope rules (what each feed contains)

Window for both: `starts_at >= now() − 30 days` (so a gathering that just
passed doesn't vanish from the member's calendar mid-week) and all future,
ordered ascending, hard cap 500 rows (documented here — at cohort scale
unreachable; if it ever binds, the cap drops oldest-past first).

| feed | contains | never contains |
|---|---|---|
| **Personal** (`group_id is null`) | the §4.1 union *as the owner* — events they RSVP'd to (and can still read) ∪ their explicit groups' events; hidden-by-moderation excluded; cancelled included with `STATUS:CANCELLED` | other members' names or RSVP data; the owner's own RSVP **status** (going/maybe is in-app nuance; the event's presence is the signal) |
| **Group** (`group_id` set) | that group's events only, same window/tombstone rules; served only while the owner is an active member (Everyone: while verified) | any RSVP data, any member names, anything from any other group |

The exposure delta between the two — a personal feed reveals *attendance
intent*, a group feed only *the group's schedule* — is the load-bearing
distinction in §7.2.

### 6.3 The ICS document

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Steppe//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:<Steppe — My calendar · Mi calendario | Steppe — {group name}>
X-PUBLISHED-TTL:PT1H
REFRESH-INTERVAL;VALUE=DURATION:PT1H
BEGIN:VEVENT                              (per event)
UID:<event-id>@steppe.community           (matches the shipped button's UID scheme)
DTSTAMP:<event.created_at, UTC basic>
DTSTART:<starts_at, UTC basic>            (DTSTART-only — no end time in schema, §0)
SUMMARY:<title, RFC5545-escaped>
LOCATION:<location, escaped, when present>
STATUS:CANCELLED                          (cancelled events only)
URL:<origin>/protected/events/<id>        (tap-through lands on login → detail)
DESCRIPTION:<calendar.icsFeedDescription EN>
END:VEVENT
END:VCALENDAR
```

**Data minimization is the design**: no `ORGANIZER`, no `ATTENDEE`, no host
name, no event body (bodies are member prose; the feed carries what a
calendar needs — when, where, what it's called — and the URL points back
inside the membrane for everything else). This is what makes the §7.2
exposure table small enough to reason about. UTC `Z` stamps throughout —
calendar apps localize; no VTIMEZONE block needed.

## 7. Privacy design — the capability-URL threat model (REQUIRED section)

### 7.1 The model, named honestly

A feed URL is a **bearer capability**: possession = read access, no identity,
no expiry. That is the only shape calendar-app subscription supports (Google/
Apple/Outlook poll a URL with no headers), so the design question is not
*whether* bearer, but **how narrow the grant, how visible the use, and how
cheap the kill**.

- **Narrow**: §6.2/§6.3 — titles/times/places only; no names, no bodies, no
  RSVP fields; one scope per token.
- **Visible**: `last_fetched_at`, rendered on You (§1.4) — the member can see
  a key being used.
- **Cheap kill**: Remove (delete) and Replace (rotate) on You, single
  confirm; membership end kills group feeds *automatically at serve time*
  with no janitor (fail-closed §5.2).

### 7.2 What a leak actually exposes (the decision table)

| leaked token | the holder learns | member-data class |
|---|---|---|
| Personal feed | which gatherings this member intends to attend (RSVP'd events incl. Everyone-board ones) + the schedules of the groups they belong to — thereby *which groups they belong to*, inferable from content | **attendance intent + group membership — real member data.** In-app, RSVPs are already readable by any verified member (`rs_read = is_verified()`, schema.sql:1090) and the quiet count shows on event detail; the *delta* is exposure **outside the membrane**, unverified, unaccountable. ⚑ **C-G2** |
| Group feed (ordinary group) | that one group's event schedule | member content (G-2 class) scoped to one group; no people data. A members_only group's *existence + activity rhythm* leaks — worth naming: the directory already lists such groups by name (0013), so the schedule is the only new fact |
| Group feed (Everyone) | the community-wide calendar | the same set every verified member sees on Upcoming; still member content under the G-2 ruling — leaving the membrane via a *member's* key, which the ruling's capability logic permits (§7.7) but a *standing public URL* would not (⚑ C-G1) |

Both feed species carry **member-created content**; neither carries contact
info, addresses beyond event locations, or verification data (invariant 1
material never touches this system).

### 7.3 Attack surface & mitigations

| vector | answer |
|---|---|
| Token guessing / enumeration | 256-bit random (`gen_random_bytes(32)`), unique-indexed; shape-check before any query; uniform 404 for absent/revoked/dead (no oracle) |
| Token in transit | HTTPS-only deployment (HSTS via Vercel); the URL never appears in app links (only as selectable text on You), so no Referer bleed |
| Token in server logs | The token is path-material and will appear in platform access logs — named residual risk; mitigation is rotation + the narrow grant, not log surgery (we run no log analytics; invariant 8 posture) |
| Shared/forwarded URL (the social leak — the likely one) | The §1.4 copy says it plainly ("treat it like a key"); `last_fetched_at` makes sustained third-party use visible; rotation is one tap. The member sharing their own feed is the member exercising promise 4 over their own view — see §7.7 for where that logic hard-stops |
| Member leaves a group / gets unverified / deletes account | Serve-time checks (§5.2) kill group feeds instantly; personal feeds shrink to what the owner can still read (§4.1's logic mirrored in SQL); account deletion PURGES the rows via `delete_my_account()` (0020 amends it — the deletion path tombstones the profile rather than hard-deleting it, so the FK cascade alone would never fire; found in the four-lens review) |
| Polling volume / DoS | Cohort-scale non-issue; platform rate limiting; the RPC is one indexed lookup + one bounded select. **Not built in C1**, recorded here so it's chosen, not forgotten |
| A future scraper aggregating leaked feeds | The G-2 wall (§7.7): no directory of feeds exists, tokens are per-member, and rotation invalidates aggregation. Residual, accepted, named |

### 7.4 `last_fetched_at` vs "no behavioral tracking" (⚑ C-G3)

One timestamp, overwritten in place, member-visible on their own You surface,
readable by no one else (cf_read is owner-only), never aggregated, never an
input to ordering or any optimization (invariants 7/8). It is a **security
affordance for the member** — the difference between "is this key still in
someone's pocket?" being answerable or not. It is the same species as
`profiles`' own timestamps, not analytics. Flagged anyway (§8) because it is
a per-member access record and the privacy policy draft should name it.

### 7.5 Plaintext token at rest (⚑ C-G4 — the argued trade)

The token column stores the secret **in clear**, owner-readable via RLS
(§5.3), so the You surface can re-display the URL any time (the
Google-Calendar "secret address" model). The alternative — store a hash,
show the URL once — was **rejected** for C1:

- What hashing defends: an attacker with *read access to exactly this table*
  (a novel RLS hole scoped to it, or a partial dump). What it costs: every
  lost URL becomes a rotation + re-add across the member's devices — real
  friction on the routine path (Pattern 10 says spend member effort on
  *consequence*, not upkeep).
- An attacker with a **full** DB dump already holds everything the tokens
  guard — the events themselves — so hashing defends a strictly narrower
  breach than it appears to.
- The column is unreachable by any session but the owner's (RLS + column
  grants + no service-key reads outside the two named RPC paths), which is
  the same wall every other member secret in the system stands behind.

If a later security pass (or the cohort) wants hash-at-rest, the migration is
additive (hash column, backfill on rotate) — nothing in C1's design blocks
it. The decision is flagged for explicit sign-off, not slipped in.

### 7.6 Promise-4 alignment (data leaves with you)

Feeds ARE the export promise made continuous: the member's own calendar, in
an open format, consumable by any app, revocable by them alone. `calendar_feeds`
rows (sans token) join the account data export
(`app/protected/account/export/route.ts`), and account deletion removes them
with everything else. Nothing here is held hostage.

### 7.7 The G-2 interplay — anon polling vs. members-only (the sharp edge)

The G-2 ruling (DECISIONS.md 2026-07-12): member content is **members-only**;
anonymous read *"may only arrive later via a real governance vote, never a
config flip."* Feeds are polled anonymously — so is C1 violating the ruling
it cites?

**No — and the distinction must be kept sharp.** In C1, every feed is minted
*by a verified member, about content that member can read, under that
member's control, dying with that member's standing*. The anonymous HTTP GET
is the member's own delegated read — the same act as that member exporting
their data or copying event details into their own Google Calendar, made
continuous. Authorization happened at mint time and is re-checked at serve
time; the anon layer carries only the capability. That is inside the ruling.

**What is NOT inside the ruling — ⚑ C-G1, the sharp one:** a feed URL that is
*not* a member's capability — a standing, shareable, member-independent
**public group feed** ("put the Vendor Markets season on the city library's
website"). That is anonymous read of member content as a *standing grant*,
exactly what G-2 reserved for a governance vote. C1 does not ship it in any
form, and §8 drafts the ballot question instead.

## 8. G-class flags (collected — none may resolve silently)

| ⚑ | question | touches | recommendation |
|---|---|---|---|
| **C-G1** | **Public group feeds** — a member-independent calendar URL a non-member can consume (the Vendor Markets season on a poster, the library site, the city newsletter). Under the G-2 ruling this is anon read of member content: **a governance vote, never a config flip** | G-2 ruling · members-govern promise · verify-then-forget's *value* | **Not in C1.** Draft the ballot for the cohort (it can ride alongside the pending G-1 moderation-policy ratification): *"May a group's maintainers publish a public, read-only calendar feed of that group's events? Which groups? Everyone-board too?"* The draft should name both mechanics available when it passes: a group-level `public_feed` token (maintainer-minted, audit-logged) or a category-scoped Everyone feed (the markets are 0017-tagged Everyone events today — a Markets *group* is the cleaner home and can be part of the same proposal). Until that vote closes YES, the season reaches the public as it does today: the printed/QR surfaces |
| **C-G2** | **Personal feeds export attendance intent** (RSVP-derived member data) under a bearer capability | promise 4 (positively) · member-data posture | Ship as designed: minimized payload (§6.3), member-controlled, serve-time-scoped, leak-visible (§7.4), one-tap revocation. The Terms/Privacy draft (pending legal review) must gain a plain-language paragraph naming calendar links, what they contain, and that the member controls them |
| **C-G3** | `last_fetched_at` is a per-member access record | invariant 8 (no behavioral tracking) | Include (rationale §7.4): owner-visible only, security affordance, never aggregated or optimized on. Name it in the privacy draft alongside C-G2's paragraph |
| **C-G4** | **Plaintext token at rest**, owner-readable (vs. hash-and-show-once) | member-data protection posture | Adopt §7.5's trade explicitly in the decision record when C1 is approved — it should be chosen on the record, not inherited from a spec footnote |

## 9. Explicitly OUT of C1

| cut | where it's drawn | why it stays out |
|---|---|---|
| **Recurrence engine** (`event_occurrences`, rules, horizon job) | v2 §3 (:45-49) | Founder direction: dated instances stand (the wedge-1 markets pattern). Every C1 surface reads plain `events` rows and inherits recurrence transparently if it ever lands |
| **External calendar IMPORT** (consuming foreign ICS into Steppe) | founder direction | Write-side trust problem (unvetted content into member surfaces) — its own review |
| **Reminders / notifications** | v3 §8/§10 (tiers, email-canonical, opt-in SMS) | The notification layer is v3's, load-bearing and unbuilt; a calendar nudge is a *notification*, not a calendar feature |
| `event_saves` (bookmark ≠ RSVP) | v2 §3 :55 | §0.1 — RSVP is the save gesture; a second intention verb awaits a demonstrated need |
| `calendar_subscriptions` (follow/mute per group) | v2 §3 :54 | §0.1 — membership is the subscription; a mute preference is a future exception table |
| **Public/anon feeds of any kind** | §7.7 | ⚑ C-G1 → governance ballot, drafted not shipped |
| `ends_at` on events (real DTEND) | §0 | Noted schema gap (the bundle's demo data has ends :1712); a one-column migration + composer field *when event durations matter to members* — not smuggled in with C1 |
| Week view, day-view routes, mini-calendars elsewhere | — | The month grid + day agenda is the whole grid vocabulary; more views = more surface, no new capability |
| Category-filtered feeds (`?cat=` on feed URLs) | §8 C-G1 | Feed scopes stay exactly two (personal, group) until governance opens anything wider |
| CalDAV / two-way sync | — | Read-only ICS is the entire subscription contract |
| In-cell event text, per-category dots, counts, heat-mapping in the grid | :1493, :1518, invariant 7 | §1.3 — one neutral presence dot is the grid's permanent ceiling |

## 10. Build sequencing (for the eventual approved build — house gates apply)

1. **Part A — docs**: land this spec + the decision record (C-G2/C-G3/C-G4
   resolutions; the C-G1 ballot draft filed with the G-1 policy draft).
   One DCO-signed commit.
2. **Part B — UI on existing schema** (no migration dependency): My Calendar
   page + account row + `calendar.*` dictionary block (EN+ES) · shared
   view-toggle + month-grid components · toggle live on Exchange Upcoming,
   group Upcoming, My Calendar. Build green; a11y pass on the table grammar
   (caption, th scope, aria-labels, keyboard path) before merge.
3. **Part C — `0020_calendar_feeds.sql`**: migration + `seed/matrix-0020.sql`
   local dry-run (all 14 case groups green) → emit → **STOP for manual prod
   apply**. Nothing user-visible in Part D merges before the apply is
   confirmed.
4. **Part D — feeds**: `lib/ics.ts` (escaping/folding; refactor the existing
   Add-to-calendar button onto it) · `/cal/[token]` route ·
   Connect-to-calendar section on You · group-page mint link · admin.ts
   doc-comment third entry.
5. **Part E — tests**: `rls-refusals.test.ts` grows the §5.4 refusal rows;
   walkthrough: mint → fetch (payload shape) → rotate (old token dead) →
   leave group (feed dies) → delete. Build green, tests pass, push.
6. G-flags resolved **before Part C ships** (C-G1 needs only its ballot
   *drafted*, not voted, since C1 ships nothing public).

---

*Designed to the token law against the shipped bundle (609,798 B decompiled to
2,108 lines; zero calendar UI found, §0). This document is uncommitted by
design — review §1–§7, resolve the §8 flags, then it can land alongside the
decision record.*
