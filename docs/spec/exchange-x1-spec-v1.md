# Exchange (X1) — bundle extraction & build spec, v1

| | |
|---|---|
| **Status** | Draft for review — extraction is verbatim; §5–§8 are recommendations awaiting a decision. Nothing here is built. |
| **Source** | `public/preview-app/steppe-exchange.html` (the shipped design bundle, 609,798 B), decompiled to `inner.html` exactly as in `docs/audits/preview-parity-audit-v1.md`; every citation below is `inner.html:<line>` |
| **Companions** | `docs/audits/preview-nav-spec-v1.md` (nav law), `docs/spec/Steppe-Groups-Calendar-Exchange-Spec-v2.md` (product scope law), `docs/spec/Steppe-Spec-v3-Identity-Privacy-Exchange.md` (identity/jobs deltas), `docs/design/exchange-design-tokens-reference.css` (token law) |
| **Method** | Read-only. The bundle is the DESIGN law for X1; where the v2/v3 product specs are broader than the bundle, X1 takes the bundle's lighter cut and this doc says which v2/v3 machinery is deferred and why |

**G-class flags** — anything touching governance or the four entrenched promises
(landing `clauseA–D`: **no advertising, ever · verify residency then forget it ·
members govern by secret ballot · your data leaves with you**) is marked
**⚑ G-#** inline and collected in §9. None of §5–§8 may land while its flag is
unresolved.

> **Amendments (2026-07-12, DECISIONS.md).** Approved to build. Flags resolved:
> **G-1** ship the pin + policy draft to the cohort · **G-2** members-only (no
> anon read without a future governance vote) · **G-4** post-moderation (no
> pre-confirmation for posts) · **G-6** **moderator/moderación** — every
> "steward"/"el consejo" string is normalized at the dictionary layer; Part I
> below remains a verbatim record of the bundle. One §8 amendment: the post
> detail's action row ships with **no Report button either** (Report is the
> first fast-follow with the member-report intake, not an X1 surface).

---

## Part I — Extraction (verbatim from the bundle)

## 1. The Exchange tab

Initial state is `tab:'exchange', route:'feed'` — Exchange is the app's root
surface (:1151-1152, confirmed in nav-spec §1). The tab body (:494-605) stacks:

```
shell nav (bone, strata + masthead)          :424-493
├─ filter bar (paper, 2px ink rule below)    :497-509
├─ feed scroll (paper)                       :511-598
│   ├─ pull-to-refresh                       :514-521
│   ├─ skeleton (5 shimmer rows)             :523-540
│   ├─ PINNED feature (≤1, drop cap)         :542-560
│   ├─ post rows (Version A density)         :562-580
│   └─ empty state (strata + copy)           :584-597
└─ compose FAB "＋ NEW POST"                 :600-603
```

### 1.1 Category system (the fixed six)

`CAT` map (:1186-1193) + `FILTER_ORDER = ['all','need','offer','event','aid','job','goods']`
(:1194). The content model calls it a **fixed set** — "offer · need · event ·
aid · job · goods — fixed set; marker + label" (:1509). Colors are the token
law's category markers (`exchange-design-tokens-reference.css:33-35`):

| key | EN | ES | token | hex | app token (globals.css) |
|---|---|---|---|---|---|
| `need` | Need | Pido | `--cat-need` = `--rust` | `#A8542C` | `--marker-rust` |
| `offer` | Offer | Ofrezco | `--cat-offer` = `--sage-deep` | `#6E8A5B` | `--marker-sage` |
| `event` | Event | Evento | `--cat-event` = `--ochre` | `#A8842F` | `--marker-ochre` |
| `aid` | Mutual aid | Ayuda mutua | `--cat-aid` = `--slate` | `#4F6B7A` | `--marker-slate` |
| `job` | Job | Empleo | `--cat-job` = `--juniper` | `#36563D` | `--marker-juniper` |
| `goods` | Goods | Cosas | `--cat-goods` = `--goods` | `#8C6A45` | `--marker-goods` |

The filter bar renders **ALL** (ink square) + the six in `FILTER_ORDER`
(:1801-1806): 9×9 px square (`--r-marker` 2px radius), mono 11.5px/600/.1em
chip label, active = ink text + **2px rust underline**, inactive = ink-soft +
transparent underline; horizontal scroll with a 30px left fade (appears past
4px scroll) and 40px right fade (:1870-1871). Filtering is **filtering, not
ranking** — rows keep strict feed order within any filter (:1821-1830).

