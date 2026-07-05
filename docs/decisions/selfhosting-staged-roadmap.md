# Steppe — Staged Self-Hosting Roadmap

**Version 1.0 · July 2026** · reference framework · living document · companions:
`docs/portability-audit.md`, `DEPLOYMENT.md` §5–6, `docs/decisions/codeberg-migration.md`
(the year-two sovereignty milestone), `infra/stage2-app/` + `infra/stage3-full/`
(inert scaffolding — templates gated on this document's stage gates, never deployed
before them)

Maps infrastructure sovereignty onto business growth, with **maintainer attention
starting low and rising only as organizational capacity to supply it grows.**

---

## Governing principle

Infrastructure attention must never exceed the org's capacity to supply it
(Eghbal: maintainer attention is the scarce resource). So the arc is inverted from
the usual "self-hosting = high effort" framing: at launch, when Greg is the only
maintainer and traction is fragile, the stack is **maximally managed and minimally
demanding**. Sovereignty is brought in-house progressively, and **each stage advance
is gated on capacity existing — a maintainer to own it, revenue to fund it,
operational slack to absorb an incident — not on ambition.**

Every stage is reversible. Because the app is already portable (standard Next +
Postgres, no `@vercel/*` SDKs, Storage abstracted — enforced by `DEPLOYMENT.md`)
and the canonical repo lives on Codeberg, moving between stages is mechanical, not a
rebuild. Nothing here is a one-way door.

The attention curve, in one line:

```
Attention   ▁▁▂▂▃▃▄▅▆▇
Stage        0  1  2  3  4
Capacity    ▁▁▂▃▄▅▆▇█   (maintainers + dues revenue + ops slack)
```

Attention rises *underneath* the capacity line, never above it.

---

## Stage 0 — Soft launch (now → the event)

**Business state.** Prelaunch. Marketing site public, member app sealed
(`LAUNCH_PHASE` unset). No members inside the app yet. One maintainer (Greg).
Zero dues revenue.

**Architecture.** Fully managed. Vercel (app, off the Codeberg→GitHub mirror) +
managed Supabase (Postgres, Auth, Storage, RLS). Nothing to operate.

**Attention: near-zero.** No servers, no on-call. This is correct — the scarce
resource goes entirely to traction and the room, not to infrastructure. Over-
investing in sovereignty here would be the exact over-engineering-relative-to-
traction failure mode to avoid.

**DR posture.** Managed backups + PITR come free with managed Supabase. You are
already protected without doing anything.

**Gate to advance:** the closed beta opening. Nothing infra-side blocks it.

---

## Stage 1 — Closed beta / The First Loop (one neighborhood)

**Business state.** `LAUNCH_PHASE=live`. First cohort inside the app; the one-
neighborhood experiment. Still Greg-alone or nearly so. Dues just beginning; far
below break-even. Apprenticeship program spinning up (OSU-Cascades CS46X capstone,
Heart of Oregon Corps, fall 2026).

**Architecture.** Unchanged — still fully managed. Do **not** self-host anything
here. The one real infra task is closing the pre-`live` items already scoped:
storage-bucket policies (A-DB-1), `shouldCreateUser: false`, seed consents. Those
are app-config, not ops.

**Attention: still low.** A managed stack means a beta incident is a config fix,
not a 2 a.m. server rescue. During the most fragile membership phase you want zero
infrastructure fragility layered on top.

**DR posture.** Still managed PITR. Untouched.

**Gate to advance:** *a second person who can own operations exists* — the first
apprenticeship maintainer, or a committed technical volunteer. Until someone other
than Greg can hold a pager, the stack stays managed. **This gate is about people,
not member count.**

---

## Stage 2 — Established neighborhood → early multi-neighborhood

**Business state.** The First Loop worked; replicating to a 2nd–4th neighborhood.
Grant funding likely in (High Desert Connect / Ignite). Apprenticeship program has
produced at least one maintainer who understands the stack. Dues growing but still
under break-even. Say low hundreds of members.

**Architecture — first move off managed, lowest-risk half only.** Bring the **app**
in-house; keep the **data** managed.

