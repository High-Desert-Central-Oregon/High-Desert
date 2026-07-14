# Ballot draft — the profile-visibility carve-out (G-Y1c), v1

| | |
|---|---|
| **Status** | DRAFT for the cohort docket — not scheduled, not voted. Pre-counsel. Filed alongside G-1 (moderation policy) and C-G1 (public group feeds). |
| **Origin** | `docs/spec/profile-visibility-y1-spec-v1.md` §5 flag **G-Y1c**, pre-ruled by the owner for the Y1 build (2026-07-14): `verified` and `role` are always-visible system attributes, carved out of "every field starts hidden." This ballot puts that boundary to the community. |
| **Why a vote is required** | The `/privacy` page is the document the community lives by (`closeP`). cDB promises *"every field starts hidden … visible to no one or to members."* The Y1 build makes that literally true for **personal** fields (today: neighborhood) — but two attributes are deliberately **not** hideable: your verified badge and, if you hold it, your moderator role. Narrowing a promise-grade clause is the community's call, not a config default. |

## Background, in plain language

Y1 makes the privacy promise real: your personal profile fields now start
hidden and reveal one at a time, to no one or to all members — enforced in the
database, not just the interface. A hidden field is genuinely unreadable by
other members, **moderators included**.

Two things are left always-visible on purpose:

- **That you're verified** — the badge that says "a human confirmed this
  neighbor lives in Redmond." It carries no personal detail (not your address,
  not your document — those were deleted at verification). It's the trust signal
  the whole members-only model rests on, and it gates things like group invites.
- **A moderator's role** — moderators act in the open (the pin policy names
  actors publicly; removals are appealable and legible). A hidden moderator
  would break the accountability the community is owed.

Neither is a "personal field" in the sense cDB means — they're
trust-and-accountability attributes. The Y1 copy already says so in plain
language. This ballot asks the community to ratify that reading, so the promise
and the code agree by consent rather than by the builder's judgment.

The line drawn: **personal fields are yours to hide; the verified badge and a
moderator's role stay visible so the community can trust itself and hold its
stewards to account.**

## The question (proposed ballot text)

> **EN** — *Should "every field starts hidden" apply to your personal profile
> fields, while two accountability attributes stay always-visible to members:
> that you're verified, and — for moderators only — that you hold the moderator
> role? Everything personal would still start hidden and reveal one at a time,
> to no one or to all members; verification carries no personal detail, and
> moderators would remain publicly identifiable as moderators.*
>
> **ES** — *¿Debería "cada campo empieza oculto" aplicarse a tus campos
> personales de perfil, mientras dos atributos de rendición de cuentas siguen
> siempre visibles para los miembros: que estás verificado y — solo para
> quienes moderan — que tienes ese rol? Todo lo personal seguiría empezando
> oculto y se revelaría uno por uno, a nadie o a todos los miembros; la
> verificación no lleva ningún dato personal, y quienes moderan seguirían
> siendo identificables públicamente como tales.*

*(Draft register mirrors the C-G1 ballot; the Spanish inherits the same
native-speaker-review-pending status as the rest of the draft copy.)*

---

*Drafted 2026-07-14. DRAFT — pre-counsel, uncommitted to the docket. Cited
against `docs/spec/profile-visibility-y1-spec-v1.md` §5 (G-Y1c),
`migrations/0023_profile_visibility.sql`, and the live `/privacy` clauses
cDB/cCB.*