> The task brief listed "ALL/NEED/OFFER/EVENT/MUTUAL AID"; the bundle's actual
> set is the seven chips above (ALL + six categories, JOB and GOODS included).

### 1.2 Post row grammar (the feed unit)

Row assembly `mkRow` (:1808-1815), markup (:562-580). Anatomy, top to bottom:

- **Row box** — `padding: var(--row-rhythm) 0` (25px), `min-height: var(--row-min)`
  (64px), flex gap 14px, hairline bottom rule, press state = bone (:1813).
- **Avatar disc** — 44×44 monogram: `--sage` ground, ink initials, Martian Mono
  600/13px, circle (`mono()` :1653). 48px in detail, 52px in group header
  (COMPONENTS "Monogram" :1428).
- **Kicker line** (mono `--fs-kicker` 10.5px / 600 / `--ls-kicker` .12em / UPPER):
  9×9 category square + **CAT** (ink) + `· HOOD` (ink-soft, `text-overflow:
  ellipsis` — neighborhood truncates first) + `· TIME` (ink-soft, `flex:none` —
  **timestamp never truncates**; :567-571, content model :1508).
- **Title** — Besley **roman** `--fs-item` 24px / 600 / lh 1.22, **ink** (not
  juniper in rows), margin-top 9px (:1814).
