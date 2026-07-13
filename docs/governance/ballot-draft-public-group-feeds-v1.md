# Ballot draft — public group calendar feeds (C-G1), v1

| | |
|---|---|
| **Status** | DRAFT for the cohort docket — not scheduled, not voted. Filed alongside the pending G-1 moderation-policy ratification (DECISIONS.md 2026-07-12, both X1 and C1 entries) |
| **Origin** | `docs/spec/calendar-c1-spec-v1.md` §8 flag **C-G1**, resolved 2026-07-12 as "member feeds only; anything wider is a ballot, never a config flip" |
| **Why a vote is required** | The G-2 ruling (DECISIONS.md 2026-07-12, X1 entry): anonymous reading of member content *"may only arrive later via a real governance vote."* A public calendar feed is exactly that — a standing, member-independent grant of member-created content to anyone holding a URL |

## Background, in plain language

Members can already connect Steppe to their own calendar apps. Each calendar
link is **that member's key**: it shows only what they can see, it stops
working the moment they leave a group (or Steppe), and they can replace or
remove it anytime. That shipped with C1 and needed no vote, because a member
delegating their own read is inside the members-only rule.

This ballot is about the thing C1 deliberately did **not** ship: a calendar
link that belongs to no member — one a group could print on a poster or give
to the library's website, so that *anyone* can subscribe to that group's
events. The Vendor Markets season is the motivating case: a public feed would
let any Redmond resident's phone carry the market dates without joining
Steppe.

The line the decision record drew: **a member's own delegated read** is
already allowed; **a standing anonymous grant** is the community's to give or
withhold. This ballot is the giving-or-withholding.

## The question (proposed ballot text)

> **EN** — *Should a group be able to publish a public, read-only calendar
> feed of its events — dates, times, titles, and places only — that anyone,
> member or not, can subscribe to? Group maintainers would choose per group;
> every public feed would be listed on the transparency page; and the
> community could revoke any of them by vote.*
>
> **ES** — *¿Debería un grupo poder publicar un calendario público de solo
> lectura con sus eventos — solo fechas, horas, títulos y lugares — al que
> cualquiera, miembro o no, pueda suscribirse? Quienes mantienen cada grupo
> lo decidirían por grupo; cada calendario público estaría listado en la
> página de transparencia; y la comunidad podría revocar cualquiera por
> votación.*

Choices: **Yes / No / Abstain**. Kind: **major** (provisional 60% threshold,
15% quorum — Business Plan v12 config, itself pending cohort ratification).

## What YES builds (mechanics)

The recommended implementation, so the cohort votes on a concrete thing:

1. **A group-level public feed token** — one per group, minted and revocable
   by that group's **maintainers** (not any member), stored alongside the
   member feeds but member-independent. Serving reuses the C1 pipeline
   (`/cal/<token>`, the same minimized payload: titles, times, places —
   never names, bodies, RSVPs, or counts).
2. **Named in public**: every group with a public feed is listed on the
   transparency page (group name + since-when). No quiet exposure.
3. **Audit-logged**: minting, rotating, and revoking a public feed writes to
   the append-only audit log, like the pin power.
4. **Revocable by governance**: a member proposal can order any public feed
   (or the capability itself) withdrawn; the kill is a delete, effective on
   the next poll.
5. **The Vendor Markets home**: the market events currently live on the
   Everyone board (0017 category tag). A public *Everyone* feed would expose
   the whole community calendar — broader than the motivating case — so the
   recommended path is a **Vendor Markets group** whose season feed goes
   public, keeping the grant scoped to what the poster actually advertises.
   (A category-scoped public feed of the Everyone board is the alternative
   mechanic; it should be chosen explicitly if preferred, not defaulted
   into.)

## What NO means

Status quo: members connect their own calendars; the market season reaches
the public the way it does today — printed schedules, the QR routes, and the
public marketing pages. Nothing regresses.

## What this ballot is NOT

- Not about member feeds (shipped, member-controlled, unaffected either way).
- Not anonymous *posting*, commenting, or any public write path.
- Not a precedent for public reading of posts, groups, or governance — each
  wider exposure would need its own ballot under the same G-2 rule.

---

*Drafted 2026-07-13 with C1 Part 6. Wording is a starting point for the
cohort; the mechanics above are scoped so a YES is buildable without
reinterpretation.*
