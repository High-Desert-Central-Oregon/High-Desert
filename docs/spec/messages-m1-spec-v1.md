# Messages (M1) — bundle extraction & build spec, v1

| | |
|---|---|
| **Status** | Draft for review — Part I is verbatim extraction; Part II is recommendations awaiting a decision. Nothing here is built |
| **Source** | `public/preview-app/steppe-exchange.html` (the shipped design bundle, 609,798 B, blob 93a0c926), decompiled to `inner.html` (2,108 lines) exactly as in the X1/nav extractions; every citation below is `inner.html:<line>` |
| **Companions** | `docs/spec/exchange-x1-spec-v1.md` (X1 law; its §8 reserved every messaging string this spec un-reserves) · `docs/spec/Steppe-Groups-Calendar-Exchange-Spec-v2.md` §5 (chat prior art — the heavier scope M1 cuts) · `docs/spec/Steppe-Spec-v3-Identity-Privacy-Exchange.md` §5/§8 (connect semantics; the notification tier model M1 must NOT preempt) · `docs/spec/calendar-c1-spec-v1.md` §7 (the privacy-section format this doc follows) |
| **Method** | Read-only. The bundle is the DESIGN law; where it depicts machinery beyond M1 (group counterparts, media buttons), Part I records it verbatim and Part II says what the lighter cut defers and why |

**G-class flags** — anything touching governance or the four entrenched promises
(**no ads ever · verify residency then forget it · members govern by secret
ballot · your data leaves with you**) is marked **⚑ M-G#** inline and collected
in §9. None of §5–§8 may land while its flag is unresolved. The privacy
architecture (§6) is itself a G-class posture decision.

> **Amendments (2026-07-13, DECISIONS.md).** Approved to build. Flags
> resolved: **M-G1** plaintext-with-RLS ratified on three binding conditions
> (the behavioral zero-read pin, the honest Terms paragraph, the full E2E
> costing on the record) · **M-G4** Reports are Part 1 (the valve before the
> channel; consent-based excerpt disclosure only) · **M-G2** bodies survive
> account deletion, identity tombstones — signed; the deletion-copy amendment
> is owed (Part 4) · **M-G3** silent block — the bundle's "a steward was
> notified" string is NOT shipped in any form · **M-G5** the event
> "Message the host" button is deferred entirely (no counterpart that can
> answer) · **replies-as-DMs** recorded as chosen, not omitted ·
> **M-G6** no message rows in the audit log · **M-G7** the 10/day new-thread
> cap lives in provisional config. Build sequence: 0021 → this record →
> 0022 → UI → Terms + tests.

---

## Part I — Extraction (verbatim from the bundle)

## 1. The messaging surfaces

### 1.1 Shell header slots (every tab, both nav states)

The expanded nav's top-right holds a 9px-gapped pair of 34×34 round paper
slots, hairline-bordered (:446-455): **search** (conditional per tab,
`showSearch` :447) and **messages** (:452-455) — *unconditional, on all four
tabs*. The messages glyph is the 17px speech bubble (1.8 stroke, ink); its
**unread dot** (:454 → definition :2085) is a 9px rust circle with a 2px
paper ring, absolutely placed top −1 / right −1, shown iff *any* thread is
unread (`hasUnread = convos.some(c => c.unread)` :1839) — `display:none`
otherwise. The compact (scrolled) nav keeps both slots and the dot
(:465-479). Constraint law: *"Quiet signals only — unread is a DOT, never a
number"* (:1518).

The **post-detail header** carries a second, smaller messages slot: 32×32
round paper, same glyph at 16px, same dot (:757-760); the group-detail and
inbox headers do not.

### 1.2 Inbox (:788-814)

Push screen (`bpPush` 260ms) titled by a bone header strip: juniper back
control labeled with the parent masthead (:792-793) + Besley 19px/600
`Messages` (:795). Below it, a full-width quiet strip (:797): 6px sage-deep
dot + `msgInside` in mono 9.5px/500/`--ls-kicker` UPPER ink-soft — the
privacy line is *architecture on screen*, shown before any content.

Rows (:799-811), `padding 16px 22px`, hairline-bottom, press = bone:

- 44px sage monogram (`mono()` :1841);
- name 15px ink — **700 when unread, 600 read** (:1843);
- right-aligned `when` in mono 10px/.06em ink-soft (:805) — per-THREAD only:
  clock time for today (`9:21`), weekday otherwise (`Tue`/`mar`; CONVOS
  :1221-1226). **No per-message timestamps exist anywhere in the bundle**;
- context line: mono 9.5px/600/.1em UPPER **rust** — `RE: <listing title>`
  (:807);
- preview: last message body, 13px, one-line ellipsis — ink when unread,
  ink-soft read (:1844);
