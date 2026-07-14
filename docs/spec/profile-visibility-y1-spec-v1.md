# Profile field visibility (Y1) + pseudonymous handles (Y2) — spec v1

| | |
|---|---|
| **Status** | READ-ONLY spec / recommendation. **Not built.** No migration, no code. The auditable core is RLS, so the eventual build is gated by the four-lens review (the C1/M1 bar). |
| **Why now** | The last member-onboarding blocker. The live `/privacy` page makes two **promise-grade** claims the product does not yet honor. Before strangers onboard, either the code honors the copy or the copy is corrected — a promise the software contradicts is worse than no promise. |
| **Scope** | **Y1** — per-field profile visibility ("start hidden, reveal one at a time"). **Y2** — pseudonymous handles ("known by a username"). Parity audit first, then recommendations. |
| **Touches invariants** | 1 (verify-then-forget), 2 (server sets trust), 8 (member-owned / no dark patterns), 9 (accessible + ES), 10 (effort where it belongs). Y1's enforcement point is the same owner-rights view that already hides `tenure_start` (rls-audit N1). |

---

## 0 · The two promises, verbatim

From the live `/privacy` page (`messages/en.json` → `privacy` namespace, rendered by
`app/(site)/privacy/page.tsx`):

- **cDH:** *"Your profile is private by default"*
- **cDB:** *"Every field starts hidden. You choose, one at a time, whether it's
  visible to no one or to members."*  ← **Y1**
- **cCB:** *"…never an ID, a document, or your legal name. To each other, members
  are known by a username. Because we don't keep the proof, we can't produce or
  disclose it, even under legal process."*  ← **Y2** (+ invariant 1)
- **r1Cw:** *"Your email and username, so you can sign in and neighbors can reach
  you."*  ← **Y2** (note: couples "username" to *sign in*)

These are not marketing gloss; they are commitments in the document the community
lives by (`closeP`: *"This plain-language page is the one we actually live by."*).

---

## 1 · Parity audit — what the profile is today

### 1.1 The `profiles` table (`schema.sql:56-66`)

```
id, display_name (not null default 'New member'), neighborhood_id,
verified, role, tenure_start, locale, created_at, deleted_at
```

Trust columns (`verified`, `role`, `tenure_start`) are **server-only**, frozen on
self-edit by `guard_profile_columns()` (`schema.sql:366-378`) — invariant 2.
`display_name`, `neighborhood_id`, `locale` are member-editable. `display_name`
is seeded from auth metadata or defaults to `'New member'`
(`handle_new_user()`, `schema.sql:355-358`).

### 1.2 What other members can read

Two read paths:

1. **Base table `profiles`**, policy `pf_read` (`schema.sql:1048-1049`):
   ```
   using (id = auth.uid() or public.is_moderator())
   ```
   → a member reads **only their own row**; **moderators read every row in full**
   (all columns, including `neighborhood_id` and `tenure_start`).

2. **The owner-rights view `public_profiles`** (`schema.sql:980-982`), granted to
   every authenticated member (`schema.sql:1180`):
   ```sql
   create or replace view public_profiles as
     select id, display_name, neighborhood_id, verified, role
     from profiles;
   ```
   It reads *past* the base RLS but exposes only these columns —
   `tenure_start` is deliberately absent (a vote-weight tell, N1).

**Every member-visible profile field flows through `public_profiles`.** Enumerated,
with its *current* visibility rule:

| Field | Current rule | Where surfaced to others |
|---|---|---|
| `display_name` | **Always visible to all members.** No control. | Everywhere: exchange author + author search (`exchange/page.tsx:237`, `exchange/[id]/page.tsx:117`), message counterpart (`messages/page.tsx:80`, `[id]/page.tsx:76`), group roster/invite (`groups/[slug]/page.tsx:140`, `manage/page.tsx:84`), governance record + proposal (`governance/record/page.tsx:92`, `[id]/page.tsx:117`), event host + RSVP (`events/[id]/page.tsx:143,165`). |
| `neighborhood_id` | **DB-readable by all members via the view.** UI paints it only on the owner's own You page (`account/page.tsx:36-43`) and as a *per-post* attribute (`posts.neighborhood_id`, not the author's profile). | Not currently painted on other members — **but the value crosses the DB boundary to anyone who selects it.** |
| `verified` | **DB-readable by all members via the view.** | Read to gate group-invite eligibility (`groups/[slug]/manage/page.tsx:85`); trust badge. |
| `role` | **DB-readable by all members via the view.** | Group roster shows maintainer/moderator (`groups/[slug]/page.tsx:130`). Public accountability attribute (moderators act in the open — see the pin policy). |
| `tenure_start` | **Never public** (owner + moderator only; absent from the view). N1. | — |
| `locale`, `created_at`, `deleted_at` | Not in the view. `created_at` shown as "member since" on the owner's own page only. | — |

