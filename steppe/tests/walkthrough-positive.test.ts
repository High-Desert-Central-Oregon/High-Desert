import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { dbReachable, makeClient, impersonate } from "./helpers/pg-impersonation";

const dbUp = await dbReachable();

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

// Walkthrough X1 — the Exchange happy path (IMPLEMENTED; spec §10 step 5).
// post → author edit → moderator pin/unpin → remove → author appeal → a
// DIFFERENT moderator overturns → restored. Everything through the same
// grants/policies/RPCs the app uses; rolled back, nothing persists.
describe.skipIf(!dbUp)("Walkthrough X1: post → pin → remove → appeal → overturn", () => {
  let client: pg.Client;
  let h: ReturnType<typeof impersonate>;

  beforeAll(async () => {
    client = makeClient();
    await client.connect();
    h = impersonate(client);
  });
  afterAll(async () => {
    await client?.end();
  });

  it("carries a post through the full moderation chain with the audit trail intact", async () => {
    await h.inTxn(async (c) => {
      const author = "0x100000-0000-0000-0000-000000000001".replace("x", "a");
      const mod1 = "0b100000-0000-0000-0000-000000000002";
      const mod2 = "0c100000-0000-0000-0000-000000000003";
      await h.createMember(author, "x1-author@walk.test", { verified: true });
      await h.createMember(mod1, "x1-mod1@walk.test", { verified: true, role: "moderator" });
      await h.createMember(mod2, "x1-mod2@walk.test", { verified: true, role: "moderator" });
      const everyone = (await c.query("select id from groups where slug='everyone'")).rows[0].id;

      // 1 · The member posts to the community board (the app's exact payload).
      await h.actAs(author);
      const post = (
        await c.query(
          "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'offer', 'Free tomato starts', 'Heirloom seedlings, more than I can plant.') returning id",
          [everyone, author],
        )
      ).rows[0].id;

      // 2 · Author edits — edited_at is server-stamped; identity frozen.
      await c.query("update posts set title = 'Free tomato starts (updated)' where id=$1", [post]);
      await c.query("reset role");
      const afterEdit = (
        await c.query("select edited_at, group_id, pinned_at from posts where id=$1", [post])
      ).rows[0];
      expect(afterEdit.edited_at).not.toBeNull();
      expect(afterEdit.group_id).toBe(everyone);
      expect(afterEdit.pinned_at).toBeNull();

      // 3 · A moderator pins — pinned_by recorded, audit row written (G13).
      await h.actAs(mod1);
      await c.query("select set_post_pin($1, true)", [post]);
      await c.query("reset role");
      const pinned = (await c.query("select pinned_by, edited_at from posts where id=$1", [post])).rows[0];
      expect(pinned.pinned_by).toBe(mod1);
      const pinAudit = await c.query(
        "select count(*)::int as n from audit_log where action='post.pinned' and entity_id=$1",
        [post],
      );
      expect(pinAudit.rows[0].n).toBe(1);

      // 4 · Unpin (audited), then remove with a written reason (P7 — legible).
      await h.actAs(mod1);
      await c.query("select set_post_pin($1, false)", [post]);
      const action = (
        await c.query(
          "insert into moderation_actions (target_type, target_id, action, reason, actor_id) values ('post', $1, 'remove', 'walkthrough probe', $2) returning id",
          [post, mod1],
        )
      ).rows[0].id;
      await c.query("reset role");
      const hidden = await c.query("select is_content_hidden('post', $1) as h", [post]);
      expect(hidden.rows[0].h).toBe(true);

      // 5 · The author appeals (0019 taught file_appeal posts ownership).
      await h.actAs(author);
      const appeal = (await c.query("select file_appeal($1, 'These were free seedlings.') as id", [action]))
        .rows[0].id;
      expect(appeal).toBeTruthy();

      // 6 · A DIFFERENT moderator overturns → a restore action un-hides it.
      await h.actAs(mod2);
      await c.query("select resolve_appeal($1, false, 'Removal was overbroad.')", [appeal]);
      await c.query("reset role");
      const restored = await c.query("select is_content_hidden('post', $1) as h", [post]);
      expect(restored.rows[0].h).toBe(false);
      const trail = await c.query(
        "select count(*)::int as n from moderation_actions where target_type='post' and target_id=$1",
        [post],
      );
      expect(trail.rows[0].n).toBe(2); // remove + restore — the append-only record
    });
  });
});
