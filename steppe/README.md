# Steppe — the app

This directory is the Next.js (App Router) application for **Steppe**, the
community-owned, verified, ad-free civic platform for Redmond, Oregon. The
project's real documentation lives at the **repo root** — start there:

- [`../README.md`](../README.md) — project overview and quickstart
- [`../CLAUDE.md`](../CLAUDE.md) — the design invariants and build order (read first)
- [`../SPEC.md`](../SPEC.md) — the working build spec
- [`../schema.sql`](../schema.sql) — the database (RLS, triggers, seeds); run it first
- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) — how to deploy

## Run it

```bash
# from this directory (steppe/)
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev                  # http://localhost:3100
```

Auth is **magic link only** (no passwords). Trust state — `verified`, `role`,
vote weight — is enforced in Postgres (RLS + triggers), never in the client;
see the invariants in `../CLAUDE.md` before changing anything trust-sensitive.

## Layout

- `app/(site)/` — the public marketing pages (Broadsheet × Plate design layer)
- `app/protected/` — the member app (gated by `LAUNCH_PHASE` until go-live)
- `app/api/`, `app/q/`, `app/p/` — public endpoints and the printed-QR redirects
- `lib/supabase/` — server/client/admin Supabase clients and the launch-phase proxy
- `messages/`, `lib/i18n/` — English + Spanish catalogs (full parity, both layers)