- **Attribution line** (margin-top 10px) — NAME (mono `--fs-byline` 10px / 500 /
  .08em / UPPER, ink-soft, truncates) + **verified check** (12px, stroke
  `#36563D` juniper, stroke-width 2.4 — every author; "Verified neighbors
  only" :1519) + **rust chevron** 13px (stroke `#A8542C`, 2.4) pushed right
  with `margin-left:auto` (:574-578).
- **No leading blaze** on feed rows — the rust ▸ was removed from row kickers;
  the chevron carries the affordance (:562 comment, ASSETS :1495).

Times are relative and short — `12m · 40m · 1h · 3h · Tue` (EN) / `12 min ·
1 h` (ES) (:1508, POSTS data :1196-1218). Feed is **newest-first, no exceptions**
(:1517).

### 1.3 Pinned-by-stewards (the one drop cap)

At most ONE pinned feature renders — the first `pinned:true` post that matches
the active filter (`p.pinned && !pinned` :1822); other matches fall through to
plain rows. Anatomy (:542-560, :1822-1830):

- Kicker: 12px rust **flag** glyph (`M9 4h6l-1 7 4 3v2H7v-2l4-3-1-7z`, fill
  `#A8542C`) + `PINNED BY STEWARDS` — mono 10.5px / 600 / **.14em** / **rust**.
- Then the standard row header (44px disc + marker/CAT/·time kicker) but title
  in Besley `--fs-pinned` **26px / juniper** (rows are ink; pinned and detail
  titles are juniper — TYPE_SCALE :1470-1472).
- **Drop cap** — first character of the body floated left: Besley 600,
  `--fs-drop` **48px**, line-height **.72**, **rust**, padding `5px 10px 0 0`
  (:1827-1828). The standfirst is body chars 1–150 + `…` at 15px ink-soft
  lh 1.55.
- **Byline** — `— NAME · VERIFIED NEIGHBOR` mono 10px / 500 / .1em / UPPER,
  ink-soft, `clear:both` (:558, :1829).
- Constraint: "category pinning bar, pinned-by-stewards drop cap, compose
  fields" are Exchange-exclusive vocabulary (:1541); the drop cap lives
  **only** here ("Drop cap … pinned feature ONLY", TYPE_SCALE :1473).

**⚑ G-1** Pinning is a steward (moderator) editorial power — see §9.

### 1.4 Search, pull-to-refresh, skeleton, empty state

- **Search** — behind the round header slot (Exchange + Groups only,
  `showSearch` :1904-1917). Open state replaces the nav with a bone layer:
  paper input box (hairline border, 16px muted magnifier), placeholder
  `Search the Exchange` / `Buscar en el Intercambio`, juniper mono CANCEL
  (:483-493). Query matches `title + body + author name`, case-insensitive
  (:1799-1800); an empty result shows the empty state (below).
- **Pull-to-refresh** — drag from top (damping ×0.6, max 84px); release past
  **52px** triggers; spinner is a 13px ring with a rust top arc; labels
  `Pull to refresh → Release to refresh → Updating… → Updated just now`
  (:514-521, :1666-1671, COMPONENTS :1489).
- **Skeleton** — 5 rows of shimmer (44px disc + 42%/80%/55% bars), 1.2s sweep,
  1150ms simulated load (:523-540, :1184).
- **Empty state** — miniature strata SVG (402×64, sun at cx=322) +
  `A quiet column today` (Besley 20px) + `Nothing in this filter yet. Check
  back, or post the first.` (13.5px ink-soft) (:584-597).

### 1.5 Post composer (bottom sheet)

Sheet (:1026-1062): scrim `rgba(42,46,44,.34)`, grabber (40×4, `--grabber`),
1:1 drag-to-dismiss past 120px (:1745-1748). Header row: mono ink-soft
`CANCEL` · Besley 18px `New post` · mono **juniper 700** `POST`.

- **To-group banner** (only when composing from a group): bone strip, 8px sage
  dot, mono 10px `TO <GROUP NAME>` (`composeToPrefix` :1040-1042, :1604) —
  the composer is scope-aware: FAB on the Exchange feed → Everyone
  (`openComposeFeed` → `openCompose(null)` :1730), FAB on a group → that group
  (`groupPost` :1738).
- **Category picker** — the six category chips (no ALL), 10px squares, active =
  ink border + bone fill, default `offer` (:1044-1049, :1685, :1849-1853).
- **Title** — input, placeholder `A short, clear title` / `Un título breve y claro`.
- **Details** — 4-row textarea, `Add what a neighbor would want to know.` /
  `Agrega lo que un vecino querría saber.`
- **Neighborhood** — input, `Where it happens` / `Dónde ocurre`.
- **Privacy note** — bone box, sage-deep dot: `Your contact stays inside
  Steppe. Neighbors reach you here — never by SMS or email.` (:1056-1058, :1556).
- Field inputs are `.bp-in`: Schibsted 15px, paper ground, hairline border,
  square (`--r-flat`), juniper border on focus, `--placeholder` #9A937F
  (:402-404).
- Submit → toast `Posted · newest first` (or `Posted to <group>`) (:1687-1690).
  The toast copy itself restates the ordering promise.

### 1.6 Post detail

Push screen (260ms bpPush; :750-786):

- **Header strip** — bone, hairline bottom: juniper back control labeled with
  the parent masthead (`‹ The Exchange`), 32px round messages slot (M1).
- **Author block** — 48px disc + name (15.5px/600) + `▪ VERIFIED NEIGHBOR`
  (6px sage-deep square, mono 10px sage-deep) (:764-768).
- **Kicker** — 10px category square + CAT + `· hood · time` (mono 11px) (:770-773).
- **Title** — Besley `--fs-detail` 30px / 600 / lh 1.16 / **juniper**.
- **Body** — full text, `--fs-body-lg` 16px, lh 1.62, ink.
- **Primary action** — full-width juniper-deep letterpress button
  `Message <FirstName>` (:776) → the in-card message popup (:1087-1121). **M1.**
- **Secondary row** — `Save · Share · Report`, three equal hairline paper
  buttons (13.5px/600, inset top highlight; `secBtn` :2100).
- **Quiet line** — sage-deep dot + `Messages stay inside Steppe` (:783).

Toasts: `Saved to your list`, `Shared inside Steppe`, `Sent to a steward,
privately` (:1559).

### 1.7 How events relate (the bundle's two-species model)

The bundle keeps **two distinct species** and never merges them:

1. **EVENT-category posts** in the Exchange feed — plain posts wearing the
   ochre marker (the pinned repair-café post is `cat:'event'` :1204-1206).
   They open **post detail** — no RSVP, no When/Where structure.
2. **Structured events** live under **groups**: `GROUPS[].events` (:1236-1239
   et seq.) render in the group detail's **Upcoming** section (:879-894) as
   date-tile rows — 46px tile (hairline border; mono 8.5px **rust** month;
   Besley 19px day numeral), title 16px, mono 9px when-line, rust chevron —
   and open **event detail** (:912-944):
   - ochre mono kicker (group/host context), Besley 28px ink title;
   - `WHEN / WHERE / HOST` label rows (mono labels, 14.5px values);
   - RSVP chips `Going · Maybe · Can't` (:930-934, strings :1571-1572) with the
     quiet-count line `A quiet count — no names shared unless a neighbor opts
     in.` (:1572);
   - **Add to calendar** — hairline button (16px calendar glyph); generates a
     client-side `.ics` (VCALENDAR/VEVENT blob download) with a copy-details
     fallback panel showing the raw ICS text (:936-941, `addToCalendar`
     :1712-1718); toast `Calendar file ready · copy below if needed` (:1603);
   - full-width `Message host` button (M1).

So in bundle grammar: **the Exchange announces; groups schedule.** The current
app's `events` table (RSVP machinery, invariant-covered) corresponds to
species 2; species 1 is just a post category. §6 recommends how the live
events model maps onto this.

### 1.8 Shell strings for the Exchange tab

Masthead `The Exchange` / `El Intercambio`; dateline `Mon 22 Jun ·
Member-owned · No ads` / `lun 22 jun · De los miembros · Sin anuncios`; voice
`Posted by verified neighbors · newest first · nothing sorted for clicks.` /
`Publicado por vecinos verificados · lo más nuevo primero · nada ordenado por
clics.` (:1547-1548, :1610-1612). The dateline speaks two of the four promises
(**member-owned, no ads**) and the voice speaks the verification + no-ranking
posture — this copy is load-bearing, not decoration. **⚑ G-2.**

## 2. Fixed strings (verbatim EN / ES)

From `STR` (:1546-1645). X1-relevant keys only; Govern/You/thread keys stay in
the bundle for their own specs.

| key | EN | ES |
|---|---|---|
| `masthead`/`exchange` | The Exchange | El Intercambio |
| `dateline` | Mon 22 Jun · Member-owned · No ads | lun 22 jun · De los miembros · Sin anuncios |
| `voice` | Posted by verified neighbors · newest first · nothing sorted for clicks. | Publicado por vecinos verificados · lo más nuevo primero · nada ordenado por clics. |
| `all` | All | Todo |
| `pinned` | Pinned by stewards | Fijado por el consejo |
| `verified` | Verified neighbor | Vecino verificado |
| `postNew` | New post | Publicar |
| `post` | Post | Publicar |
| `cancel` | Cancel | Cancelar |
| `searchPh` | Search the Exchange | Buscar en el Intercambio |
| `emptyTitle` | A quiet column today | Una columna tranquila hoy |
| `emptySub` | Nothing in this filter yet. Check back, or post the first. | Aún no hay nada en este filtro. Vuelve luego, o publica el primero. |
| `categoryField` | Category | Categoría |
| `titleField` / `titlePh` | Title / A short, clear title | Título / Un título breve y claro |
| `bodyField` / `bodyPh` | Details / Add what a neighbor would want to know. | Detalles / Agrega lo que un vecino querría saber. |
| `hoodField` / `hoodPh` | Neighborhood / Where it happens | Barrio / Dónde ocurre |
| `composePrivacy` | Your contact stays inside Steppe. Neighbors reach you here — never by SMS or email. | Tu contacto se queda en Steppe. Los vecinos te encuentran aquí — nunca por SMS o correo. |
| `composeToPrefix` | To␣ | A␣ |
| `save` / `share` / `report` | Save / Share / Report | Guardar / Compartir / Reportar |
| `msgInside` | Messages stay inside Steppe | Los mensajes se quedan en Steppe |
| `pull` / `release` / `updating` / `updated` | Pull to refresh / Release to refresh / Updating… / Updated just now | Desliza para actualizar / Suelta para actualizar / Actualizando… / Actualizado ahora |
| `toastPosted` | Posted · newest first | Publicado · lo más nuevo primero |
| `toastPostedGroup` | Posted to␣ | Publicado en␣ |
| `toastSaved` / `toastShare` / `toastReport` | Saved to your list / Shared inside Steppe / Sent to a steward, privately | Guardado en tu lista / Compartido en Steppe / Enviado a un steward, privado |
| `tabs[0]` | Exchange | Intercambio |
| `evWhen` / `evWhere` / `evHost` | When / Where / Host | Cuándo / Dónde / Anfitrión |
| `evRsvp` | Are you coming? | ¿Vienes? |
| `evGoing` / `evMaybe` / `evCant` | Going / Maybe / Can't | Voy / Quizá / No puedo |
| `evAttend` | A quiet count — no names shared unless a neighbor opts in. | Un conteo tranquilo — no se comparten nombres salvo que un vecino lo elija. |
| `evAddCal` | Add to calendar | Añadir al calendario |
| `evIcsNote` | Add to your calendar — or copy these details | Añádelo a tu calendario — o copia estos datos |
| `evIcsToast` | Calendar file ready · copy below if needed | Archivo de calendario listo · copia abajo si hace falta |
| `gUpcoming` | Upcoming | Próximos |
| `gFeed` | Group posts | Publicaciones del grupo |
| `gPostTo` | Post | Publicar |
| `toastRsvp` | Thanks — your RSVP is in | Gracias — tu RSVP quedó |

ES note: `Fijado por el consejo` renders "stewards" as "el consejo" (the
council) and `toastReport` keeps English "steward" — the app's existing
vocabulary is "moderator"/"moderador". Terminology decision flagged **⚑ G-6**.

## 3. Dimensions & tokens digest

Everything is already in `exchange-design-tokens-reference.css` (the LAW) and
`app/globals.css`; X1 introduces **no new tokens**. Working set:

- Type (TYPE_SCALE :1461-1476): item title 24 roman ink · pinned 26 juniper ·
  detail 30 juniper · drop cap 48 rust (pinned only) · body 15/16 · kicker
  10.5/.12em · byline 10/.08em · chip 11.5/.1em · button 15.5/700.
- Spacing: `--pad-screen` 22 · `--row-rhythm` 25 · `--row-min` 64 ·
  `--fab-clear` 96 · hairline 1px · rule 2px.
- Markers: 9px squares in feed/filters, 10px in detail/composer, radius
  `--r-marker` 2px, ALWAYS beside a label (ASSETS :1493).
- Monogram discs: 44 rows · 48 detail · 52 group header (sage ground, ink).
- Motion: push 260ms · sheet 280ms · toast 200ms/2.2s dwell · shimmer 1.2s ·
  ease `cubic-bezier(.22,1,.36,1)`.
- Elevation: none; letterpress inset on primary fills; secondary buttons carry
  `inset 0 1px 0 rgba(255,255,255,.5)`.

## 4. Bundle constraints X1 inherits (verbatim, :1505-1529)

Content model: `Post { category, neighbor:{name, initials}, neighborhood,
time, title, body, pinned? }`; byline verified-only; time always visible;
categories fixed; every string keyed en/es with ~30% Spanish headroom.

Constraints (:1513-1528): rust accent-only · **no ads, no promoted/boosted/
ranked posts** · **chronological newest-first, never algorithmic** · no
engagement bait (likes/follows/badges/streaks/counts) · unread is a dot, never
a number · contact stays inside Steppe · verified neighbors only · WCAG 2.1 AA
· no dark patterns (Cancel as reachable as Confirm) · the four Govern
constraints (secret ballot, 1×–3× tenure weight, anti-bandwagon turnout-only,
revisable-until-close) — untouched by X1 but restated because the Exchange
shell shares the Govern nav (:1911-1912). **⚑ G-5.**

---

## Part II — Recommendations (decision-ready; each is THE proposal, with rationale)

## 5. Schema — posts, categories, group association

**Recommendation: one migration pair, manual-apply only, mirroring 0013/0017
conventions.** Nothing auto-applies; both stop for your SQL-editor run.

### 5.1 `posts` (migration 0018)

```sql
create type post_category as enum ('need','offer','event','aid','job','goods');

create table posts (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id),        -- Everyone = the system row
  author_id       uuid not null references profiles(id) on delete cascade,
  category        post_category not null,
  title           text not null check (char_length(title) <= 160),
  body            text not null check (char_length(body) <= 4000),
  neighborhood_id uuid references neighborhoods(id),          -- nullable = "All of Redmond"
  pinned_at       timestamptz,                                -- steward-set only (§5.3)
  pinned_by       uuid references profiles(id),
  created_at      timestamptz not null default now(),
  edited_at       timestamptz
);
create unique index posts_one_pin_per_board on posts (group_id) where pinned_at is not null;
```

Rationale, point by point:

- **Category = a new fixed enum, NOT the 0013 categories table.** The bundle is
  explicit — "fixed set; marker + label" (:1509). The 0013 taxonomy (12 broad,
  open-to-suggest — v2 §6) classifies **groups**; the six post categories
  classify **speech acts** (I need / I offer / it's happening / mutual aid /
  job / goods). Conflating them would let the taxonomy drift the feed's fixed
  chip bar. v3 §3–4 already treats `job`, `goods` (free/common), `aid` as the
  bounded "inclusive-eligible" category *types* — an enum makes that bound
  checkable. (The 0017 interim `events.category_id` keeps pointing at the 0013
  table for the market tags; convergence note in §6.3.)
- **`group_id NOT NULL`, Everyone = the system group row.** `is_group_member()`
  (0013 :60-68) already answers true for every verified member on the system
  `everyone` row — the deep module exists; use it. One RLS expression covers
  the Everyone board and members-only groups with zero special cases. The
  composer's default target is the Everyone id (bundle: feed FAB composes
  scope-less :1730; group FAB composes to the group :1738).
