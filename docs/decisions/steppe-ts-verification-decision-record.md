# Decision Record — Trust & Safety, Verification Retention, and Minors-Version Governance

**Date:** 2026-06-27
**Status:** Adopted (canon). Supersedes prior verification-storage and T&S assumptions noted below.
**Scope:** Policy and data-handling posture. Legal specifics flagged for counsel, not settled here.
**Suggested repo path:** `docs/decisions/trust-safety-verification-retention.md`

---

## Context

The anonymity / illegal-activity question surfaced a framing error worth correcting in canon: the platform's safety capability had been attributed to the *stored* verification record. It actually lives in the *gate* — requiring proof of residency to get in. Deterrence and Sybil suppression happen at the moment of verification, independent of whether the proof is kept afterward. Retaining raw evidence therefore added liability and an unmask capability without adding ongoing safety value. Deleting it immediately **dissolves** the "who can de-pseudonymize a member" problem rather than requiring it to be governed.

The guiding posture: Steppe is not anonymous — it is **pseudonymous to peers, verified at the gate, and identity-minimal in storage.**

---

## Decisions

### 1. Verification retention — minimal by design
- Raw verification evidence is **deleted immediately** after the residency check. It is never a persistent store.
- The organization retains only: a `verified` flag, the verification date, and the method. No PII, no documents, no identity.
- This **supersedes** the prior "private verification-evidence storage bucket" treated as a durable store. If such a bucket exists, it becomes a transient, auto-purged review space only.
- "Immediately" means **actually purged** — gone from the transient review space and not lingering in database backups or audit logs. The audit log records the *fact* of a purge, never the evidence.

### 2. Ban-evasion / dedup token — deferred (primitive now, feature-later-by-vote)
- For launch, retain **nothing identity-derived**. A banned member can re-verify and return; among ~2,300 neighbors who know each other, that path is high-friction and socially visible.
- If ban-evasion becomes a **demonstrated** problem, members may vote to add a one-way, salted fingerprint of the residency proof — confirming "this identity already had an account" without revealing who. Escalate on evidence, not anticipation.

### 3. Two-tier trust & safety model
- **Legal floor (non-votable):** illegal goods/services, CSAM (mandatory NCMEC reporting on actual knowledge), non-consensual intimate imagery (TAKE IT DOWN Act takedown process), credible threats, trafficking. This is a compliance obligation of the legal entity — not a community norm.
- **Community norms (member-governed):** everything above the floor — civility, harassment, allowed marketplace categories — lives in the amendable Schedule of Defaults.

### 4. Moderation posture — reactive, human-scale
- Report-driven: members report, moderators act, decisions hit the transparency log.
- **No proactive content scanning.** Disproportionate at this scale and contrary to privacy-by-architecture; it is also the "moderation drifting toward a centralized staffed function" risk previously flagged.

### 5. Marketplace
- **No on-platform payments.** Neighbors transact off-platform; this keeps the org out of money-transmitter, escrow, and payment-liability territory.
- Pair with a prohibited-items list and report-a-listing. Verified identity is the primary deterrent.

### 6. Data minimization
- Short retention windows on chat / DMs. Minimizing retained data is both the privacy-protective and the liability/subpoena-exposure-reducing move — they point the same direction.

### 7. Terms & website copy — honest under-promising
- Public copy **describes and advertises** the real posture: we verify you're a neighbor, then delete the proof; we hold no identity documents; we cannot disclose verification evidence we do not keep.
- The copy must not over-promise in either direction. Verification evidence: deleted immediately. Other data (account details, chat within its retention window): minimal, and disclosed only under valid legal process. The "we hold nothing" claim is **scoped to verification/identity, not all data.**
- Rationale: practice exceeds promise. Ninth-Circuit treatment (governs Oregon) can enforce a platform's terms as duties, so under-promising is the safe posture.

### 8. Minors-only version — future member-vote item
- Whether to build a separate minors version is a **member vote**. The **safety floor is not votable** — members decide whether to build, not whether it's safe.
- The vote must be **informed**: legal and operational cost, plus the non-negotiable floor (COPPA if under-13 is ever included, mandatory CSAM reporting, expanding state age-verification mandates), presented alongside the question. **Counsel review precedes any build.** This is the most legally-loaded feature on the roadmap.
- A *separate* minors app keeps adult↔minor DMs out of the main app entirely, removing the grooming surface.

---

## Tradeoff accepted (knowingly)

This is the Signal / Apple posture: a subpoena for verification identity returns nothing because nothing is stored. The cost is that even in a genuine emergency — a credible threat traced to a member — the org cannot identify anyone from verification data. Adopted as a deliberate choice, not a side effect.

---

## Supersedes

- "Private verification-evidence storage bucket" as a durable store → transient, auto-purged review space; retain only `verified` flag + date + method.
- Any prior framing locating safety capability in the stored verification record → safety lives in the verification **gate**.
- Current public website / terms copy implying retained verification information → to be realigned (see the privacy/terms alignment task).

---

## Open / counsel items

- Oregon nonprofit exposure; exact CSAM→NCMEC and NCII procedures; precise terms language — bring this record **to** platform-liability counsel; it is the framework, not a substitute.
- Confirm the actual verification code purges immediately before any copy advertises it (the alignment task's Part 0 gate).
- Watch the shifting Section 230 landscape (Graham–Durbin sunset bill on file for 2027).

---

## Changelog
- **2026-06-27** — Initial adoption.
