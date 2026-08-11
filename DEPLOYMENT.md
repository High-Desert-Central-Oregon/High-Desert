# Deploying Steppe

Steppe is a standard **Next.js (App Router) + Postgres** app. It has no
dependency on any specific host — it runs anywhere you can run Node and reach a
Postgres database. This document is written so the eventual move off Vercel to a
self-hosted box is mechanical: nothing below is Vercel-specific.

> **The app lives in the `steppe/` subdirectory**, not the repo root. All build
> and run commands below are run from `steppe/`. The repo root holds the database
> schema, migrations, and docs.

---

## 1. Environment variables

Set these in the host's environment (or a `steppe/.env.local` for local runs —
see `steppe/.env.example`). The first two are public (shipped to the browser);
the last two are server-only and must never be exposed to the client.

| Variable | Note |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project's API URL (e.g. `https://xxxx.supabase.co`, or your self-hosted Supabase URL). Public. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (a.k.a. **anon**) key. RLS still gates every row, so this is safe in the browser. Public. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret/service-role key. **Bypasses RLS** — server-only (used by `lib/supabase/admin.ts`, e.g. `/api/interest`). Never prefix with `NEXT_PUBLIC_`. |
| `LAUNCH_PHASE` | `prelaunch` (default) serves only the public marketing pages + `/join`; `live` opens the member app. See `lib/supabase/proxy.ts`. |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin (`https://www.steppe.community`) for absolute metadata URLs (OG/Twitter cards). Falls back to `VERCEL_URL`, then localhost — set it in prod so shared links don't carry the `*.vercel.app` machine name. Public. |

> **Naming note:** the code reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. This is
> Supabase's newer name for what older docs and dashboards call the **anon key** —
> they are the same value. Use the variable name exactly as written above, or the
> app will boot without a working Supabase client.

`PORT` (optional) overrides the listen port — see §3.

---

## 2. Runtime

- **Node.js:** there is no `.nvmrc` or `engines` field pinning a version. The
  app is developed on **Node 26 / npm 11**. Next.js 16 requires **Node ≥ 20.9**,
  so any current LTS (20 or 22) works; pin one on the host for reproducibility
  (e.g. add an `.nvmrc`).
- **Package manager:** **npm** (the lockfile is `steppe/package-lock.json`). Use
  `npm ci` for reproducible installs from the lockfile.

---

## 3. Build & run

From the `steppe/` directory:

```bash
cd steppe
npm ci            # reproducible install from package-lock.json
npm run build     # next build — produces the optimized production build
npm run start     # next start — serves the production build
```

- **Default port:** `next start` listens on **3000**. Override with the `PORT`
  env var or `npm run start -- -p 8080`.
  (Note: `npm run dev` uses port **3100**; that only affects local development.)
- Run `npm run start` behind a process manager (systemd, pm2) or a container so
  it restarts on crash/reboot.

---

## 4. Database (Postgres)

Steppe needs a **Postgres** instance. It's built against Supabase Postgres (it
uses Supabase Auth, Storage, and Row-Level Security), so the simplest path is a
Supabase project — hosted or self-hosted — but the SQL itself is standard Postgres.

**Where the schema lives (repo root):**

- **`schema.sql`** — a **baseline through migration 0015**. It is *not* the
  current schema and running it alone does not produce one. It carries the
  tables, RLS policies, triggers, views and seeds as they stood at 0015, with
  migrations `0001`–`0015` already folded in.
- **`migrations/`** — ordered, idempotent incremental changes. **Every migration
  numbered above `0015` is applied on top of the baseline and none of them is
  folded into `schema.sql`.** That is the convention from `0016` onward, and it
  is deliberate: a partially-folded `schema.sql` would give a reader no way to
  tell which parts are already in the baseline and which still need replaying.

> **The reproduction path is `schema.sql` + every migration above 0015, in
> filename order.** This is not a description of intent — it is literally what
> `scripts/reset-local.sh:40` does, and that script is the maintained definition
> of a correct rebuild. Prefer reading it over trusting this paragraph.