- **`neighborhood_id` FK, not the bundle's free-text hood.** The app has 35
  seeded neighborhoods and an events precedent (`events.neighborhood_id`,
  render "All of Redmond" when null). Free text invites PII and typos; the
  composer's Neighborhood field becomes the existing neighborhood picker.
  Display truncation behavior (hood truncates, time never) is unaffected.
- **No lifecycle columns (open/fulfilled/expired) in X1.** The bundle shows no
  lifecycle UI. v2 §4's listing lifecycle (`open → fulfilled/closed/expired`,
  `expires_at`) is real future scope — add as a column-only migration when the
  Exchange graduates to full listings; premature states are dead weight now.
- **No `status` column for moderation.** Removal/restore rides the existing
  `moderation_actions` + `is_content_hidden()` path (`target_type` is free
  text — `'post'` needs no enum change, schema.sql:160) — legible, appealable,
  P7-consistent. Author hard-delete allowed (own rows), like `ev_delete`.

### 5.2 `events.group_id` (same migration)

```sql
alter table events add column group_id uuid references groups(id);
update events set group_id = (select id from groups where slug='everyone' and is_system);
alter table events alter column group_id set not null;
```

Backfill-to-Everyone preserves today's behavior exactly (all events are
community-wide) and gives group calendars a home (§7). One `log_audit` row
records the backfill (G13). Events RLS gains the same `is_group_member(group_id)`
term (read) and membership check (insert) — see §5.3.

