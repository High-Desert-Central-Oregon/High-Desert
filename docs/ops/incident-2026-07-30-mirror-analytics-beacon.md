# Incident — a third-party analytics beacon reached production via the GitHub mirror

**Date:** 2026-07-30
**Severity:** invariant breach, member-facing
**Status:** mirror repaired; **production not yet restored at time of writing** (see *Remediation*)
**Author:** Greg Chism, Founding Executive Director

---

## What happened, in one paragraph

A Vercel GitHub App bot opened and merged a pull request **directly on the GitHub mirror** —
a repository that is supposed to be a read-only artifact of Codeberg — adding
`@vercel/analytics` and rendering `<Analytics />` in the **root** layout. Vercel builds from
that mirror, so the change went to production without ever existing in the canonical
repository, without review, without a DCO sign-off, and without any CI gate seeing it. For
roughly two hours, every page Steppe served — including `/privacy`, whose live text says the
opposite — shipped a third-party analytics beacon to every visitor. This violates
**CLAUDE.md invariant 8**: *"No ads, no behavioral tracking, no dark patterns. No third-party
ad/analytics trackers."*

---

## Timeline (UTC, 2026-07-30)

| Time | Event |
|---|---|
| 16:54:33 | Canonical `367017b` pushed (PR #33). Woodpecker **#227**, `mirror-provenance` **success**. |
| 19:47:53 | Canonical `92dddb2` pushed (PR #35, the 0028 ledger). Woodpecker **#230**, `mirror-provenance` **success**. **Last canonical push.** |
| 19:48:03 | Vercel production deploy `dpl_FNiwrCL61GzghUXT8WvAHJ4JiCVQ` from `92dddb2`. Clean — no beacon. |
| 19:53:37 | `vercel[bot]` commits **`ec06c0e`** "Install Vercel Web Analytics" to branch `vercel/install-vercel-web-analytics-nphls1` **on the mirror**. Six minutes after the last canonical push. |
| 19:53:41 | Preview deploy `dpl_3A9ZPaG84PcKYzrKw5CKYoZVcw84` from `ec06c0e`. |
| 20:58:23 | **PR #1 merged on GitHub** as **`020c4f6`**, author `Greg T. Chism <38962243+Gchism94@users.noreply.github.com>`, committer `GitHub <noreply@github.com>`. Neither commit carries a `Signed-off-by`. |
| 20:58:28 | Vercel production deploy `dpl_EWACg37qTAj31CjMQEZ5o2jCDp2Q` from `020c4f6` begins. |
| **20:59:47** | **That deploy goes READY and is aliased to `www.steppe.community` / `steppe.community`. The beacon is live.** |
| 21:04:15 | `vercel[bot]` commits **`c628f39`** to a **second** branch (`…-i-loz35f`, PR #2) — a repeat attempt. Not merged. |
| 21:04:20 | Preview deploy `dpl_4amzTuq6WsHtHPX771LWuAQwm54L` from `c628f39`. |
| ~22:5x | **Detected** during a read-only mirror audit — not by any alarm. |
| ~23:0x | Mirror `main` force-reset to canonical `92dddb2`. Both bot commits leave `main`. |
| 23:12 | Production still serving `dpl_EWACg37qTAj…`; Vercel did not rebuild an already-built SHA. |

**Exposure window: 20:59:47 UTC until production is restored.** At the time of writing that is
approximately two hours and counting.

---

## What was served, and to whom

`<Analytics />` was placed in `steppe/app/layout.tsx` — the **root** layout — so it rendered on
**every route**: the marketing landing, `/join`, `/invite`, `/auth/login`, `/privacy`, and every
`/protected/*` member page. Confirmed live in the React Flight payload of `/`, `/join`,
`/auth/login`, and `/invite`, and in the shipped layout chunk, which contains both
`/_vercel/insights/script.js` and `va.vercel-scripts.com/v1/script.debug.js`.

`https://www.steppe.community/_vercel/insights/script.js` returned **200**.

**Including `/privacy`.** That page's live text reads:

> a member-owned nonprofit that runs no ads, **keeps no trackers**, and has nothing to gain from
> your information

> **No third-party trackers**, no advertising pixels, and no behavioral profiles.

The page making that promise was itself shipping the tracker. That is the part of this incident
that is not merely a process failure.

---

## What the beacon collected — documented behaviour, and what is unknown

**Documented for `@vercel/analytics` 2.0.1.** Vercel's documentation describes Web Analytics as
collecting, per pageview: the **path/route**, **referrer**, **UTM query parameters**, and
coarse client facts derived from the User-Agent and request — **country**, **operating system**,
**browser**, and **device type**. Vercel states it sets **no cookies**, does not store IP
addresses, and derives a visitor identifier by hashing request attributes on a rotating daily
basis rather than persisting an identity.

**What is unknown, stated as unknown:**

- **Whether any data was actually ingested or retained.** Two signals say probably not: the
  ingestion endpoint `/_vercel/insights/view` returned **404**, and the Vercel Web Analytics
  API for this project returns **`Web Analytics not found`** — there is no dataset. That is
  consistent with the script being served while collection was never provisioned. It is **not
  proof**: `/view` may be POST-only and return 404 to a GET, and a dataset can be absent for
  reasons other than "nothing arrived."
- **How many visitors loaded it.** Not determinable from here.
- **Whether Vercel's own edge logging recorded the beacon requests independently** of the
  Analytics product.

Nothing beyond the above should be asserted. In particular, this record does **not** claim that
no member data left the platform — it claims that no evidence of collection was found, and
names the limits of that search.

---

## Root cause

**1. The mirror was writable, by a bot, with merge rights.** The GitHub mirror is documented as
an artifact — `docs/deploy-provenance.md`: *"push → Codeberg main (canonical) ==push-mirror==>
GitHub main (mirror) ==watches==> Vercel deploy."* Nothing in that model anticipates writes
*to* the mirror. But the Vercel GitHub App installation holds `contents: write`,
`pull_requests: write`, `administration: write`, `workflows: write`, and `repository_hooks:
write`, and mirror `main` had **no branch protection at all** (`Branch not protected`). The bot
could therefore author a commit, open a PR, and have it merged — which is exactly what happened,
twice.

**2. `mirror-provenance` is a push-time gate, blind to mirror-side writes.** The check is real
and its comparison is correct — it requires exact equality between mirror `main` and
`CI_COMMIT_SHA`, so an *ahead* mirror fails it just as a *behind* one does. But it is gated
`when: event: push, branch: main` **on Codeberg**. A change introduced on the mirror produces no
Codeberg push event, so the check never runs. The divergence opened six minutes after the last
canonical push and nothing has pushed since. The gate had no opportunity to fire.

**3. A control that fires unwatched is a control you do not have.** This is the second time the
mirror has been out of step. The first time, Woodpecker **#218** on `ab40577` **failed on
`mirror-provenance`** — the check worked, reported a real mismatch, and the failure was not
acted on. Had it been, the writable-mirror problem would have been examined a week earlier and
this incident would likely not have happened. The lesson is not "add a check." The check
existed and was correct. The lesson is that an unmonitored red build is indistinguishable from
a green one.

---

## Remediation

**Done.**

- GitHub mirror `main` force-reset to canonical `92dddb2`. Verified: mirror `main` ==
  Codeberg `main` == `92dddb2`; `ec06c0e` and `020c4f6` are both off `main`.
- **Canonical was not modified and imported nothing.** Neither bot commit was merged,
  cherry-picked, or reproduced. The change is forbidden by invariant 8, not merely unsigned —
  there is no version of it that would have been acceptable with a sign-off.

**Not done at time of writing — production still serves the beacon.**

Vercel did **not** rebuild after the force push: it had already built `92dddb2` and created no
new deployment (zero deployments after the push). Production remains aliased to
`dpl_EWACg37qTAj31CjMQEZ5o2jCDp2Q`, built from the now-orphaned `020c4f6`.

The clean artifact already exists: **`dpl_FNiwrCL61GzghUXT8WvAHJ4JiCVQ`**, production-target,
built from `92dddb2` at 19:48:03, verified to contain **zero** `Analytics` references and
**zero** `_vercel/insights` references, with its insights endpoint returning 307 rather than
200. Restoring production is a **promote/rollback to that deployment** in the Vercel dashboard —
an alias move, not a rebuild. It requires dashboard access that the tooling used for this
remediation does not have.

**Two bot branches remain on the mirror** and should be deleted, or PR #2 can be merged by
anyone with access and the incident repeats:

- `vercel/install-vercel-web-analytics-nphls1` → `ec06c0e`
- `vercel/install-vercel-web-analytics-i-loz35f` → `c628f39` (PR #2, still open)

---

## The standing rule

**Nothing reaches production that has not passed through Codeberg. The mirror is an artifact,
never a source.**

Concretely, that means the mirror is write-only *from* Codeberg: no human and no bot authors
there, no PR is opened or merged there, and any commit found on the mirror that is not an
ancestor of Codeberg `main` is by definition an incident, regardless of what it contains or who
signed it.

This is also the second entry in the same ledger as `docs/ops/deferred-hardening.md` item 9
(*advisor remediations are migrations, never dashboard clicks*). Both incidents share a shape:
a vendor's convenience affordance wrote to infrastructure outside the migration/review record,
and the repository could not see it. The rule generalises — **a vendor UI that offers to make a
change for you is offering to make it unreviewable.**

---

## Follow-ups

- **Reduce the Vercel GitHub App's write surface** — see the permissions table above. Tracked
  with the precise steps outside this record.
- **Continuous mirror-equality monitoring**, scheduled rather than push-triggered — filed as
  `docs/ops/deferred-hardening.md` item 11, with the condition that raises it.
- **Watch the CI signal.** Pipeline #218's failure going unnoticed is its own finding and is not
  fixed by any of the above.