### 1.3 The gap, stated plainly

- **There is no per-field visibility anywhere.** No flags, no visibility table, no
  "start hidden." Every column in `public_profiles` is visible to every member,
  always. This is the exact inverse of cDB (*"Every field starts hidden"*) and
  cDH (*"private by default"*).
- **The "DB-unreadable vs UI-hidden" distinction is live and unmet.** Even where the
  UI doesn't paint `neighborhood_id`, the view hands the value to any member who
  asks. The C1/M1 lesson applies directly: hiding in the UI is not hiding.
- **There is no profile editor at all.** `account/actions.ts` contains only
  `deleteMyAccount()` — no update path for `display_name` or visibility. The You
  surface (`account/page.tsx`) renders identity read-only. Y1's control is
  **greenfield UI**, and even the plain "edit your name" affordance does not exist yet.

---

## 2 · Y1 — per-field visibility

### 2.1 Model: two-value visibility, default hidden

cDB names exactly two states: *"visible to no one or to members."* So the visibility
of a field is an enum of **two** values, defaulting to the hidden one:

```
visibility ∈ {'hidden', 'members'}   default 'hidden'
```

No "public-to-the-internet" state exists — the whole app is behind auth, and
`public_profiles` is granted to `authenticated` only. "Members" *is* the maximum.

### 2.2 The always-public minimum: `display_name`

One field cannot be hidden: a post, a vote record, a message needs *some* attributable
name, or authorship becomes anonymous (which breaks moderation accountability and the
"named actor" norms). So:

- **`display_name` is the always-public minimum identity** — the one field exempt from
  hiding. This is precisely the "username" of Y2 (§3). cDB's "every field" is honored
  by treating `display_name` not as a hideable *field* but as the **public handle** the
  promise itself presupposes ("members are known by a username").
- Everything else personal starts hidden.

### 2.3 Recommendation: per-field visibility **columns**, not a visibility table

The task poses the choice. **Recommend columns on `profiles`**, one per hideable field:

```sql
-- illustrative, not final
alter table profiles
  add column neighborhood_visibility text not null default 'hidden'
    check (neighborhood_visibility in ('hidden','members'));
-- …one such column per future hideable field (bio_visibility, …)
```

Why columns over a `profile_field_visibility(member_id, field, visibility)` table:

- The hideable field set is **small and known** (today: `neighborhood`; plausibly a
  future `bio`/`contact`). A normalized table is premature generality (Ousterhout:
  don't add a mechanism the problem doesn't yet have).
- Enforcement is a **`CASE` per column in one view** (§2.4). A table forces a
  `LEFT JOIN` + per-field `CASE` *anyway*, plus its own RLS, plus a row-per-field
  write model — more surface, no gain at this size.
- Default-hidden is a one-word column default (`default 'hidden'`), which *is* the
  promise. A table makes "absent row" mean hidden, which is subtler and easy to get
  wrong.

**Revisit** the table only if the profile grows to many optional fields; note the
trade in the migration comment so the next developer sees the boundary.

### 2.4 Enforcement: the view withholds the value (DB-level, not UI)

The single enforcement point is `public_profiles`. It already reads past base RLS
(owner-rights view), so add a **per-viewer `CASE`** that emits the value only to the
owner or when the owner set the field to `'members'`:

```sql
create or replace view public_profiles as
  select
    id,
    display_name,                              -- always-public minimum
    case when id = auth.uid() or neighborhood_visibility = 'members'
         then neighborhood_id end as neighborhood_id,
    verified,                                  -- trust attribute (see G-Y1c)
    role                                       -- accountability attribute (G-Y1c)
  from profiles;
```

- `auth.uid()` resolves inside the view regardless of the view's owner, so the
  per-viewer decision is correct and cannot be spoofed by the client.
- A member reading another member's hidden field gets **`NULL` — the value never
  leaves the database.** This is the DB-unreadable guarantee cDB requires.
- Because members reach other rows **only** through this view (base `pf_read` gives
  them just their own row), the view's `CASE` is a complete gate for member-to-member
  reads.

**But base `pf_read` still lets moderators read the raw row** (`id = auth.uid() or
is_moderator()`), so the view's `CASE` does not bind moderators. Whether "hidden" means
"no one" (moderators excluded) or "no *other member*" (moderator exception) is
**G-Y1a** below — it changes whether `pf_read` must also be narrowed for personal
columns.