### 5.3 RLS posture (mirrors schema.sql events block :1077-1090 + 0013 G8–G10)

| policy | rule |
|---|---|
| `po_read` | `is_group_member(group_id)` — Everyone board readable by every verified member (system-row special case); members-only groups scoped to active members (G8). **No anon read** in X1: v2 G6's public read of public-group posts is a deliberate, separate exposure decision — **⚑ G-2** |
| `po_insert` | `is_verified() and author_id = auth.uid() and is_group_member(group_id)` — post-where-you-belong; server pins the author (invariant 2 shape) |
| `po_update` | author only, and a `guard_post_columns` trigger **freezes `pinned_at`/`pinned_by` on self-edit** (the trg_guard_profile_columns pattern — the client can never pin itself); sets `edited_at` |
| `po_delete` | author only (moderators never quiet-delete — remove via moderation_actions, G4/P7) |
| pinning | a `set_post_pin(post_id, pin boolean)` security-definer function, `is_moderator()`-gated (Everyone board) or maintainer-of-that-group (G9), writing `log_audit('post.pinned'/'post.unpinned', …)` (G13). ≤1 pin per board enforced by the partial unique index |

Then `rls-refusals.test.ts` grows the matching refusal rows (anon read, cross-
group read, self-pin, client-supplied author) before beta, per the v2 §9 gate.

