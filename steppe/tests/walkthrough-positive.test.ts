import { describe, it } from "vitest";

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SCAFFOLD — NOT YET IMPLEMENTED. Automates the dry-run runbook's POSITIVE       │
// │ paths (docs/dry-run-runbook.md Walkthroughs A & B). The negative paths are     │
// │ already automated in rls-refusals.test.ts; the full A→B flows remain in the    │
// │ manual runbook. These it.todo() markers surface in every `npm run test` run as │
// │ a standing reminder of the planned work — they never fail.                     │
// │                                                                                │
// │ To implement: wire the shared harness exactly like rls-refusals.test.ts —      │
// │   const dbUp = await dbReachable();                                            │
// │   describe.skipIf(!dbUp)(..., () => {                                          │
// │     let client; let h;                                                         │
// │     beforeAll(async () => { client = makeClient(); await client.connect();     │
// │                             h = impersonate(client); });                       │
// │     afterAll(async () => { await client?.end(); });                           │
// │     it("A2 ...", async () => { await h.inTxn(async (c) => { /* fixtures as     │
// │        owner → h.actAs(moderator) → call RPC → assert committed-state reads */ │
// │     }); });                                                                    │
// │   });                                                                          │
// │ Build fixtures with h.createMember(...) and drive actions via the same RPCs    │
// │ the app calls (decide_verification, file_appeal, resolve_appeal, castVote /    │
// │ the votes upsert, the manual close). Assert on the resulting rows the way the  │
// │ runbook's confirm-blocks do. Everything rolls back — no seed, nothing persists.│
// │ See tests/helpers/pg-impersonation.ts and docs/dry-run-runbook.md.             │
// └─────────────────────────────────────────────────────────────────────────────┘

describe("Walkthrough positive paths (SCAFFOLD — see header)", () => {
  // Walkthrough A — the first conflict
  it.todo("A2: moderator approves a verification → verified + tenure set, evidence pointer purged, audit written");
  it.todo("A3–A4: a verified member posts an event; a moderator removes it with a reason → hidden + legible");
  it.todo("A5–A7: creator appeals → a DIFFERENT moderator overturns → the event is restored (chain remove→restore)");
  it.todo("A8: transparency view lists the acting moderator only, never the moderated member");

  // Walkthrough B — the first vote
  it.todo("B2/B4: five tenure-weighted ballots aggregate to yes 4.5 / no 1.0 / abstain 3.0 after the window closes");
  it.todo("B3: a member may revise their ballot while the proposal is open (coercion-resistance); one row per member");
  it.todo("B4: the close audit records the aggregate only — no user_id, no per-ballot choice");
});
