# Decision Record — Canonical home moves to Codeberg; GitHub becomes a deploy mirror

**Date:** 2026-06-29
**Status:** Adopted (canon).
**Scope:** Where the repository's source of truth lives, how production keeps
deploying, and what runs CI. Does **not** touch licensing (a separate, counsel-pending
human decision) or any application code.

---

## Context

Steppe is community-owned, member-governed civic infrastructure; its forge should
reflect that rather than sit on a single commercial platform. **Codeberg** (a
nonprofit, community-run **Forgejo** host) is the values-aligned home, and moving the
canonical repository there is the first, low-cost step on the longer
infrastructure-**sovereignty** arc — well before the heavier lift of self-hosting the
app itself.

The blocker to "just leave GitHub" is the **deploy provider**. Production runs on
**Vercel**, wired through Vercel's **GitHub Git integration** (no `vercel.json` in the
repo; the Vercel project simply watches the GitHub repo, Root Directory = `steppe`).
Re-homing or replacing that deploy path is its own project. So we decouple "where the
code lives" from "what builds it."

The repo is trivial to move: `.git` ≈ 4.6 MB, ~264 tracked files, **no Git LFS, no
submodules**, and — notably — **no CI to port** (there was never a `.github/workflows/`).

---

## Decisions

### 1. Codeberg is canonical; GitHub is a write-only deploy mirror
- The **source of truth** is `codeberg.org/<CODEBERG_OWNER>/steppe` (repo name
  **`steppe`**, not the legacy GitHub name `High-Desert`). Issues and PRs live there.
- **GitHub** (`High-Desert-Central-Oregon/High-Desert`) stays as a **write-only
  mirror** so Vercel's existing Git integration keeps auto-deploying with **no Vercel
  change**. We do not delete the GitHub repo, change its visibility, or alter branch
  protection.

### 2. Mirroring: prefer a server-side Forgejo push mirror
- Preferred: a **Codeberg → GitHub push mirror** (Forgejo "Push Mirrors"), so mirroring
  is decoupled from anyone's local git config. The GitHub PAT it needs is entered by a
  human in Codeberg's UI and referenced only as a placeholder (`<GITHUB_PAT>`) — never
  committed.
- Fallback / belt-and-suspenders: **local dual-push** — `origin` → Codeberg with GitHub
  added as a second push URL (`git remote set-url --add --push`), so one `git push`
  writes both. Both approaches are documented in
  [`docs/ops/codeberg-cutover.md`](../ops/codeberg-cutover.md); the canonical-remote
  switch is run by a human, not automated.

### 3. CI is Woodpecker (net-new, not a translation)
- New CI lives at [`.woodpecker/ci.yml`](../../.woodpecker/ci.yml): `npm ci` → `npm run
  lint` → `npm run build`, scoped to `steppe/`, with build secrets referenced **by
  name** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and added
  in Codeberg. There is no test step because no test framework exists yet.
- This is **not** a port of GitHub Actions — there were none. It is the first CI the
  project has had.

### 4. Deploy stays on GitHub for now; a fully-off-GitHub path is staged but disabled
- Default: change nothing. Vercel keeps building the GitHub mirror.
- Staged for later: a **commented-out, opt-in** Woodpecker step that POSTs a Vercel
  **Deploy Hook** read from a CI secret named `VERCEL_DEPLOY_HOOK`. It is disabled by
  default and only relevant once Vercel no longer watches GitHub.

### 5. Licensing is untouched
- This migration adds/changes **no LICENSE**. The existing license stays as-is;
  any license decision is a separate, counsel-pending human call.

---

## Deferred — self-hosting (year-two sovereignty milestone)

Moving the **forge** to Codeberg is deliberately separate from, and earlier than,
self-hosting the **application**. Leaving Vercel for a self-hosted Next.js container
(and self-hosted Supabase) is the heavier **year-two infrastructure-sovereignty
milestone**; its concrete readiness and blockers are already mapped in
[`docs/portability-audit.md`](../portability-audit.md). When that lands, the opt-in
Woodpecker → Vercel/host deploy step (Decision 4) is the mechanism to flip, and GitHub
can finally be retired.

---

## Consequences

- One extra moving part (the mirror) and one human-managed credential (the GitHub PAT
  in Codeberg). Acceptable for keeping deploys green with zero Vercel/app changes.
- Contributors clone from Codeberg and must re-run `git config core.hooksPath .githooks`
  per clone (the DCO sign-off hook is clone-local) — documented in the runbook and the
  README.
- Until the deferred self-host milestone, production still depends on GitHub + Vercel.
  The dependency is now **mirror-deep**, not identity-deep: the canonical project no
  longer lives on GitHub.

---

## Changelog
- **2026-06-29** — Initial adoption.