### 5.4 What 0018 does NOT contain

No saves/bookmarks, no shares, no reports table, no response threads, no
`listings` table, no chat — §8 lists each with its trigger condition.

## 6. Nav migration — Events tab → EXCHANGE

The nav-spec wrote this rule in advance (preview-nav-spec-v1.md §Slot-1):
Events holds slot 1 only until X1; then "Exchange takes slot 1 and Events
folds into its bundle-native homes (an Exchange category + per-group Upcoming)
— one deliberate migration, no placeholder era."

**Recommendation:**

1. **Tab**: `nav-destinations.ts` slot 1 becomes
   `{ key: "exchange", href: "/protected/exchange", label: dict.nav.exchangeLink }`
   — labels `Exchange` / `Intercambio` (bundle tabs :1560/:1614; tab bar shows
   UPPER). Events ceases to be a tab; nothing else in the shared source moves.
2. **The feed is one surface, two species** (per the bundle's own model, §1.7):
   `/protected/exchange` lists **posts** (rows per §1.2) and — so the town
   square actually contains the town's happenings — **upcoming `events`
   projected into the same feed as EVENT-category rows** (a UNION in the feed
   query, ordered by one shared clock; event rows open the existing event
   detail with RSVP, post rows open post detail). No duplicated rows, no
   double-entry: events remain authored once, in the events machinery.
3. **The composer's EVENT chip routes, not writes.** Tapping EVENT in the
   compose sheet routes to `/protected/events/new` (the structured When/Where/
   RSVP form) instead of creating an unstructured post that can't RSVP —
   "define errors out of existence." The other five chips write `posts`.
4. **Per-group Upcoming**: group detail gains the bundle's Upcoming section
   (:879-894 date-tile grammar) listing that group's events via `events.group_id`;
   the group FAB's composer (to-group banner :1040) covers posts.
5. **Route redirects** (mirror the `transparency → governance/record`
   precedent — a 2-line `redirect()` page):
   - `/protected/events` → **307** `/protected/exchange?f=event` (the filter
     preselected — the list's true successor);
   - `/protected/events/[id]` **stays canonical** (event detail keeps its URL —
     printed QRs, emails, and RSVP links never break);
   - `/protected/events/new` **stays** (the EVENT chip's target).
6. **Dictionary**: `nav.eventsLink` retires from nav use (the events dateline/
   voice strings move to the EVENT-filtered header context or retire); new
   `nav.exchangeLink`, `exchange.*` block per §2's table, EN+ES paired.

The events *pages* (detail, new, RSVP internals) do not move or change owner —
only the tab identity and the list surface do.

## 7. Calendar

**The bundle contains no calendar UI.** Stated plainly: there is no month
grid, week strip, or date-picker view anywhere in the 2,108-line source. The
bundle's whole calendar vocabulary is: the **Upcoming** date-tile list rows in
group detail (:879-894), the **event detail** with When/Where/Host + RSVP
(:912-944), and **Add to calendar** exporting a client-side `.ics` with a
copy-details fallback (:936-941, :1712-1718) — i.e., *your* calendar app is
the calendar; Steppe is the source of truth that feeds it. The Everyone seed's
"board and calendar" (0013 :101-105) is satisfied by the board + the
chronological events view.

**Recommendation (in-register, no new tab):**

1. **Exchange gains a second segment** — `Board | Upcoming` — using the exact
   segmented-control grammar the bundle already uses twice (Groups
   Yours/Discover, Govern Ballots/Record; `segStyle` :1901: mono chip, active
   = ink + 2px rust underline). *Board* = the §6 feed. *Upcoming* = an
   **agenda list**: upcoming occurrences grouped under mono date headers,
   each row in the bundle's 46px date-tile grammar. Chronological-only —
   an agenda is a sort order, not a ranking (invariant 7 safe).
2. **Group calendar = the group's Upcoming section** (§6.4). Same component,
   filtered by `group_id`.
3. **Ship Add-to-calendar (.ics)** on event detail — bundle-verbatim behavior,
   client-side blob, zero server state, works offline.
4. **Explicitly deferred**: month grid (out of bundle register, poor on slow
   phones); v2 §3's `event_occurrences`/recurrence materialization and horizon
   job (the market seed's dated instances stand in adequately); v2's
   `calendar_subscriptions` + `event_saves` ("My Calendar" aggregation — real
   scope, absent schema, not bundle-drawn); ICS *feed subscription* URLs
   (server-generated calendars are a privacy surface — needs its own review).

## 8. Explicitly OUT of X1

| cut | evidence it's drawn in the bundle | why it stays out |
|---|---|---|
| **Messages (M1)** — header icon + unread dot, inbox, thread, in-card popup, post detail's primary `Message <name>` button, `Message host` | :442-455, :788-853, :1087-1121, :776 | Whole subsystem (channels/DMs, v2 §5). X1 post detail ships **without the primary message button** and without the messages header slot; the `msgInside`/`composePrivacy` strings stay reserved. The detail's action row is Report-only until M1 (below) |
| **Save / bookmarks** (`toastSaved`, You-tab "Saved · 5 listings") | :779, :1589 | No saves schema; per-member private lists are v2 `event_saves`-adjacent. Reserve the string |
| **Share** (`toastShare` "Shared inside Steppe") | :780 | In-app share needs a recipient (M1) or a copy-link affordance decision; defer with M1 |
| **Report** (`toastReport` "Sent to a steward, privately") | :781 | **No member-initiated report mechanism exists** (moderation_actions are moderator-initiated; appeals are post-hoc). A `reports` intake table is small but new, and it's moderation tooling beyond pin — out of X1, flagged as the FIRST fast-follow since a feed without a report path shifts load to word-of-mouth. **⚑ G-6** |
| **Moderation tooling beyond pin** — steward queues for posts, pending states | v2 §3/§8 | X1 reuses remove/restore + appeals as-is; pin (§5.3) is the only new power |
| **Listings lifecycle** (offer/request typed listings, open→fulfilled→expired, respond threads) | v2 §4, v3 §3 | X1 posts are the lighter bundle cut; listings graduate later on the same table (§5.1 rationale) |
| **Anonymous submission** (v2 G7 pending-intake) | v2 §3 | Public-facing write path; own review |
| **Neighbor tier / inclusive-category posting override / per-group messaging toggle** | v3 §1/§4/§5 | The membership-tier system doesn't exist in the app; X1 posting stays verified-member-only. **⚑ G-3** |
| **Membership/dues row** (You-tab `$4/mo · hardship waiver available`) | :1592 | **No payments in the prototype** (CLAUDE.md); the cohort is free. **⚑ G-3** |
| **Recurrence engine** (`event_occurrences`, horizon job) | v2 §3 | Deferred; dated instances (wedge-1 pattern) suffice for the cohort |
| **Realtime chat** | v2 §5 | Post-X1, post-M1 |
| **Public/anon read of public-group posts** (v2 G6) | v2 §2/§7 | Exposure decision, not a build detail. **⚑ G-2** |

Everything in this table has its strings already extracted (§2) so the cut is
reversible without re-decompiling.

## 9. G-class flags (collected — none may resolve silently)

| ⚑ | question | touches | recommendation to put to the cohort/founder |
|---|---|---|---|
| **G-1** | **Steward pinning** is a human editorial power over the feed's top slot. Invariant 7 allows no ranking; a pin is not an algorithm, but it IS curation. | Invariant 7 · promise "members govern" | Ship it (bundle-native, member-visible — the kicker names its actor: "Pinned by stewards"), but name the power in the moderation policy the cohort ratifies, and require every pin/unpin to be audit-logged (§5.3 does). One pin per board keeps it a noticeboard, not a ranking |
| **G-2** | **Who can read the Exchange?** X1 keeps verified-members-only (current events posture). v2 G6 later opens public groups' posts to anonymous readers. | Verify-then-forget promise (verification's *value*), member-data posture | Defer anon read out of X1; when proposed, it goes through governance as a real vote, not a config flip — it changes what "members-only" means on the public web |
| **G-3** | **Posting rights & tiers.** v3's Neighbor tier + inclusive-category override + dues UI presume membership tiers and payments. | "Members govern" + the no-payments prototype rule | X1: verified members post, full stop. Tier/dues surfaces stay out until the payments decision (post-launch, cohort-ratified) |
| **G-4** | **Everyone-board publication model.** v2 §3 requires *pre-confirmation* (moderator confirms before an Everyone event publishes); the app today — and X1 posts per this spec — publish immediately with post-hoc moderation (remove + appeal). Prior restraint vs. post-moderation is a speech-governance posture, not an implementation detail. | Invariant 5 (humans decide *consequence*) · members-govern promise | Recommend **post-moderation** for X1 posts (consistent with live events, keeps humans deciding removal rather than permission); put the v2 pre-confirm divergence on the governance docket explicitly so it's chosen, not drifted into |
| **G-5** | Exchange shares the shell with Govern; the Govern dateline/voice carry CD-1 ballot-secrecy + anti-bandwagon language (:1911-1912). | Secret-ballot promise | No X1 coupling to votes exists or may be added; feed data must never join ballot data (restated so a future "turnout post" idea meets a written wall) |
| **G-6** | **"Steward" vs "moderator"** (`Pinned by stewards`, `Sent to a steward, privately`; ES `el consejo`). The app, schema, and Terms say moderator. | Plain-language pattern 22 · governance-doc naming | Pick ONE word before X1 strings land; recommendation: keep **moderator/moderador** in-app (matches Terms + appeals flow) and treat "steward" as bundle voice to be normalized — or adopt "steward" everywhere via a deliberate rename that includes the governance docs. Either way, one word |

## 10. Migration & sequencing sketch (for the eventual approved build)

1. `0018_posts.sql` (+ the events.group_id alter) — **manual apply, stop-and-wait**,
   RLS + guard trigger + pin function + audit; local dry-run matrix first.
2. Seed nothing (the Exchange starts honestly empty — the empty state is
   designed: "A quiet column today").
3. UI phase 1: `/protected/exchange` feed (Board) + composer (5 writing chips +
   EVENT routing chip) + post detail (no message button) + redirects + tab swap.
4. UI phase 2: Upcoming segment + group Upcoming + .ics.
5. `rls-refusals` + walkthrough extensions; es.json/dictionary fluent pass.
6. G-flags G-1/G-4/G-6 resolved **before** step 3 ships to the cohort.

---

*Extraction verified against the shipped bundle (609,798 B). This document is
uncommitted by design — review §5–§9, resolve the flags, then it can land
alongside the decision record.*