### 2.5 The You-surface control ("one at a time")

A profile editor on the You surface (`app/protected/account`, where the identity
masthead already lives — `account/page.tsx:81-86`), added as a new server action in
`account/actions.ts` (which today only deletes):

- Each hideable field is a **row with a two-state control**: *Hidden* ↔ *Visible to
  members*, defaulting to **Hidden** — literally "reveal one at a time." Plain language
  (Pattern 22): the labels are "Hidden" / "Visible to members," not "public/private."
- One-tap to reveal a single field (invariant 10: routine actions effortless). No bulk
  "make everything public" — that would be the dark pattern cDB is written against.
- Writes go through `pf_update` (own row only; trust columns stay frozen by
  `guard_profile_columns`), so the control cannot touch `verified`/`role`/`tenure`.
- Accessibility + ES from the first screen (invariant 9): the toggle carries a
  programmatic state label (not color alone), and EN+ES strings ship paired.

### 2.6 Which fields Y1 actually governs (and the honest scope)

cDB's "every field" implies a multi-field profile. Today the only *personal* field
below `display_name` is `neighborhood_id`. So Y1 ships:

1. The **mechanism** (§2.3–2.5), field-generic.
2. Applied to **`neighborhood_id`** — default flips to hidden (see **G-Y1b**).
3. A **plain "edit your display name"** affordance (missing today), so the always-public
   handle is genuinely member-chosen (Y2 substance).

Y1 does **not** invent a `bio`/`contact`/`interests` field to have something to hide —
adding profile fields is product scope, and any new field must clear §4. Ship the
mechanism honestly against the real field set; the extension path is one `alter table`
+ one `CASE` line per future field.

---

## 3 · Y2 — pseudonymous handles: **copy precision, not a build**

**Is `display_name` already effectively a username?** Test it against what "username"
must mean:

| Property a "username" implies | `display_name` today |
|---|---|
| Member-chosen | **Yes** — editable, not frozen (`guard_profile_columns` freezes only trust columns). |
| Non-legal (not your real name) | **Yes, structurally** — verify-then-forget never stores a legal name (invariant 1; cCB *"never … your legal name"*); nothing binds `display_name` to legal identity; it defaults to `'New member'`. |
| Unique, stable handle (e.g. `@maria`) | **No** — free text, non-unique, mutable, no namespace. |
| A sign-in credential | **No** — sign-in is magic-link **email**; `display_name` is never a credential. |

**Recommendation: Y2 is copy precision, not a handle system.** The *substance* of the
promise — *members never see each other's legal identity, only a name they chose* — is
**already guaranteed** by verify-then-forget + `display_name`. What's inaccurate is the
word "username" in two specific ways, and the fix is to the copy, not the schema:

- **r1Cw** couples "username" to *"so you can sign in"* — false. Sign-in is email +
  magic link. Recommend: drop the sign-in coupling; say the email signs you in and the
  **name you choose** is how neighbors know you.
- **cCB / r1Cw** call it a "username," implying a unique handle. Recommend the plainer,
  true phrasing: *"a name you choose"* / *"a display name you pick"* — still delivers
  "not your legal name," without over-promising a handle namespace.

**A true `@handle` system is a deliberate future feature, explicitly out of Y1.** The
prototype has **no functional use for handles**: no @mentions, messaging is
thread-based and addresses people by row id, not by handle. Building one now would add a
uniqueness namespace, reservation/squatting policy, a rename/immutability decision, and
governance for renames — real cost, **zero current payoff**. If the cohort later wants
stable handles (for mentions or unambiguous addressing), that is its own scoped
decision, ratified like the governance numbers.

**One honest caveat to log:** under Y1, once everything but `display_name` starts
hidden, `display_name` becomes the *sole* cross-member identifier — and it is
non-unique. Two "Maria"s (or two "New member"s) are indistinguishable but for the
monogram. In a ~50-person closed cohort this is manageable (and the app resolves people
by id internally), so it does **not** force a handle system now — but it is the concrete
reason a future handle feature might earn its place. Flagged, not built.

---

## 4 · Verify-then-forget interaction (invariant 1) — confirmed clean, with a hard rail

**Confirmed: nothing proposed re-introduces retained PII.**