- Next.js containerized, running on a single US VPS behind Caddy (TLS auto). This
  is the trivial half — it's standard Next + Postgres, and `DEPLOYMENT.md` already
  specifies exactly this (Caddy/Traefik + a PaaS like Coolify/Dokku for push-to-
  deploy).
- Supabase stays managed. Auth, Storage, Postgres, PITR all still someone else's
  problem.

**Attention: low-medium.** You now own one box running a stateless app — the
easiest thing to operate, because if it dies you redeploy and lose nothing (all
state is still in managed Supabase). This is the training-wheels stage: the
maintainer learns to run a box where the blast radius of a mistake is near-zero.

**DR posture.** Data DR still fully managed (the hard part). App box needs only a
reproducible rebuild — the docker-compose/Coolify config in the repo *is* the
backup.

**Gate to advance:** the maintainer has comfortably run the app box through at
least one real incident/redeploy cycle. (Provider choice at Stage 2→3 applies the
decided US-hosting filter — see "Hosting jurisdiction — DECIDED" below.) Only then
take on stateful services.

---

## Stage 3 — Multi-neighborhood, approaching dues stability *(the year-two sovereignty milestone lands here)*

**Business state.** Several neighborhoods; membership climbing toward the
~2,300-member / ~6.5%-of-Redmond dues break-even that funds the comp ceiling.
A maintainer (or two, via the apprenticeship pipeline) owns infrastructure as a
real role. Revenue can fund a modest ops budget.

**Architecture — bring the data layer home, decomposed.** This is the actual
self-hosting milestone, and it's deliberately the *third* move, not the first.

- Full Supabase stack via **in-repo docker-compose** on the VPS, **Caddy in front
  of the stack instead of Kong** (saves hundreds of MB RAM, unlocks the modern
  asymmetric `sb_*` keys you already use, future-proofs against the late-2026 HS256
  deprecation).
- **Decompose:** run only Postgres, Auth (GoTrue), Storage, PostgREST. Drop
  Realtime, Edge Functions, imgproxy, Analytics unless adopted. RLS is just
  Postgres — it comes for free.
- Studio never exposed in prod; only the gateway port is public.
- Real secrets generated before first boot (never the `.env.example` placeholders).

**Attention: medium-high — and this is the stage that must not arrive early.**
You now own the database. That's the on-call SRE role: security hardening, Postgres
maintenance, upgrades, monitoring, uptime. Self-hosted Supabase behaves as a single
project (no branching), so staging is a *second full stack* — budget the box and the
time for it.

**DR posture — the true gate of this whole roadmap.** Self-hosted Supabase has **no
managed backups and no PITR** — those are platform-only. So the gating deliverable
is *building* what managed gave you free: WAL archiving to object storage
(pgBackRest or WAL-G) **plus a rehearsed restore against a wiped staging box.** An
untested restore is not DR. **Production does not cut over until a clean restore
rehearsal has actually run.** This is the milestone — not the migration, the
rehearsal.

**Sequencing within the stage:** stand up the full stack on a *staging* box first
(rehearsal, parity check, DR drill), and only cut prod over after the restore drill
passes. Two moves inside the stage, never one.

**Gate to advance:** DR restore rehearsed and documented as a runbook; more than one
person can execute it.

---

## Stage 4 — Mature / approaching the 12-community cap

**Business state.** Near the hard cap of 12 communities. Dues at or past break-even;
funding diversified across the five streams. A maintainer *team* (apprenticeship
program at steady state), not a single person. Possibly government infrastructure
funding (2028+, radically transparent, infrastructure-only).

**Architecture — full sovereignty, hardened.** Everything in-house on infrastructure
you control, US-resident per the chosen filter. Now the higher-attention pieces are
justified because there's a team to carry them:

- High-availability posture for Postgres (replica + failover) if uptime demands it.
- Monitoring/alerting owned by the maintainer team.
- Optionally reintroduce services you dropped (Realtime, etc.) as features need them.
- The self-hosting stack is the reference implementation communities inherit — the
  sovereignty story becomes literal, and congruent with the Tribal Digital
  Sovereignty posture (complete ownership of the layers).

