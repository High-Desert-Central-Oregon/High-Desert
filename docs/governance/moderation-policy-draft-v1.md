# Moderation policy — draft for cohort ratification, v1

| | |
|---|---|
| **Status** | DRAFT for the founding cohort to ratify alongside the beta. Not in force until ratified. Companion to the Governance Charter (`Steppe-Governance-Charter-v0.2-DRAFT.md`) and the Terms draft (Privacy/Terms §6, Moderation) |
| **Origin** | The **G-1** deliverable promised in DECISIONS.md (2026-07-12, X1 entry): *"A moderation-policy draft naming the pin power goes to the cohort for ratification alongside the beta."* This draft names it. Filed beside the **C-G1** public-feeds ballot (`ballot-draft-public-group-feeds-v1.md`), the other cohort-facing governance decision |
| **Scope of v1** | The **pin power** — the one editorial power the platform gives moderators over what members see first. Removal/restore, appeals, and reports are already governed by the Charter (separation of duties, append-only record, action-then-voice) and the Terms §6; this draft adds the piece those don't cover. Later versions may fold in the broader moderation handbook |

## Why this needs naming

Steppe orders everything **chronologically, newest-first — never by an
algorithm, never optimized for engagement** (constitutional invariant 7). The
pin is the single, deliberate exception: it lets a human place **one** post at
the top of a board. That is *curation*, not ranking — a noticeboard's push-pin,
not a feed's scoring function — and because it is the one place a person
decides what a member sees first, the cohort should ratify how it works, not
inherit it silently.

## The pin power, in plain language

- **One pin per board.** Each board (the community *Everyone* board, or a
  group's board) holds **at most one** pinned post at a time. Pinning a second
  requires unpinning the first. This keeps the pin a noticeboard, not a
  ranked list — there is no "top 5", no ordering to optimize.
- **The pinner is named.** Every pinned post carries the kicker **"Pinned by
  moderators"** in the open, and the acting person's identity is recorded on
  the post. A pin is never anonymous and never hidden.
- **Who may pin — scoped to your own board.**
  - The **community *Everyone* board**: only a **moderator** may pin.
  - A **group's board**: only **that group's maintainer** may pin. A moderator
    does **not** reach into a group to pin.
- **Who may unpin — moderators anywhere (the hostage remedy).**
  - A **maintainer** may unpin on **their own** group's board.
  - A **moderator** may unpin on **any** board, including inside a group.
    This asymmetry is deliberate: a pinned post that is later removed, or a
    maintainer who goes inactive, must never leave a board's only pin slot
    **held hostage** with no remedy. A moderator can always clear a pin;
    a moderator can never *place* one inside a group they don't moderate.
- **Removed content can't be pinned.** A post hidden by moderation cannot be
  pinned, and the pin machinery refuses it.
- **Every pin and unpin is logged.** Each action writes to the community's
  **append-only audit record** (the same permanent, tamper-evident log that
  carries removals and governance actions). The transparency view can show
  who pinned or unpinned what, and when.

## What the pin is NOT

- **Not ranking.** One pin, chosen by a named person, is the whole power.
  There is no scoring, no "recommended," no reordering of the rest of the
  board. Everything below the pin stays strictly chronological.
- **Not an engagement lever.** Nothing about a pin optimizes for clicks,
  time-on-page, or activity. It is used to say *"read this first,"* full stop.
- **Not silent.** The kicker names the actor; the audit log records the act.

## What the cohort is asked to ratify

1. That the pin power exists as described — **one per board, named, scoped to
   your own board to place, clearable by a moderator anywhere, audit-logged**.
2. The norm for **when** it is appropriate to pin (this draft proposes: safety
   notices, time-critical civic information, and posts the community has
   asked to keep visible — *not* editorial preference or promotion). The
   cohort may tighten or loosen this norm.
3. That misuse of the pin is **appealable and reversible** through the same
   moderation-review path as any other moderator action (Charter separation
   of duties: a moderator can't be the sole judge of their own pin dispute).

Once ratified, this becomes moderation policy v1; until then, the pin power is
live in the software (it shipped with the Exchange) but its **norms of use**
are provisional, exactly like the governance numbers (quorum, thresholds,
tenure weights) the cohort also ratifies.

---

*Drafted 2026-07-13, closing the G-1 item recorded 2026-07-12. The mechanics
above are exactly what the software enforces (migration 0018, `set_post_pin`);
this document names them for the people they govern.*
