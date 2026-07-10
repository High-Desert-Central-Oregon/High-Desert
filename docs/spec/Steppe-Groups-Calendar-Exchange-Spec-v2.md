# Steppe — Community Groups, Calendar & Exchange
**Spec v2 · 14 June 2026 · Draft for build**
Relates to: Business Plan v11. New product subsystem, in scope for the first closed beta.
Changelog:
- v2 — recurrence brought into v1 (materialized-occurrence model, §3); category suggestion opened (§6); §10 decisions resolved per redline.
- v1 — initial spec (groups, calendars/events, listings, chat; RLS invariant set; build phases).

## 0. Thesis
Groups become the community hub — the Facebook-Group model — carrying **posts, events (with calendars), listings, and chat**: everything the community uses Facebook (Groups + Events) and Instagram (chat) for, minus the extractive media layer. **No images or reels in social content, ever** — text-first by design. The aim is to make the cost of switching off FB/IG low by matching the *utility* while refusing the *attention machine* (Doctorow's enshittification; Illich's conviviality). "No media" governs social content (posts, listings, chat); it does not touch verification-evidence handling, which is not social sharing.

## 1. Groups — the container
**`groups`**: id, slug, name, description (text), category (§6), visibility, join_policy, created_at, archived.

Two orthogonal settings:
- **visibility**: `public` (read-only to anyone, logged-out included) | `members_only`.
- **join_policy**: `open` (any verified member joins instantly) | `request` (maintainer approves) | `locked` (no self-join; maintainer invites/adds).

**Presets** over those axes (UI sugar, not new state):

| Preset | visibility | join_policy |
|---|---|---|
| Public board | public | open |
| Curated | public | request |
| Private | members_only | locked |