**Attention: high — but supplied by a team, not a person.** This is the only stage
where high infrastructure attention is acceptable, precisely because organizational
capacity finally exceeds it. The curve closes: attention is high, but it never
outran capacity to get here.

**DR posture.** Mature: tested PITR, regular restore drills, documented recovery
objectives, off-site/off-provider backup copies.

**Gate:** none beyond it — this is the sovereign steady state.

---

## The one rule that makes this safe

**Advance a stage only when the capacity to run it already exists.** Membership and
revenue matter, but the binding gate at every step is *people who can hold the
pager*. The apprenticeship program isn't a side project to this roadmap — it's the
capacity engine that makes each successive stage affordable in the only currency
that's scarce. If the maintainer pipeline stalls, you stop advancing and stay
managed longer. That's not failure; that's the principle working.

---

## Stack, cost & maintenance per stage

Planning numbers, not quotes — revise against real invoices at each gate (same
discipline as `docs/steppe-operating-budget-v1.md`, whose hosting line these feed).

| Stage | Stack | Cost | Maintenance |
|---|---|---|---|
| **0–1** | Fully managed: Vercel + managed Supabase. Nothing to operate. | **$0–45/mo** | **~0 h** |
| **2** | App-only VPS — 4 GB / 2 vCPU, Caddy (auto-TLS), Coolify **or** plain compose (`infra/stage2-app/`); **data stays managed** (Auth/Storage/Postgres/PITR remain Supabase's problem) | **$40–50/mo** | **2–4 h/mo** |
| **3** | Prod box 16 GB / 4c **+ a staging box** (self-hosted Supabase behaves as a single project — staging is a second full stack); full decomposed Supabase (Postgres / GoTrue / Storage / PostgREST, **Caddy not Kong**); **pgBackRest WAL → object storage + off-provider encrypted copy**; **evaluate Pigsty before hand-rolling** the Postgres estate (`infra/stage3-full/`) | **$80–160/mo** | **8–15 h/mo + on-call** · **gated on a REHEARSED restore** |
| **4** | HA Postgres (replica + failover), team-owned monitoring/alerting, optional service reintroduction | **$150–300/mo** | team-supplied |

---

## Hosting jurisdiction — DECIDED (2026-07)

US physical residency is the binding filter; US corporate domicile is NOT.
Rationale: Steppe's privacy invariants are architectural, not jurisdictional
(verification evidence deleted on check, encrypted backups under our keys, RLS
row gating) — provider domicile changes none of them, and legal exposure is
roughly symmetric (CLOUD Act reaches US-domiciled providers' data anywhere; US
process reaches US-stored data regardless of domicile). Domicile-now would
pre-purchase an entrenchment no funder or partner has required. RE-EVALUATION
TRIGGER: if a funder, government program, or tribal partner imposes a domicile
condition, revisit then — the provider-agnostic compose files make the switch
mechanical (the DR restore runbook doubles as the migration runbook).
JURISDICTIONAL REDUNDANCY: the off-provider encrypted backup copy IS held with a
US-domiciled provider (e.g. Backblaze B2, US region), so recovery capability
sits under a US company even while the primary runs on the cost-efficient
residency option. Candidate primary: Hetzner Hillsboro (Oregon region — low
latency to Central Oregon members; no ad or data-monetization business model).

---

## Changelog

- **v1.0** — Initial adoption, born decided. Five stages (0–4) mapping
  infrastructure sovereignty onto Steppe growth, attention rising under a capacity
  line. Year-two sovereignty milestone placed at Stage 3, gated on a rehearsed DR
  restore (self-hosted Supabase has no managed PITR). "Stack, cost & maintenance
  per stage" included. Hosting-jurisdiction decision **closed at creation**
  (residency binding, domicile as re-evaluation trigger, jurisdictionally
  redundant backups). Inert scaffolding referenced (`infra/stage2-app/`,
  `infra/stage3-full/`).