- a 9px **rust dot** when unread; a 9px *empty spacer* when read, so the row
  never reflows (:1845).

`tEmpty` (*"No messages yet — say hello to a neighbor."* :1598) exists as a
string but the inbox markup renders nothing when the list is empty — the
empty state is reserved for the app.

### 1.3 Thread (:816-853)

Header (bone, `9px 14px`): juniper back chevron (icon-only, :820) · **32px
monogram** (mono 11px — the thread-header size from the Monogram law,
:1849/:1428) · name 15px/600 · a context line that is **a live control**:
rust mono 9px/600/.08em UPPER, truncating, with a 10px rust chevron (2.6
stroke) — tapping it opens the anchoring listing
(`openListingFromThread` :1850, stub-toast *"Opening the listing this is
about"* :1779) · a 32px ⋯ menu button (three r=1.7 dots, ink-soft → ink on
press, :826).

Body (:828-832): a centered watermark repeats `msgInside` in mono 9px,
`--placeholder` color (:829). Bubbles (:1851-1854):

| | mine | theirs |
|---|---|---|
| ground / text | `--juniper-deep` / paper | `--bone` / ink |
| radius | 14 14 **4** 14 (tail lower-right) | 14 14 14 **4** |
| size | max-width 78% · 10px 13px pad · 14.5px / 1.45 | same |
| row | flex-end, margin 7px 0 | flex-start |

Only the **last own** message carries a state: `Sent` in mono 8px/500/.1em
UPPER at paper-70%, right-aligned inside the bubble (:1851-1852). `tSending`
(*"Sending…"*) exists (:1597) but the demo never shows it. **There are no
read receipts, no "seen", no delivered ticks** — the dot is the entire read
vocabulary.

