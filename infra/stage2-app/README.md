# Stage 2 — app-only VPS (TEMPLATE, inert)

**Do not deploy before the Stage 1→2 gate** in
[`docs/decisions/selfhosting-staged-roadmap.md`](../../docs/decisions/selfhosting-staged-roadmap.md):
a second person who can own operations exists. Nothing here is wired into CI,
Vercel, or any runtime path; committing this directory changes nothing about how
Steppe runs today.

**What Stage 2 is:** the Next.js app moves to a single US VPS (4 GB / 2 vCPU,
~$40–50/mo) behind Caddy. **All state stays in managed Supabase** — Postgres,
Auth, Storage, and PITR remain managed. **Box loss = redeploy, no data loss.**
The blast radius of any mistake here is near zero; that is the point of doing
this half first.

## Prerequisites (made at Stage 2, not before)

1. The two one-line `next.config.ts` changes from the portability audit:
   `output: "standalone"` and the `outputFileTracingIncludes` entry for
   `content/**` (see [`Dockerfile`](./Dockerfile) header).
2. A box passing the hardening baseline (see `infra/stage3-full/README.md`
   §Hardening — the same checklist applies to this box).
3. `.env` on the box (chmod 600), populated **by name** from the list in
   [`docker-compose.yml`](./docker-compose.yml). Never commit it; never use
   placeholder values.

## Path A — Coolify (push-to-deploy)

1. Install Coolify on the box; connect the Codeberg repo.
2. New app → Dockerfile build → **Base directory `steppe/`**, Dockerfile
   `../infra/stage2-app/Dockerfile`; or use Coolify's Nixpacks with build
   `npm ci && npm run build`, start `npm run start`.
3. Enter the env names from the compose header (Coolify stores values on-box).
4. Map the domain; Coolify's proxy can replace the host Caddyfile — if you use
   it, port the security headers from [`Caddyfile`](./Caddyfile) into its config.
5. Deploys = git push (Codeberg webhook) or manual redeploy in the UI.

## Path B — plain compose

```bash
cd infra/stage2-app
cp /path/to/secure/.env .env && chmod 600 .env
docker compose build        # bakes NEXT_PUBLIC_* into the client bundle
docker compose up -d
# host Caddy:
sudo cp Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

DNS cutover: lower the `steppe.community`/`www` TTL in advance, point A/AAAA at
the box, watch Caddy obtain certificates, verify, then decommission the Vercel
alias. (Vercel keeps working until DNS moves — the cutover is reversible by
pointing DNS back.)

## Rollback

- **App bad after deploy:** `docker compose build` from the previous git tag and
  `up -d` again — or in Coolify, redeploy the previous build. Tag releases
  (`git tag stage2-YYYYMMDD`) so "previous" is always addressable.
- **Box dead:** provision a new box, run this directory again, repoint DNS.
  Total loss of the machine loses nothing but minutes: **the compose config in
  the repo is the backup**, because no state lives here.

## Verifying a deploy

`curl -I https://www.steppe.community` (200, headers present) · `/q` and `/p`
302 with `no-store` · `/api/qr` 400 on garbage · `/protected` 307 while
`LAUNCH_PHASE=prelaunch` · `/legal/privacy` renders (proves the
`outputFileTracingIncludes` prerequisite).
