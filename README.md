# Steppe

**Community-owned, verified, ad-free digital civic infrastructure for Redmond, Oregon.**

Steppe is a place for verified neighbors to find each other, organize, help one another,
and govern the platform together. It is run by [Steppe], a member-governed Oregon nonprofit
public benefit corporation (ORS 65, on a 501(c)(3) pathway). It is not social media and it is not
advertising-supported — the people it serves are the only customer.

> **Status: pre-launch.** We're building the prototype — a functional closed-beta MVP for a
> Redmond founding cohort (closed beta targeted Oct–Nov 2026). Expect rough edges and rapid change.

## What makes it different

These are structural commitments the code and governance *enforce*, not promises:

- **No advertising, ever.** Members are the only customer.
- **Verified residents only.** Real Redmond neighbors, verified through multiple pathways — and
  then we delete the documents (verify, then forget).
- **Members govern it.** Major decisions are made by community vote; core principles can't change
  without a supermajority.
- **Your data is yours.** Exportable, member-owned, never sold; no behavioral tracking.
- **No engagement engineering.** Chronological and proximity, not an attention-maximizing feed.

The full set of design invariants is in [`CLAUDE.md`](./CLAUDE.md). The reasoning behind each —
drawn from Ostrom, Doctorow, Meadows, Scott, Hirschman, and Baradaran, plus a tool-design layer
(Illich, Norman, Ousterhout, and others) — is in the design docs under [`docs/`](./docs).

## Tech stack

- **Next.js** (App Router) + React + Tailwind
- **Supabase** — Postgres, Auth (magic link), Storage, Row-Level Security
- Deploy on **Vercel** or **Netlify**
- No payment integration in the prototype (the founding cohort is free)

The database **is** the enforcement layer: access rules, vote weight, secret ballots, and the
verify-then-forget guarantees live in Postgres RLS and triggers (`schema.sql`), not just the UI.

## Where this lives

- **Canonical repository — Codeberg** (hosted Forgejo): `codeberg.org/steppe-community/steppe`.
  This is the source of truth; open issues and pull requests here.
- **Deploy mirror — GitHub:** `github.com/High-Desert-Central-Oregon/High-Desert` is a
  **write-only mirror** that Vercel watches. Pushes to Codeberg are mirrored to GitHub so
  production keeps auto-deploying — don't open PRs against it.
- **CI:** Woodpecker on Codeberg — [`.woodpecker/ci.yml`](./.woodpecker/ci.yml) (lint + build).
- Cutover runbook: [`docs/ops/codeberg-cutover.md`](./docs/ops/codeberg-cutover.md). Rationale and
  the deferred self-host path: [`docs/decisions/codeberg-migration.md`](./docs/decisions/codeberg-migration.md).

## Getting started

**Prerequisites:** Node.js + git, and a free Supabase project.

```bash
# 1. Install
git clone https://codeberg.org/steppe-community/steppe.git steppe && cd steppe
git config core.hooksPath .githooks   # enable the per-clone DCO sign-off hook
npm install

# 2. Set up the database
#    In the Supabase SQL editor, run the contents of schema.sql, then (per the notes
#    at the bottom of that file):
#      - create a PRIVATE Storage bucket named 'verification-evidence' (+ its two policies)
#      - make yourself an admin:
#          update profiles set role='admin' where id='<your-auth-user-id>';

# 3. Configure environment — create .env.local with:
#      NEXT_PUBLIC_SUPABASE_URL=...
#      NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#    (server-only keys, e.g. a service-role key for admin tasks, go here too — without
#     the NEXT_PUBLIC_ prefix, so they never reach the client.)

# 4. Run
npm run dev
```

**Building with Claude Code:** run `claude` in the repo root. It reads [`CLAUDE.md`](./CLAUDE.md)
(the invariants and build order) and [`SPEC.md`](./SPEC.md) (what each feature is and how it's
built). A good first prompt: *"Read CLAUDE.md and SPEC.md; start at Build Sequence Step 1–2, and
respect every invariant in CLAUDE.md."*

## Repository layout

```
.
├── README.md          — this file
├── CLAUDE.md          — design invariants, build order, do-not-build list (read first)
├── SPEC.md            — the working build spec
├── schema.sql         — Postgres schema, RLS, triggers, seeds (run first)
├── LICENSE            — GNU AGPL-3.0-or-later (the code)
├── NOTICE             — copyright + trademark policy
├── CONTRIBUTING.md    — how to contribute (DCO + working style)
├── docs/              — design materials (CC BY-SA 4.0)
│   ├── LICENSE
│   ├── pattern-language.html
│   ├── dev-framework.html
│   └── build-spec.html
├── content/legal/     — Terms & Privacy (seeds the documents table; pending legal review)
└── app/               — the Next.js application
```

## Contributing

Steppe is built by the community it serves, including a paid intern pipeline — so the code
is meant to be **legible and maintainable**, and to respect the invariants. Start with
[`CLAUDE.md`](./CLAUDE.md) and [`CONTRIBUTING.md`](./CONTRIBUTING.md). We use the Developer
Certificate of Origin (sign off with `git commit -s`); contributions are under the same AGPL
license as the project (inbound = outbound).

## Replication

The design is meant to be **adopted, adapted, or refused** by other communities — and, on their
own terms, by the Confederated Tribes of Warm Springs. The AGPL keeps any fork open; the patterns
(CC BY-SA 4.0) travel with their reasoning intact. You may run and modify the code freely, but you
may not operate it *as* "Steppe" — see [`NOTICE`](./NOTICE). If you'd like to run your own
instance, [get in touch][contact].

## License

- **Code:** GNU Affero General Public License v3.0 or later — [`LICENSE`](./LICENSE)
- **Documentation & design materials:** Creative Commons Attribution-ShareAlike 4.0 — [`docs/LICENSE`](./docs/LICENSE)
- **"Steppe"** name and logo: reserved trademark — [`NOTICE`](./NOTICE)

---

*[Steppe] · Redmond, Oregon. Replace the bracketed placeholders ([repo URL], [contact],
and the entity name) before publishing.*
