# Deploy provenance — is the mirror deploying what we think?

**The risk (health-check H3).** The canonical repository is **Codeberg**
(`git@codeberg.org:steppe-community/steppe.git`). Production is served by **Vercel**, which
builds off a **GitHub mirror** of this repo (Vercel's Git integration watches GitHub, not
Codeberg — see `.woodpecker/ci.yml`). So the chain is:

```
push -> Codeberg main (canonical)  ==push-mirror==>  GitHub main (mirror)  ==watches==>  Vercel deploy
```

If the Codeberg→GitHub push mirror is **stuck, paused, or partial**, GitHub `main` lags
Codeberg `main`, and Vercel deploys **stale code — silently.** Nothing in the canonical repo
notices, because the mirror is a server-side setting outside it.

## The automated check

`.woodpecker/ci.yml` → **`mirror-provenance`** runs on every push to `main`. The mirror URL
is a **public** GitHub path, so it is **defaulted in-repo** — the check always runs and does
not depend on secret injection. It compares the mirror's `main` HEAD to the canonical HEAD
(`CI_COMMIT_SHA`), retrying for ~60s to tolerate normal async mirror lag:

- **Converges** → `PROVENANCE OK` (Vercel will deploy canonical). Pipeline passes.
- **Does not converge in ~60s** → the step **fails loudly** with both SHAs, so a stuck mirror
  is visible in CI instead of shipping stale code unnoticed.

### Why the URL isn't a required secret

An earlier version read the URL from a `MIRROR_GIT_URL` secret and soft-skipped when it was
empty. In **Woodpecker 3.x an image-scoped secret is only injected into plugin steps**, not
plain `commands` steps like this one — so `from_secret` resolved to empty and the check
silently skipped even with the secret set correctly in the UI. Since the mirror URL is a
**public** repo path (not sensitive), it is now hardcoded as the default in the step; the
`MIRROR_GIT_URL` env/secret remains an **optional override** if the mirror ever moves.

Canonical repo is Codeberg `steppe-community/steppe`; the GitHub **mirror** lives at the
separate `High-Desert-Central-Oregon/High-Desert` path — don't conflate the two.

## Manual fallback (no CI, or an ad-hoc spot check)

Run this locally to compare the mirror to canonical for any branch (default `main`):

```sh
BRANCH=main
CANON=$(git ls-remote git@codeberg.org:steppe-community/steppe.git "refs/heads/$BRANCH" | awk '{print $1}')
MIRROR=$(git ls-remote https://github.com/High-Desert-Central-Oregon/High-Desert.git "refs/heads/$BRANCH" | awk '{print $1}')
echo "canonical (Codeberg): $CANON"
echo "mirror    (GitHub):   $MIRROR"
[ "$CANON" = "$MIRROR" ] && echo "OK — mirror is current" \
                         || echo "DRIFT — mirror is behind/ahead; Vercel may deploy stale code"
```

If it reports **DRIFT**: check the Codeberg repo's push-mirror settings (Settings → Mirroring),
confirm the mirror is enabled and not erroring, and trigger a sync. Re-run until the two SHAs
match before trusting the next production deploy.

## When to check

- **After any push to `main`** (the CI step does this automatically).
- **Before relying on a production deploy** during launch week — a quick manual check closes the
  gap between "I pushed" and "Vercel actually has it."