> There is no `supabase/migrations/` directory — migrations live in the
> repo-root `migrations/` directory. Consequently **`supabase db push` does
> nothing here**, and a bare `supabase db reset` leaves an empty database.

**Applying it:**

```bash
# Local rebuild — the supported path. Resets, applies schema.sql, replays every
# migration above 0015 in filename order, then reloads seed/dry-run-accounts.sql
# so the test suite is green afterwards. Refuses to run against a non-loopback
# host. Enumerates the migrations rather than hardcoding a list, so a new one
# needs no edit here.
./scripts/reset-local.sh

# Fresh NON-local database, by hand — the baseline ALONE IS NOT ENOUGH:
psql "$DATABASE_URL" -f schema.sql                    # baseline: through 0015
for f in migrations/*.sql; do                         # then replay 0016+ in order
  n=$(basename "$f"); n=${n%%_*}
  [ "$((10#$n))" -gt 15 ] && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

Stopping after `schema.sql` provisions an **0015-era database** — no invite
allowlist or `auth.users` signup gate (0024), no pledge campaigns (0026), no
invite tokens (0027), no `search_path` pinning (0029). The application will fail
in ways that look like code bugs.

For an existing database, apply only the pending migration(s) in order, e.g.:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/0029_search_path_sweep.sql
```

Production migrations are applied **by hand at a stop-gate**, as the owner, in
the Supabase SQL editor — see `CLAUDE.md` and the ledger conventions in
`docs/migrations-applied.md`. Which migrations are actually live is answered by
the apply-status probe in that file, run against prod — never by reading this
directory.

Always apply pending migrations **before** deploying the matching app build, or
routes that depend on new columns or tables will error. This is not theoretical:
`/api/interest` sends `interest_signups.source` unconditionally, so deploying it
against a database without that column (migration 0031) returns HTTP 500 on
**every** join submission — no row written, no confirmation email sent.

---

## 5. Self-hosting target

The intended move is to a single self-hosted box. A typical layout:

- **Reverse proxy + TLS:** put **Caddy** or **Traefik** in front of the Node
  process. Both terminate HTTPS and auto-provision Let's Encrypt certificates;
  proxy `:443` → the app's `PORT` (e.g. 3000). Caddy's two-line config or
  Traefik's labels are all that's needed — no app changes.
- **Push-to-deploy:** use **Coolify** or **Dokku** for `git push` deploys. Point
  the build at the `steppe/` subdirectory as the app root, set the build command
  to `npm ci && npm run build` and the start command to `npm run start`, and set
  the environment variables from §1. Both can also run the Postgres instance and
  manage TLS, replacing the manual reverse-proxy step if you prefer.
- **DNS:** point **`steppe.community`** (A/AAAA record) at the box's IP. The
  reverse proxy serves that hostname and obtains its certificate automatically.

None of this requires host-specific files in the repo — the proxy/PaaS config
lives on the box, not in version control.

---

## 6. Portability rules (keep it host-agnostic)

To keep that move mechanical, the codebase stays on the standard
**Next.js + Postgres** baseline:

- **No `@vercel/*` SDKs.** Don't add `@vercel/analytics`, `@vercel/og`,
  `@vercel/edge`, etc. (The dependency tree is currently clean of them — keep it
  that way.)
- **No Vercel-managed services:** no Vercel **KV**, **Cron**, **Blob**, or
  **Postgres**. Use the project's Postgres for data, Supabase Storage for files,
  and a plain scheduler (cron / systemd timer) if a periodic job is ever needed.
- **No platform-specific runtime assumptions.** There are **no** `export const
  runtime` pins anywhere — `cacheComponents` (next.config) is incompatible with
  them, and every route runs on the default Node runtime. Don't add one, and
  don't rely on an edge-only runtime or platform-injected request context.
- Anything host-specific (reverse proxy, TLS, process supervision, scheduled
  jobs) lives on the host, configured per §5 — never baked into the app.

If a feature seems to need one of the above, stop and find the standard
Next + Postgres equivalent first.