Composer bar (bone, hairline-top, :834-838): a 34px hairline **attach**
button (photo glyph) — **stubbed**: it toasts `toastAttach` (*"Photo &
location share live in the app"* :1600, handler :1706/:1778) · the `.bp-in`
input, placeholder `threadPh` (*"Write a message…"* :1557) · a 42×42 square
**send** button, paper arrow 18px — juniper-deep when the draft is non-empty,
`--grabber` gray + `not-allowed` otherwise (:2091, :837).

### 1.4 Thread menu (:840-851, :2024, :1773-1777)

⋯ opens a scrim + bottom sheet (grabber, hairline rows 15px/500, mono CANCEL
footer): **Mute this conversation** (ink) · **Leave conversation** (ink) ·
**Block neighbor** (rust) · **Report to a steward** (rust). Demo behavior
(:1773-1777): mute → toast `toastMuted` (*"Muted — you won't be notified"*);
leave → `toastLeft` + return to inbox; block → `toastBlocked` (*"Blocked · a
steward was notified"*) + return to inbox; report → `toastReport` (*"Sent to
a steward, privately"*). PATTERNS: *"⋯ → mute / leave / block / report with
plain-voice confirmations; leave/block return to inbox"* (:1475). None of
the four mutates the demo's data — depiction only.

### 1.5 The in-card message popup (:1087-1121)

*"rises within the post/group/event card (scrim + 1:1 drag sheet) · anchored
"Re: listing" · … · writes the SAME thread shown in the inbox (one store, no
duplicate channel)"* (COMPONENTS :1454). Anatomy: z-11 scrim + bottom sheet
(grabber; 1:1 drag-dismiss past 120px, :1703-1705). Header: **46px** monogram
(mono 14px, :~1608 assembly) + name 15.5px/600 + rust `Re: <listing>`
truncating + mono CANCEL. Composing state: 3-row `.bp-in` textarea,
placeholder `mcPh` (*"Write a quick note…"*); a row of 36px hairline photo +
location buttons — **both stubbed** to `toastAttach` (:1112-1113, :1706) —
and a flex-1 **Send** (letterpress juniper-deep; `--grabber` +
`not-allowed` until the draft is non-empty, :1114/:~1609). Below, the
`msgInside` quiet line again (:1116). Sent state (:1101-1107): 48px
juniper-deep check disc, Besley 21px `Sent`, sub `mcSentSub` (*"It's in your
Messages now — reply anytime."*); the sheet self-dismisses after 1400ms with
toast `mcToast` (*"Message sent · stays inside Steppe"*) (:1697-1702).

### 1.6 Entry points ("Message ___")

PATTERNS: *"Message ___ (post detail · group post · event host) → composer
rises within the card, anchored to the listing; Send confirms in place and
continues the SAME inbox thread (no separate channel)"* (:1476).

1. **Post detail** — the full-width letterpress juniper primary button
   (:777), label `Message <FirstName>` / `Mensaje a <FirstName>` (:1834,
   `firstName` :1654), opening the popup anchored to the post title.
2. **Event detail** — the same button (:941), label `Message the host` /
   `Escribir al anfitrión` — and the counterpart is **the group identity**
   (`openMsgCard(grp.name, grp.init, ev.title)` :1958), not a person. (A
   vestigial `eventMessage` handler + `toastMsg` string :1737/:1559 predates
   this and is dead code.)
3. **Group-post rows** — tapping a group-feed post row opens the popup
   **to its author** anchored to the post title (:1942, markup :897); the
   row's mono `N replies` count (:902) is therefore a count of *DM replies
   through the same store*, not a comment thread. The bundle has no comment
   feed anywhere.

### 1.7 The bundle's messaging model (what the data says)

`CONVOS` (:1220-1227): each thread = `{name, init, ctx: 'Re: <title>',
unread, when, msgs: [{me, en, es}]}`.

- **One thread per counterpart.** `openMsgCard` matches an existing convo
  **by counterpart name** (:1693); a new context does NOT open a second
  thread — the message appends to the existing one and the ORIGINAL `Re:`
  anchor is kept (:1699). No thread ever has two counterparts; no group
  threads exist in the store (but see the next point).
- **A counterpart may be a collective.** Thread 2 is with *"Repair
  Collective"* re: the repair-café event (:1223) — the depicted "host"
  entity for a group event is the group itself (matching :1958).
- **What starts a thread:** always a listing contact — post author, group
  post author, or event host (:1476). There is no cold-open compose, no
  directory DM, no "new message" button anywhere in the bundle.
- **Read state:** boolean per thread. Opening a thread clears it (:1679);
  sending from the popup clears it (:1699); the header dot ORs them (:1839);
  *"opening clears that unread dot"* (PATTERNS :1468).
- **Moderation affordances shown:** exactly the thread menu's four verbs
  (§1.4). Note the bundle couples block to moderator notice ("a steward was
  notified") — a posture Part II examines (**⚑ M-G3**).

### 1.8 Fixed strings (verbatim EN / ES)

From `STR` (:1546-1612 EN, :1613-1645 ES). "steward"/"consejo" wording is
recorded verbatim; the app normalizes to moderator/moderación per the G-6
ruling (DECISIONS.md 2026-07-12).

| key | EN | ES |
|---|---|---|
| `messages` | Messages | Mensajes |
| `msgInside` | Messages stay inside Steppe | Los mensajes se quedan en Steppe |
| `composePrivacy` (X1-reserved; un-reserved by M1) | Your contact stays inside Steppe. Neighbors reach you here — never by SMS or email. | Tu contacto se queda en Steppe. Los vecinos te encuentran aquí — nunca por SMS o correo. |
| `threadPh` | Write a message… | Escribe un mensaje… *(ES :1609 region)* |
| `tMute` | Mute this conversation | Silenciar conversación |
| `tLeave` | Leave conversation | Salir de la conversación |
| `tBlock` | Block neighbor | Bloquear vecino |
| `tReport` | Report to a steward | Reportar a un steward |
| `tSending` / `tSent` | Sending… / Sent | Enviando… / Enviado |
| `tEmpty` | No messages yet — say hello to a neighbor. | Aún no hay mensajes — saluda a un vecino. |
| `toastMuted` | Muted — you won't be notified | Silenciado — no recibirás avisos |
| `toastLeft` | You left the conversation | Saliste de la conversación |
| `toastBlocked` | Blocked · a steward was notified | Bloqueado · se avisó a un steward |
| `toastAttach` | Photo & location share live in the app | Compartir foto y ubicación vive en la app |
| `mcSend` / `mcSentTitle` | Send / Sent | Enviar / Enviado |
| `mcSentSub` | It's in your Messages now — reply anytime. | Ya está en tus Mensajes — responde cuando quieras. |
| `mcToast` | Message sent · stays inside Steppe | Mensaje enviado · se queda en Steppe |
| `mcPh` | Write a quick note… | Escribe una nota… |
| `toastReport` | Sent to a steward, privately | Enviado a un steward, en privado |
| detail `msgLabel` (assembled) | Message {FirstName} | Mensaje a {FirstName} |
| event `msgLabel` (assembled) | Message the host | Escribir al anfitrión |
| vestigial: `toastMsg` | Opening a message to␣ | Abriendo un mensaje a␣ |

### 1.9 Dimensions & tokens digest

No new tokens. Header slots 34px (shell) / 32px (detail); dot 9px rust +
2px paper ring; monograms 46 popup / 44 inbox / 32 thread-header (mono 14 /
13 / 11); inbox row 16×22 pad; bubbles max 78%, 14.5/1.45, radii 14-14-4-14
(tail sides swap), juniper-deep÷paper vs bone÷ink; send 42px square
(juniper-deep ↔ grabber-disabled); popup textarea 3 rows; sheet motion
`--dur-sheet` 280ms, push 260ms; menu rows 15px/500 with rust for
block/report; quiet lines mono 9–9.5px with 6px sage-deep dot.

---

## Part II — Recommendations (decision-ready; each is THE proposal, with rationale)

## 2. The M1 cut, stated up front

**DMs only, context-anchored, text-only, poll-on-nav, plaintext-with-RLS,
zero moderator reach — with the member-Report intake shipped FIRST.** The
bundle depicts exactly one heavier thing — the collective counterpart
(:1958/:1223) — and v2 §5's group channels own that future; M1 maps "Message
the host" to the event's `creator_id` (**⚑ M-G5**).

**The Reports prerequisite (⚑ M-G4).** X1 shipped a feed with no
member-initiated report path and named the intake "the first fast-follow"
(X1 §8, DECISIONS 2026-07-12). M1 without it would open an *abuse channel
with no abuse valve* — the thread menu's Report verb, drawn in the bundle,
would be a dead row. **Sequencing recommendation: the Reports intake is M1
Part 1, before any messaging surface ships.** Minimal shape (its own
migration + four-lens pass, not designed here): `reports (id, reporter_id,
target_type, target_id, body, quoted_excerpt?, created_at, resolved_by,
resolved_at, outcome)` — append-ish intake feeding the existing moderation
queue; `target_type` gains `'message_thread'` alongside `'post'`/`'event'`.
Reporting a thread attaches the reporter's OWN quoted excerpt — see §6.4.
Shipping it also lifts the X1 amendment: the post detail's secondary row
gains its Report button at last.

## 3. Schema — `0022_messages.sql` (manual apply, four-lens adversarial review mandatory, Studio-safe matrix)

Four tables, one RPC. House conventions throughout: revoke-then-grant
privilege determinism (the 0018 lesson), explicit column grants, definer
RPCs with `set search_path = public`, matrix in `seed/matrix-0022.sql`
(pure SQL, single rolled-back transaction).

### 3.1 Tables

```sql
create table threads (
  id             uuid primary key default gen_random_uuid(),
  member_a       uuid not null references profiles(id),   -- canonical: a < b
  member_b       uuid not null references profiles(id),
  about_post_id  uuid references posts(id)  on delete set null,  -- the "Re:" anchor,
  about_event_id uuid references events(id) on delete set null,  -- exactly one at insert
  created_at     timestamptz not null default now(),
  check (member_a < member_b),
  check (num_nonnulls(about_post_id, about_event_id) <= 1),
  unique (member_a, member_b)
);

create table thread_state (           -- per-member, per-thread private state
  thread_id    uuid not null references threads(id) on delete cascade,
  member_id    uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz,
  muted_at     timestamptz,
  left_at      timestamptz,
  primary key (thread_id, member_id)
);

create table messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references threads(id) on delete cascade,
  sender_id  uuid not null references profiles(id),   -- NO cascade: co-owned content;
  body       text not null check (btrim(body) <> ''   -- a future hard-delete must not
                              and char_length(body) <= 4000), -- silently empty the
  created_at timestamptz not null default now()       -- counterpart's inbox (§7)
);
create index messages_thread_idx on messages (thread_id, created_at desc);

create table member_blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
```

Rationale:

- **One thread per pair — the bundle's law** (:1693/:1699, "one store, no
  duplicate channel" :1454). The canonical `a < b` pair + unique constraint
  IS the model; the anchor keeps the FIRST context, matching :1699 exactly.
  `on delete set null` for anchors: a deleted/removed listing quietly drops
  the `Re:` line (the thread outlives its occasion — as depicted, the ctx
  tap just stops rendering).
- **`thread_state` carries every private per-member verb** — read cursor,
  mute, leave — so mute/leave/read are RLS-updatable own-row state, never
  RPC ceremony. **Leave = archive**: the inbox hides threads where
  `left_at` is later than the last message; a NEW incoming message
  resurfaces the thread unread. The gentle verb stays gentle; **block is
  the wall** (below). This also makes "leave" reversible without re-entry
  mechanics.
- **Messages are immutable in M1**: no UPDATE or DELETE grant, policy, or
  RPC exists at any layer — not for the sender, not for moderators. Edit
  windows and per-message deletion (v2 §5) are deferred WITH the Reports
  system mature (§8), because unilateral deletion in a young abuse pipeline
  is evidence destruction. Immutability is enforced by privilege
  determinism (nothing granted), not a guard trigger — there is nothing to
  guard when nothing is writable.
- **`member_blocks` is member-level, not thread-level** — the bundle's verb
  is "Block *neighbor*" (:1475). Block freezes messaging **symmetrically**
  (neither party can send in the pair's thread) — simpler to reason about,
  and it never leaks direction. The blocked party is never told (§3.2's
  no-oracle refusals); the block row is invisible to everyone but its
  author. **Silent** — the bundle's "a steward was notified" copy migrates
  to the Report verb (**⚑ M-G3**).

### 3.2 RLS + privileges

| policy | rule |
|---|---|
| `th_read` | participant: `auth.uid() in (member_a, member_b)` — and no one else, **including moderators** (§6) |
| `th_insert/update/delete` | none — threads are born only through `start_thread()` (below) and never mutate |
| `ts_read` / `ts_update` | own row (`member_id = auth.uid()`); update grant on exactly `(last_read_at, muted_at, left_at)` |
| `msg_read` | participant of the parent thread |
| `msg_insert` | `sender_id = auth.uid()` AND participant AND `is_verified()` AND no block row in either direction AND counterpart not deleted — expressed in one `can_send(thread_id)` SQL helper so policy and RPC cannot drift |
| `bl_read/insert/delete` | own rows (`blocker_id = auth.uid()`); insert requires `is_verified()`; the blocked member has NO read path to the row's existence |

Privileges: `revoke all` then grant exactly — `messages`: select + insert
`(thread_id, sender_id, body)`; `threads`/`thread_state`: select (+ the
three-state update columns); `member_blocks`: select/insert
`(blocker_id, blocked_id)`/delete. `created_at` is nowhere insertable
(chronology is server truth, invariant-7 shape). Anon holds nothing.

### 3.3 `start_thread()` — the one RPC

```
start_thread(p_with uuid, p_body text,
             p_about_post uuid default null, p_about_event uuid default null)
returns uuid   -- security definer; grant execute to authenticated only
```

- `is_verified()`; `p_with` verified, undeleted, ≠ me.
- **Context is REQUIRED** (exactly one anchor) and validated: the post must
  be readable by ME (`is_group_member` of its board), un-hidden, and
  **authored by `p_with`**; the event likewise with `creator_id = p_with`.
  This is the §5 posture (context-anchored starts) made structural — the
  RPC cannot mint a cold DM.
- Block check both directions, counterpart-deleted check — all four
  refusals raise the SAME message (*"This neighbor can't be reached right
  now"*): **no block oracle, no deletion oracle**.
- Rate valve: at most **10 NEW threads per member per rolling day**
  (config-style constant in the function, not hardcoded UI — **⚑ M-G7**);
  refusal says so plainly. A cap, never a score (invariant 7 untouched).
- Find-or-create the canonical pair row (unique-violation race → re-select,
  raise-on-empty — the 0020 mint pattern); create both `thread_state` rows;
  insert the first message; stamp my `last_read_at`. An EXISTING thread is
  reused as-is — **the anchor is never overwritten** (:1699's law).
- Sending into an existing thread is a plain RLS insert — no RPC.

### 3.4 Reads the UI needs (no new views)

Inbox = my threads joined to counterpart's `public_profiles` row, last
message, my state (hide `left_at` ≥ last message; muted threads render but
never dot). Unread dot = one `exists` over `messages_thread_idx`:
a message newer than my `last_read_at`, not mine, in an unmuted/unleft
thread. Mark-read = own-row `thread_state` update on thread open.

### 3.5 Audit posture

**No `log_audit` calls anywhere in 0022** (⚑ M-G6). Message metadata in an
append-only log readable by moderators would be a relationship graph the
privacy section forbids. Blocks, mutes, leaves: private member state, like
RSVPs. The permanent record gains message-related rows only when the
REPORTS path produces a moderation action — on the report, never the thread.

### 3.6 Matrix sketch (`seed/matrix-0022.sql` case groups)

0 privilege determinism (no UPDATE/DELETE grants on messages anywhere; state
update = 3 columns; created_at uninsertable) · 1 anon nothing · 2 unverified
can't start/send · 3 cold-DM refused (no context / wrong author / hidden
post) · 4 non-participant reads nothing (threads, messages, state) — incl.
MODERATOR persona explicitly · 5 forged sender refused · 6 block freezes
both directions; refusal message identical to deleted-counterpart; blocked
party sees no block row · 7 one-thread-per-pair (second start returns the
same thread; anchor unchanged) · 8 rate valve at 11th distinct start ·
9 leave-archive semantics (hidden from inbox derivation; new message
resurfaces) · 10 unread derivation (mute suppresses dot; open clears) ·
11 deleted-account: purge/tombstone per §7 · 12 no-oracle equality checks.

## 4. Privacy architecture — plaintext-with-RLS, argued (⚑ M-G1)

**The recommendation: plaintext rows behind participant-only RLS, with the
operator's inability to read made *procedural and enumerable* rather than
cryptographic. E2E encryption is rejected for M1 — honestly costed below —
and left to the cohort as a future ballot.**

### 4.1 What each posture actually promises

*"Messages stay inside Steppe"* (:797, :829, :1116 — the bundle prints it
three times) is a promise about **SMS/email/ad-tech exposure**, and both
postures keep it. The harder question is the one members won't ask until it
matters: *who inside Steppe can read?*

**Plaintext-with-RLS** (proposed): participants only, at every layer that
has a policy — no moderator read, no admin surface, no view, no export path
but the member's own. What remains is the truth every hosted service owns:
the database itself (service key, backups, the hosting provider under legal
compulsion) can technically reach message bodies. The operator becomes a
**confidant by structure**: trusted because the read paths are enumerated
and absent, not because reading is impossible.

**E2E** would make reading impossible — and on Steppe's actual architecture
it costs: **(a)** magic-link auth means no durable client key material — a
new device (or cleared browser) is a new keypair, so history dies or a key
escrow returns the trust problem through the back door; **(b)** the app is
server-components-first for slow phones — E2E forces a heavy, crypto-bearing
client and kills server rendering of the inbox; **(c)** promise-4 export
(§7.2) stops being a server feature; **(d)** the §6.4 consent-based report
path can't verify a quoted excerpt against anything, so abuse handling
becomes pure he-said-she-said; **(e)** the intern-can-audit rule
(CLAUDE.md) does not survive a hand-rolled E2E layer.

**Promise 4 cuts both ways, and honestly:** *member-owned data* argues FOR
E2E (ownership as exclusive possession) and FOR plaintext (ownership as
exportability, portability, multi-device continuity — all of which E2E
taxes). M1 weighs the second reading heavier because export-and-leave is
the promise's operative clause on this platform.

### 4.2 What makes the plaintext posture real (not a shrug)

1. **Zero read paths**: no policy grants any non-participant SELECT;
   moderators and admins are just members here (§3.2, matrix case 4).
2. **The admin-client contract**: `lib/supabase/admin.ts` enumerates every
   service-key use ("exactly three things" today). **Messages are
   deliberately NOT added** — any future fourth entry touching message
   tables is a reviewable, greppable event.
3. **Terms name it in plain language** (pre-counsel paragraph, §10):
   *"Messages are private to the people in them. Nobody who runs Steppe can
   read them in the app — no moderator, no administrator. The database that
   stores them is operated by people who could technically access it; our
   rules forbid it, our tooling doesn't allow it, and telling you this
   plainly is part of the promise."*
4. **Moderation reads only what a participant hands over** (§6.4).
5. **E2E stays on the table as a governance upgrade** — a real ballot, like
   public feeds (C-G1's precedent), not a config flip.

### 4.3 Moderation & the consent-based disclosure model (⚑ M-G4)

Moderators have **no standing read** of any message, ever, in M1. The only
way message content reaches a moderator: a **participant reports the
thread** and the report carries that participant's **quoted excerpt** —
the reporter's own delegated read of their own conversation (the same
G-2-consistent logic as C1's capability feeds: a member may share what a
member can see). The intake stores the excerpt on the REPORT row (which has
a moderation lifecycle), never grants access to the thread. Sanctions ride
the existing `moderation_actions` machinery against the *member*
(warn/temp_ban…), not against messages (which have no hidden state — they
are invisible to everyone but participants already).

## 5. What starts a message (and the abuse posture)

**Context-anchored starts only** — precisely the bundle's three doors
(:1476), no more:

1. **Post detail** → `Message <FirstName>` (primary letterpress button,
   :777) → the in-card popup → `start_thread(author, body, post)`.
2. **Event detail** → `Message the host` (:941) → `start_thread(creator_id,
   body, event)`. The bundle's collective counterpart (:1958) is the v2 §5
   future (**⚑ M-G5**); M1's host is the human creator, and the popup shows
   that person's name — no impersonating a group identity we can't deliver.
3. **Group-post rows** (:1942): X1 already routes these to post DETAIL —
   which is door 1. No separate path; the bundle's "N replies" count is not
   carried into M1 (it would be a message-count badge — :1518 forbids
   numbers; the detail button suffices).

**No cold-open DMs**: no compose button in the inbox, no message buttons on
rosters or profiles. The RPC enforces it (§3.3) — this is the abuse surface
cut to its bundle-drawn minimum. Replies within an existing thread are
unrestricted (until a block).

The valves, in order of reach: **block** (member-level, instant, silent,
symmetric — ships IN M1) · **rate cap** (10 new threads/day, §3.3) ·
**report** (the M1-Part-1 intake, §2 — with the quoted-excerpt consent
model). Sequencing Reports first is the posture: the channel and its valve
arrive together.

## 6. Nav & UI integration

- **The header messages slot ships with M1 Part 3, not before**
  (no-dead-icons — the same rule that kept it out of the X1 shell). It
  lands in `app-nav.tsx` beside `SearchSlot` in the bundle's order
  (search, then messages, :446-455), a 34px `IconSlot` with the 17px
  bubble glyph; post-detail headers gain the 32px variant (:757-760).
- **Unread dot = server-computed presence, poll-on-nav** (§8 keeps
  realtime out): the protected layout's server render runs the one §3.4
  `exists` query per navigation; `revalidatePath` on send/read keeps it
  honest within a session. A 9px rust dot with a 2px ring on the slot
  (:2085 grammar, already the month-grid's presence vocabulary). Never a
  number (:1518).
- **Un-reserved by M1**: `composePrivacy` finally ships on the composer
  (X1 §8 reserved it precisely because it promises this feature);
  `msgInside` ships in its three bundle homes (inbox strip :797, thread
  watermark :829, popup quiet line :1116); the two `Message ___` buttons
  ship on post/event detail; the `mc*`/`t*`/toast strings land EN+ES with
  G-6 normalization (`tReport` → *"Report to a moderator"* / *"Reportar a
  la moderación"*; `toastBlocked` → *"Blocked"* / *"Bloqueado"* — the
  steward-notice clause moves to the report confirmation, §3.1/⚑ M-G3;
  `toastReport` → *"Sent to a moderator, privately"* / ES accordingly).
- **Screens**: `/protected/messages` (inbox) and `/protected/messages/[id]`
  (thread) as pushed pages under the shell; the popup is a client sheet on
  the two detail pages (`useActionState` + `start_thread` server action;
  the JS-optional fallback is a plain form on a thread page — the popup is
  enhancement, not the gate). Inbox rows/thread bubbles per §1.2-1.3
  verbatim; `tEmpty` becomes the inbox's real empty state.

## 7. Deletion, retention & export

### 7.1 `delete_my_account()` (⚑ M-G2 — the counterpart's copy)

Per the CLAUDE.md convention (and the 0020 precedent — the tombstoned
profile means FK cascades never fire on their own), 0022 amends
`delete_my_account()`:

```sql
delete from member_blocks where blocker_id = v_uid or blocked_id = v_uid;
delete from thread_state  where member_id  = v_uid;
-- messages + threads: KEPT — see below
```

**Recommendation: message bodies SURVIVE account deletion; identity does
not.** The sender renders as *"Former member"* automatically (names resolve
through the tombstoned profile at render time — zero migration work). The
counterpart's inbox keeps the conversation they were half of.

Why this side of the line: a conversation is **co-owned** — "nothing a
member made is held hostage" (invariant 8) protects the leaver's *copy*
(export, §7.2) but does not license destroying the *other member's* copy of
words that were sent to them; the house already resolves this exact tension
for appeals (bodies replaced, rows kept) and votes (kept, de-identified);
and hard-deleting on exit would hand harassers an evidence-shredder (leave
→ thread vanishes → report impossible). The email intuition holds: closing
an account doesn't unsend the mail. **Flagged, not smuggled**: this is a
promise-adjacent semantics the founder signs in the decision record, and
the Terms deletion copy gains one plain sentence (*"Messages you sent stay
in your neighbors' threads, no longer signed with your name"*).

### 7.2 Export (promise 4)

The account export gains, read as the member (RLS-pinned, the 0009
posture): `threads` (mine, with the counterpart's display name resolved at
export time), `messages` (**full bodies of every thread I participate in**
— both sides; identical exposure to the member's own screen, the same rule
the votes/rsvps exports follow), `thread_state` (mine), `member_blocks`
(mine — the blocks I made; never blocks made against me). The
`calendar_feeds`-style sans-secret note doesn't apply — there is no secret
column here.

### 7.3 Retention

No auto-expiry in M1. Messages persist until the §7.1 semantics apply. A
retention policy (e.g., "threads idle N years are pruned") is a cohort
decision for the eventual data-stewardship ballot — noted, not built.

## 8. Explicitly OUT of M1

| cut | evidence it's drawn/implied | why it stays out |
|---|---|---|
| **Realtime (websockets / Supabase Realtime)** | nothing in the bundle implies push; the dot is nav-scoped | Poll-on-nav is the lighter cut: zero client JS for presence, no connection state on slow phones. Realtime is additive later (same tables) |
| **Group chat channels** | the collective counterpart :1958/:1223 | v2 §5 whole-cloth (channels, presence, per-group toggles). M1 is DM-first; the depicted group identity is the flag **⚑ M-G5** |
| **Media / location attachments** | the bundle STUBS its own buttons (:1706 → "Photo & location share live in the app") | v2 §5: "Text only — no media, no reels, ever" for chat; the buttons do not ship (no-dead-icons — a button that toasts an excuse is a dead button) |
| **Read receipts beyond the dot** | only own-"Sent" exists (:1851); no seen/delivered anywhere | Quiet-signals law (:1518); receipts are engagement mechanics. The own-send "Sent" state ships as optimistic UI only — never persisted, never shown to the counterpart |
| **Per-message edit/delete** | v2 §5's edit window | Deferred until Reports mature (§3.1 — evidence integrity first) |
| **Typing indicators, message search, unread counts** | absent from the bundle | Numbers and pressure mechanics; search can come with a member ask |
| **Notifications (email/SMS/push) for messages** | v3 §8/§10 tier model | The notification layer is v3's, unbuilt; M1's only signal is the dot. The mute verb future-proofs it (`muted_at` is exactly what the tier model will read) |
| **E2E encryption** | §4 | The posture ballot, not a build item |
| **Cold-open / directory DMs** | no compose affordance in the bundle | §5 — the abuse surface stays bundle-shaped |
| **The vestigial strings** | `toastMsg` :1559, `tabSoon` | Dead in the bundle, dead here |

## 9. G-class flags (collected — none may resolve silently)

| ⚑ | question | touches | recommendation |
|---|---|---|---|
| **M-G1** | **Plaintext-with-RLS vs E2E** — the operator-as-confidant posture | "messages stay inside Steppe" · member-owned-data promise (both readings, §4.1) | Adopt plaintext-with-RLS per §4; the founder signs it in the decision record; the Terms paragraph (§4.2.3) goes in the counsel packet pre-counsel; E2E remains a future cohort ballot |
| **M-G2** | **Deletion & the counterpart's copy** — do a leaver's messages vanish from the other member's thread? | invariant 8 (hostage clause) · verify-then-forget's spirit · abuse-evidence integrity | Keep bodies, tombstone identity (§7.1); one added sentence in the deletion copy; founder signs |
| **M-G3** | **Block silently, or block-and-notify?** The bundle says "a steward was notified" (:1600) | member privacy vs moderation visibility | **Silent block** (§3.1): auto-notify would put relationship metadata in moderator view without consent. The notice clause moves to the REPORT verb, which is consent by definition. Normalize the string |
| **M-G4** | **Moderator reach into message content** + the Reports dependency | humans-decide invariant 5 · privacy §4 | Zero standing reach; consent-based quoted-excerpt disclosure via the Reports intake, which ships FIRST (§2). The intake's own spec/migration gets its own four-lens pass |
| **M-G5** | **Host-as-group counterpart** — the bundle messages the collective; M1 messages the creator | honest UI (don't impersonate an entity that can't read the thread) | DM-to-creator in M1 with the person's real name shown; the collective counterpart arrives with v2 §5 group channels, where a group can actually answer |
| **M-G6** | **Messages absent from the audit log** — a deliberate hole in the append-only record | transparency posture vs metadata privacy | No audit rows for private-state verbs (§3.5); moderation enters the record via reports only. Named so the transparency page's completeness claim stays honest |
| **M-G7** | Rate-cap number (10 new threads/day) | provisional-config rule (CLAUDE.md open items) | Keep in config with the governance numbers; cohort can ratify alongside quorum/thresholds |

## 10. Migration & sequencing sketch (for the eventual approved build)

1. **Part 1 — Reports intake** (`0021_reports.sql` + queue UI): its own
   four-lens review, manual apply, matrix. Lifts the X1 fast-follow; post
   detail gains Report; the abuse valve exists before the channel.
2. **Part 2 — `0022_messages.sql`**: §3 exactly; four-lens adversarial
   review (RLS attack must include the moderator-persona read attempts and
   the no-oracle equalities); local matrix; **emit, STOP for manual apply**.
3. **Part 3 — UI**: inbox + thread + popup + entry buttons + header slots
   with dot (the icon ships here, per no-dead-icons); dictionary blocks
   EN+ES (G-6 normalized per §6); `tEmpty` as the real empty state.
4. **Part 4 — lifecycle**: `delete_my_account()` amendment + export
   additions + Terms paragraphs (deletion sentence + §4.2.3 privacy
   paragraph, both pre-counsel on a review-gate branch) + `rls-refusals`
   / walkthrough extensions (mint→send→block→report→delete chain).
5. G-flags **M-G1/M-G2/M-G3/M-G5** resolved before Part 3 ships to the
   cohort; M-G4 is resolved BY the sequencing itself.

---

*Extraction verified against the shipped bundle (609,798 B → inner.html,
2,108 lines). This document is uncommitted by design — review §2–§9,
resolve the flags, then it can land alongside the decision record.*