- The **visibility flags** store no PII — they are two-value enums.
- The fields Y1 governs re-store nothing verify-then-forget discards:
  - `display_name` — non-legal, already stored, member-chosen.
  - `neighborhood_id` — an FK to the **public neighborhood taxonomy** (a self-assigned
    *area*), already stored. It is **not** proof-of-residency and not the verification
    document. Verification evidence lives briefly in the private
    `verification-evidence` bucket and is deleted on decision (invariant 1); the profile
    keeps only `verified` + date + method. Y1 touches none of that.

**Hard rail for any FUTURE hideable field (bind this into the eventual build's review):**

> A profile field — hideable or not — must **never** re-store what verification
> discards: legal name, government ID, uploaded document, or an address used as
> proof-of-residency. cCB promises *"never an ID, a document, or your legal name … we
> can't produce or disclose it, even under legal process."* A "real name" or "home
> address" profile field would re-introduce exactly the PII invariant 1 deletes, and a
> per-field *visibility toggle does not cure that* — the data would still be retained
> and subpoena-reachable. Future optional fields must be member-authored free text
> (e.g. a short bio), never derived from or mirroring verification evidence.

---

## 5 · G-flags (don't silently decide — surface to the cohort / owner)

- **G-Y1a — Does "hidden" exclude moderators?** cDB says *"visible to no one."* Base
  `pf_read` lets moderators read every raw profile row, so the view's `CASE` doesn't
  bind them. Options: (a) **true "no one"** — narrow `pf_read` so moderators don't read
  *personal* columns of others (verified/role stay readable), or (b) **named
  exception** — moderators may see hidden personal fields, and the copy is adjusted to
  "no other member." Recommend (a) for personal fields (a hidden bio/neighborhood has
  no moderation-safety necessity, unlike a reported post). **Touches cDB — needs a call.**

- **G-Y1b — `neighborhood` default flips to hidden.** Today it is exposed by the view;
  honoring "starts hidden" makes it hidden by default. That is a behavior change
  (acceptable pre-launch, closed cohort). Confirm it does **not** break proximity
  ordering (invariant 7): proximity is computed against the *viewer's own* neighborhood
  and against *post* `neighborhood_id`, not the author's profile neighborhood — so
  hiding the profile field should not affect proximity. Verify at build.

- **G-Y1c — `verified` / `role` are carved out of "every field."** These are
  trust/accountability attributes the community relies on (invite gating; the pin policy
  names actors *in the open*; moderators act publicly). Recommend they are **system
  attributes, not "profile fields"** subject to hiding — so we can honestly say cDB's
  "every field" means *every personal field*, with trust/accountability badges always
  visible. **Needs explicit ratification** so the promise and the code agree.

- **G-Y2 — "username" copy overstates.** cCB/r1Cw promise a "username" used to "sign
  in"; reality is a mutable, non-unique display name plus magic-link email. Recommend
  the copy fix in §3. **Promise-grade — do not present the current copy as accurate
  once onboarding opens.**

- **G-Y1d — the promise presupposes fields that don't exist.** "Every field … one at a
  time" implies a richer profile than today's `display_name` + `neighborhood`.
  Recommend shipping the *mechanism* + `neighborhood` + a name editor now, and **not**
  inventing optional fields without product intent (any that are added clear §4). Flag
  so "every field" isn't read as a promise of fields we chose not to build.

---

## 6 · Build gate (for the eventual Y1 implementation — not this doc)

The auditable core is RLS/the view, so the build is gated by the four-lens adversarial
review at the C1/M1 bar. The lenses that matter here:

1. **RLS / read-path attack** — prove a member *cannot* read another's hidden field by
   any path: the view `CASE`, base `pf_read`, a direct `profiles` select, a join, or a
   `public_profiles` select of the raw column. The value must be `NULL` at the DB
   boundary, not merely unpainted.
2. **Promise fidelity** — default is `'hidden'`; "one at a time" has no bulk-reveal;
   `display_name` is the only always-public field; G-Y1c carve-out is explicit.
3. **Invariant 1** — §4's hard rail holds; no field mirrors verification evidence.
4. **A11y + ES** — the visibility control has a programmatic (non-color) state and
   paired EN+ES strings from the first screen.

A Studio-safe dry-run matrix (`seed/matrix-*.sql`, single rolled-back transaction, no
psql meta-commands) proves the view withholds hidden fields under impersonated roles
before the migration is applied by hand at the stop-gate.

---

*Drafted 2026-07-13. READ-ONLY — no migration, no code, uncommitted. Cited against
`schema.sql` (profiles `:56-66`, `public_profiles` `:980-982`, `pf_read` `:1048-1049`,
`guard_profile_columns` `:366-378`) and the live `/privacy` copy (`privacy` namespace,
clauses cDH/cDB/cCB/r1Cw).*