**Built-in: the Everyone group** — every verified member is a member; its calendar/board is the community-wide surface; `public` visibility (the community calendar is Steppe's public face). System-owned, not user-deletable.

**Roles** (`group_members`: group_id, user_id, role, status, joined_at):
- `maintainer` — per-group admin: approves joins, confirms events/listings, manages settings. Powers scoped strictly to their own group(s).
- `member` — active participant.
- `status`: `active | pending | invited` (pending for request/locked joins).

Global **moderators** (existing) oversee the Everyone board and anonymous intake; they are not per-group maintainers unless assigned.

**Neighborhoods** stay distinct for v1 (geographic focus filter, auto-assigned by verification); events/listings may be tagged to a neighborhood. Folding neighborhoods into the group model is a deferred option, not v1.

**Directory**: browse/search groups by category + free text. `members_only` groups are listed by **name + category**; their contents stay hidden until joined.

## 2. Content types (all text)
Within a group: **posts** (threaded text discussion), **events** (§3), **listings** (§4), **chat** (§5).

Visibility rule: a `public` group exposes its **posts, events, and listings** read-only to anyone; **chat and the member list are always members-only**, regardless of group visibility (chat is participation, not broadcast).

## 3. Events, occurrences & calendars
**Events** (`events`, extending the existing table) are the *master* record: + start_at, end_at, all_day, location (text), source (`member | moderator | anonymous`), status (`draft | pending | published | rejected | cancelled`), author_id (nullable for anonymous), and a **recurrence rule** (nullable: freq `daily | weekly | monthly`, interval, by-weekday for weekly, end as `until` date or `count`). Null rule = single event.

**Occurrences** (`event_occurrences`) are the concrete calendar unit: id, event_id, start_at, end_at, status (`scheduled | cancelled`), plus nullable per-occurrence overrides (title/location). A single event has exactly one occurrence; a recurring event is **materialized** into occurrence rows from its rule out to a rolling horizon (~12 months), regenerated when the rule changes and extended by a scheduled job. **RSVP, saves, and the calendar all operate on occurrences**, so single and recurring events behave uniformly. A per-occurrence **cancel** or **edit** (override) never touches the rest of the series.

*Design choice:* materialized occurrences over query-time RRULE expansion — it keeps RSVP/save/My-Calendar as plain row operations and RLS uniform (an occurrence inherits its event's group/visibility), at the cost of one generation routine + a horizon job. v1 recurrence is daily/weekly/monthly with interval, weekly-by-weekday, and an until/count end — not full RFC-5545.

**Targets** (`event_groups`, many-to-many): an event publishes to one or more groups and/or the Everyone board. Publication/confirmation happens at the **event (master)** level — confirm a recurring event once and its whole series publishes.

**Personal calendar** (aggregation, not a publish target):
- `calendar_subscriptions` (user_id, group_id) — "match a group" = follow its whole calendar.
- `event_saves` (user_id, occurrence_id) — cherry-pick single occurrences.
- **My Calendar** view = occurrences from subscribed groups ∪ saved occurrences ∪ occurrences I authored/RSVP'd.

RSVP (per occurrence) extends the existing mechanism.

**Publication state machine** (the "confirming vote or something") — at the event (master) level:
- **Own calendar only** → instant; a private save (`event_saves`), no approval.
- **Group calendar** → `pending` → **maintainer confirms** (default) → `published`. Optional per-group mode: **members confirm by vote** (lightweight group vote) — opt-in setting.
- **Everyone board** → `pending` → **moderator confirms** → `published`.
- **Anonymous submission** → anon creates (source=anonymous, author=null, status=pending) → moderation queue → moderator vets, tags group(s), confirms → `published`; or rejects.
- `published` → `cancelled` (whole series, by author / maintainer / moderator); single occurrences cancel independently.

## 4. Listings — the services/exchange layer
The **Local Exchange (Pattern 25) primitive, pulled forward from post-beta**, organized around the community's service needs.

**`listings`**: group_id, author_id (verified member), type (`offer | request`), category, title, body (text), status (`open | fulfilled | closed | expired`), created_at, expires_at. Examples: housing/rentals (renters ↔ landlords), house-sitting, pet-sitting, services & skills, buy/sell/trade/free.

**Connect**: a responder expresses interest via a **text response thread** in v1 (so listings don't hard-depend on the chat subsystem); once chat (§5) lands, "respond" upgrades to a DM. No contact-PII is exposed; connection is in-app only.

**Lifecycle**: `open` → (responses) → `fulfilled | closed` (by author) → or `expired`. Listings live in category-themed groups; the Everyone board may aggregate open listings by category for discovery.

## 5. Chat — realtime messaging (the heaviest slice)
Replaces the Instagram-chat use. **Text only — no media, no reels, ever.**
- **Group chat**: one members-only channel per group. **DMs**: a private channel between two members (used for listing "respond" once live).
- **Tables**: `chat_channels` (group_id nullable for DMs, kind), `chat_messages` (channel_id, sender_id, body text, created_at, edited_at, deleted_at).
- **Realtime**: Supabase Realtime (postgres-changes or broadcast); presence (who's online) optional for v1. RLS governs channel subscription — only active members read/send.
- **Moderation**: report → moderator review; sender may edit/delete own messages within a window; moderators can remove. Removals/edits log to the audit trail. (Chat messages are user content — *not* append-only; they are deletable, unlike the audit log.)
- **Access**: members-only even in public groups; DMs readable only by the two participants; anon denied.

## 6. Category taxonomy
Broad, for discovery; a group has one primary category. Seed set:
1. Neighborhood & Place
2. Housing & Rentals
3. Pets & Sitting (pet-/house-sitting, lost & found)
4. Buy / Sell / Trade / Free
5. Help & Mutual Aid (rides, errands, lending)
6. Services & Skills
7. Civic & Government
8. Families & Schools
9. Interests & Hobbies
10. Health & Wellbeing
11. Arts & Culture
12. Events & Happenings

New categories are **open to suggest** — any member can propose one and it becomes available immediately; moderators tidy duplicates after the fact (janitorial, not gatekeeping), so the taxonomy grows with the community rather than being frozen or pre-gated.

## 7. RLS invariant set (the re-audit matrix)
G1–G5 (verified-only gated surfaces, ballot secrecy, audit integrity) **must continue to hold**. New invariants the build must satisfy and the re-audit must verify:

| # | Invariant | Rule |
|---|---|---|
| G6 | Public read (scoped) | Anon reads ONLY public groups' posts/events/listings + the Everyone board — nothing else (no members-only groups, member lists, subscriptions, governance, audit, chat, DMs, PII). |
| G7 | Anonymous write (narrow) | Anon may INSERT only an event/listing *submission* (pending table); cannot read others' submissions, modify/delete anything, or self-publish. Visibility requires moderator confirm. |
| G8 | Membership-scoped reads | Members-only group content readable only by `active` members of that group. |
| G9 | Maintainer scoping | A maintainer confirms events/listings, approves joins, edits settings ONLY for groups they maintain. |
| G10 | Join-policy enforcement | open → instant active; request → pending until maintainer activates; locked → no self-join, maintainer-add only. |
| G11 | Chat access | Only active members read/send a group's chat; DMs only the two participants; anon and non-members denied even for public groups. |
| G12 | Cross-group isolation | A member of group A cannot read group B's members-only content by any path. |
| G13 | Audit coverage | Every new state-changing action (group create, join approve/deny, event/listing confirm/reject/cancel, message removal) writes an audit entry. |

## 8. UI surfaces
- **Directory** — browse/search by category + text; public + joinable groups (private ones by name + category only).
- **Group page** — header (name/category/visibility), sections: Posts · Events (calendar) · Listings · Chat (members) · Members · About; join/request/leave per policy.
- **Calendars** — group calendar; **My Calendar** (aggregated, per-occurrence); event/occurrence detail + RSVP + save.
- **Event composer** — recurrence options + target picker (own / group(s) / Everyone board) → triggers confirm flow.
- **Public "Suggest an event"** — no-login form → moderation.
- **Listings** — list + detail; "post a listing" (offer/request); "respond" (thread → DM later).
- **Chat** — group channel + DMs; text composer.
- **Maintainer console** — group settings, member management (approve/deny/remove), event/listing confirmation.
- **Moderation** — extend `/protected/review` with pending events, pending listings, reported messages, and anonymous submissions.

## 9. Build phases
Each phase: build → RLS design → validate (extend the dry-run runbook's role-impersonation matrix) → commit. `schema.sql` kept in sync (migrations 0013+). The full G6–G13 re-audit **gates opening the beta to real members**.

1. **Groups core** — model, membership, visibility/join tiers, maintainer, categories (+ open suggestion), directory, join flows. RLS: G8–G10, G12.
2. **Calendars & events** — extend events (+ recurrence rule), the `event_occurrences` model + generation/horizon job, group calendars, personal aggregation (per-occurrence), publish/confirm state machine, anonymous intake + moderation. RLS: G6, G7 (first public/anon checkpoint), G9, G13.
3. **Listings** — offer/request, category-themed, lifecycle, response thread. RLS: extends G6/G8/G9/G13.
4. **Chat** — Supabase Realtime, group channels + DMs, text-only, moderation, optional presence; upgrade listing "respond" to DM. RLS: G11.

→ **Gate**: full G1–G13 re-audit before real members onboard.

## 10. Decisions (resolved in v2)
- **Category taxonomy** — seed set kept; new categories **open to suggest** (any member; moderators tidy duplicates). ✓
- **Member-confirm-by-vote** event mode — opt-in, default maintainer-confirm. ✓
- **Private group discoverability** — listed by name + category; contents hidden until joined. ✓
- **Listing "respond" in v1** — text thread, upgraded to DM when chat lands (listings don't block on the realtime subsystem). ✓
- **Recurrence** — **in v1** via materialized occurrences (§3); v1 scope is daily/weekly/monthly with interval, weekly-by-weekday, until/count. ✓
- **Neighborhoods → groups** — kept distinct in v1; unify later if desired. ✓
