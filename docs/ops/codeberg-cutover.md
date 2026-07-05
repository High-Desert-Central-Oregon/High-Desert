# Codeberg cutover runbook

Moving Steppe's **canonical** home to **Codeberg** (hosted Forgejo) while keeping
production deploys on **Vercel** working. Codeberg becomes the source of truth;
**GitHub becomes a write-only deploy mirror** that Vercel watches.

- Canonical repo (Codeberg): `codeberg.org/steppe-community/steppe`
- Deploy mirror (GitHub, unchanged): `github.com/High-Desert-Central-Oregon/High-Desert`

> **Secrets:** never paste a token, password, or hook URL into this file, a
> command, or a commit. Tokens are entered by a human in a forge UI and referenced
> here only by placeholder (`<GITHUB_PAT>`). The commands below that switch the
> canonical remote are **printed for you to run** — they are not run for you.

---

## 0. Prerequisites (human-only, done in the forge UIs)

1. Create the Codeberg repo by **import**: Codeberg → **`+` → New Migration → GitHub**,
   source `https://github.com/High-Desert-Central-Oregon/High-Desert`, name it
   **`steppe`**. (The repo is tiny — `.git` ≈ 4.6 MB, no LFS, no submodules — so this
   is fast and clean. Both `main` and any feature branches come across.)
2. Have an SSH key registered on Codeberg (Settings → SSH/GPG Keys) so pushes need no
   token. HTTPS works too; this runbook uses SSH URLs and notes the HTTPS form.

---

## 1. First-clone setup — re-enable the DCO sign-off hook (do this every fresh clone)

The Signed-off-by trailer is added by a **clone-local** hook
(`.githooks/prepare-commit-msg`) that is wired up with `core.hooksPath`. That config
is **not** stored in the repo and does **not** survive a fresh clone — without it,
`git commit -s` still works but a bare `git commit -m` silently stops being signed.

After cloning the canonical repo from Codeberg, run:

```bash
git clone git@codeberg.org:steppe-community/steppe.git steppe
cd steppe
git config core.hooksPath .githooks   # re-arm the auto DCO sign-off hook
```

Verify: `git config --get core.hooksPath` → `.githooks`.

---

## 2. Make one `git push` update both forges (local dual-push)

This points `origin` at Codeberg (canonical) and adds **both** Codeberg and GitHub as
push URLs, so a single `git push` writes to both and Vercel keeps auto-deploying off
the GitHub mirror.

> ⚠️ **Run these yourself** — this is the human-confirmed canonical-remote switch.
> Do it once the Codeberg repo exists and you can push to it.

```bash
# 1) Point origin's fetch URL at Codeberg (CANONICAL).
git remote set-url origin git@codeberg.org:steppe-community/steppe.git
#   HTTPS alternative:
#   git remote set-url origin https://codeberg.org/steppe-community/steppe.git

# 2) Add explicit push URLs. The FIRST `--add --push` replaces the implicit
#    "push = fetch URL", so you must add BOTH targets explicitly — Codeberg first
#    (canonical), then the GitHub mirror.
git remote set-url --add --push origin git@codeberg.org:steppe-community/steppe.git
git remote set-url --add --push origin git@github.com:High-Desert-Central-Oregon/High-Desert.git

# 3) Verify: fetch = Codeberg; push = BOTH.
git remote -v
# origin  git@codeberg.org:steppe-community/steppe.git (fetch)
# origin  git@codeberg.org:steppe-community/steppe.git (push)
# origin  git@github.com:High-Desert-Central-Oregon/High-Desert.git (push)
```

Now `git push` (or `git push origin main`) writes to Codeberg **and** GitHub in one
command. Pull/fetch comes only from Codeberg (the canonical source).

**Caveats**
- This lives in **your local `.git/config`** — it is per-clone. Every machine/clone
  that should dual-push must run these commands (or use the server-side mirror below).
- No force-push, no history rewrite. If the GitHub mirror ever rejects a push because
  it diverged, reconcile by hand — never `--force` the mirror.

---

## 3. Robust alternative — server-side push mirror (Codeberg → GitHub)

Preferred for reliability: let **Forgejo mirror server-side**, so mirroring is
decoupled from anyone's local git config. Every push that lands on Codeberg is
auto-pushed to GitHub by Codeberg itself; contributors just push to Codeberg.

