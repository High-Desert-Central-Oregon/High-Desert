# Stage 3 — full self-hosted stack (TEMPLATE, inert)

**Do not deploy before the Stage 3 gate** in
[`docs/decisions/selfhosting-staged-roadmap.md`](../../docs/decisions/selfhosting-staged-roadmap.md):
**production cuts over only after the DR restore drill passes** on a wiped
staging box ([`dr/README.md`](./dr/README.md)). Nothing here is wired into CI,
Vercel, or any runtime path.

**What Stage 3 is:** the data layer comes home — decomposed Supabase
(Postgres / GoTrue / PostgREST / Storage) behind Caddy-not-Kong, plus the app,
on infrastructure Steppe controls. Prod box 16 GB / 4c **and a staging box**
(self-hosted Supabase has no project branching — staging is a second full
stack). ~$80–160/mo, 8–15 h/mo + on-call. You now own the database; this stage
must not arrive before a maintainer exists to own it.

## Provider selection

**Provider filter = US physical residency**, per the DECIDED entry in
[`docs/decisions/selfhosting-staged-roadmap.md`](../../docs/decisions/selfhosting-staged-roadmap.md)
("Hosting jurisdiction — DECIDED"); the candidate primary (Hetzner Hillsboro,
Oregon region) and the US-domiciled off-provider backup requirement are recorded
there, not here.

## Sequencing (two moves, never one)

1. **Staging first.** Stand up this stack on the staging box: apply
   `schema.sql`, create the `verification-evidence` bucket + its two policies
   (schema NOTES), schedule `close_due_proposals` (pg_cron), point a staging app
   build at it, run the parity battery (magic link, RLS spot checks, /api/qr).
2. **Drill.** Run the full restore drill in `dr/README.md` until it passes with
   a signed log row.
3. **Only then prod.** Cut DNS/env over, keeping the managed-Supabase project
   frozen (not deleted) as the rollback for a defined grace window.

## Evaluate Pigsty before hand-rolling

Before building the Postgres estate by hand (backups, monitoring, HA-later),
**evaluate [Pigsty](https://pigsty.io)** — a batteries-included self-hosted
Postgres distribution (pgBackRest, monitoring, HA patterns out of the box). The
decision is cost-of-learning-it vs. cost-of-owning-hand-rolled-ops; record the
outcome in the roadmap changelog either way. Hand-rolling is the fallback, not
the default.

## Hardening checklist (both boxes, before anything listens)

- [ ] SSH: key-only (`PasswordAuthentication no`), non-default port optional,
      fail2ban or equivalent.
- [ ] **Dual firewalls, default-deny**: provider-level firewall AND host
      firewall (ufw/nftables) — nothing inbound except 443 (and 80 for ACME)
      and SSH. The compose stack publishes ports only through Caddy by design.
- [ ] `unattended-upgrades` (security) enabled; reboot window defined.
- [ ] Volume encryption on the data volume (provider option or LUKS).
- [ ] `.env` from `.env.template`: every name filled with generated values,
      `chmod 600`, never committed. **Never boot with vendor example values**
      (the template header explains why this is the #1 mistake).
- [ ] Docker: no service publishes a host port except caddy (verify:
      `docker compose config | grep -A2 ports`).
- [ ] Studio/meta stay commented out; when needed: SSH tunnel, then stop them.