In the Codeberg repo: **Settings → Repository → Push Mirrors** (Forgejo "Mirror
Settings" / "Push Mirrors"), then add a mirror:

- **Git Remote Repository URL:** `https://github.com/High-Desert-Central-Oregon/High-Desert.git`
  (plain https — do **not** embed credentials in the URL).
- **Authorization → Username:** your GitHub username (`Gchism94`).
- **Authorization → Password/Token:** **`<GITHUB_PAT>`** — see the token recipe
  below. **Never** put this value in the repo, a command, or a commit.
- **Sync interval:** e.g. every 8h, and/or enable **"Sync when new commits are
  pushed"** for near-immediate mirroring.
- **Branch filter:** `main`. Not strictly required, but recommended: the mirror's
  only job is feeding Vercel production (which watches `main`); unfiltered, every
  topic branch mirrored to GitHub triggers a Vercel preview build, and WIP
  branches surface on the public mirror before they land. Globs work
  (`main,release/*`) if more is ever needed; branches already on GitHub but
  outside the filter just go stale until deleted manually.

### The token recipe (the org gotcha)

The mirror repo belongs to an **organization** (`High-Desert-Central-Oregon`),
and that changes which tokens work:

- **Recommended: a CLASSIC PAT with the `repo` scope.** GitHub → Settings →
  Developer settings → Personal access tokens → **Tokens (classic)** → generate
  with **`repo`** checked. A classic PAT acts with your full push rights on org
  repos with no org-side opt-in. (Verified: a classic `repo`-scoped token pushes
  to this org repo; `main` carries no branch protection; the account has push +
  admin.)
- **A fine-grained PAT only works here if BOTH are true:** (1) its **Resource
  owner** is set to `High-Desert-Central-Oregon` — *not* your personal account —
  with **Repository access → Only select repositories → High-Desert** and
  **Permissions → Contents: Read and write**; and (2) the org has fine-grained
  PATs **enabled** (org Settings → Third-party Access → Personal access tokens —
  GitHub restricts them by default, and may queue them for approval). A
  fine-grained token created under the personal account, or under an org that
  hasn't opted in, fails with a permission error even though your account can
  push — this is the failure mode observed 2026-07-04.
- After saving the mirror, use **"Synchronize now"** and check the mirror row's
  error column: a red timestamp with a permission message means the token, not
  the repo.

With this in place, the local dual-push in §2 is optional — pushing to Codeberg alone
keeps GitHub (and therefore Vercel) up to date. Using both is harmless (the mirror is
idempotent).

> If GitHub's token policy or the mirror ever needs rotation, regenerate the PAT in
> GitHub and update **only** the Codeberg mirror's stored token in the UI. No repo
> change is needed. Until the mirror is green, deploys require a manual
> `git push https://github.com/High-Desert-Central-Oregon/High-Desert.git main`
> after each Codeberg push.

---

## 4. Deploy path (unchanged at cutover)

Vercel stays wired to its **GitHub** Git integration and auto-builds the GitHub
mirror's `main` (Vercel project **Root Directory = `steppe`**; no `vercel.json` in
the repo). Because the mirror updates on every push, deploys keep working with **no
Vercel change**. The future fully-off-GitHub path (a Woodpecker → Vercel deploy hook)
is staged, disabled, in `.woodpecker/ci.yml` — see `docs/decisions/codeberg-migration.md`.

---

## 5. Cutover checklist (human-only steps, in order)

1. **Create** the Codeberg repo `steppe` via **New Migration** from GitHub (§0).
2. **Add CI secrets** in Codeberg (Woodpecker): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (build), and — only if/when you enable the
   opt-in deploy step — `VERCEL_DEPLOY_HOOK`.
3. **Configure the push mirror** Codeberg → GitHub with your `<GITHUB_PAT>` (§3),
   **or** plan to use local dual-push (§2).
4. **Run the canonical-remote switch** commands in §2 on your working clone.
5. **First-clone hook:** on any fresh clone, re-run `git config core.hooksPath .githooks` (§1).
6. **Verify a test deploy:** push a trivial commit to Codeberg → confirm it lands on
   GitHub (mirror) → confirm Vercel builds and the deploy is green.
7. **Retire** the GitHub Actions only after cutover is verified — N/A here (there are
   none); `.woodpecker/ci.yml` is the new CI.
