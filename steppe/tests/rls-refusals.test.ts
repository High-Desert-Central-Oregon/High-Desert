import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { dbReachable, makeClient, impersonate, RANDO } from "./helpers/pg-impersonation";

// Automated port of the dry-run runbook's CORE REFUSALS (docs/dry-run-runbook.md §C/§D):
// the "assume the client is hostile" guarantees. Uses the shared impersonation harness
// (direct owner Postgres connection; self-contained fixtures in a rolled-back
// transaction — no seed, nothing persists). Structural refusals are data-independent
// (grant/guard level); fixture-backed ones exercise the row-level policies. Skips
// cleanly when no local Postgres is reachable (e.g. CI without a DB).

const dbUp = await dbReachable();

describe.skipIf(!dbUp)("RLS core refusals (impersonated, owner connection)", () => {
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

  // ---- Structural refusals (data-independent: grant / function-guard level) ----

  it("G2: authenticated cannot EXECUTE log_audit (no forged audit entries)", async () => {
    await expect(
      h.runAs(RANDO, "select public.log_audit('moderation.remove','event', gen_random_uuid(), '{}'::jsonb)"),
    ).rejects.toThrow(/permission denied for function log_audit/);
  });

  it("G2: authenticated cannot EXECUTE vote_weight_for (no weight leak)", async () => {
    await expect(h.runAs(RANDO, "select public.vote_weight_for($1)", [RANDO])).rejects.toThrow(
      /permission denied for function vote_weight_for/,
    );
  });

  it("D-forge: authenticated cannot INSERT into group_members (writes are RPC-only)", async () => {
    await expect(
      h.runAs(
        RANDO,
        "insert into group_members (group_id,user_id,role,status) values (gen_random_uuid(), $1, 'maintainer','active')",
        [RANDO],
      ),
    ).rejects.toThrow(/permission denied for table group_members/);
  });

  it("G3: a non-moderator cannot decide a verification", async () => {
    await expect(h.runAs(RANDO, "select public.decide_verification(gen_random_uuid(), true)")).rejects.toThrow(
      /only moderators may decide verifications/,
    );
  });

  // ---- Fixture-backed refusals (row-level policies; RLS silently filters → assert 0 rows) ----

  it("G3: a member cannot UPDATE their own verification to approved (no update policy)", async () => {
    await h.inTxn(async (c) => {
      const uid = "a1a10000-0000-0000-0000-000000000001";
      const vid = "0d0a0000-0000-0000-0000-000000000001";
      await h.createMember(uid, "selfverify@rls.test");
      await c.query(
        "insert into verifications (id,user_id,method,evidence_path) values ($1,$2,'utility_bill','x/y.jpg')",
        [vid, uid],
      );
      await h.actAs(uid);
      const res = await c.query("update verifications set status='approved' where id=$1", [vid]);
      expect(res.rowCount).toBe(0); // RLS permits no row — the half-state path is closed
    });
  });

  it("G4: a moderator cannot hard-delete another member's event (creator-only)", async () => {
    await h.inTxn(async (c) => {
      const creator = "cc010000-0000-0000-0000-000000000001";
      const mod = "cc020000-0000-0000-0000-000000000001";
      const eid = "0ecc0000-0000-0000-0000-000000000001";
      await h.createMember(creator, "creator@rls.test", { verified: true });
      await h.createMember(mod, "mod@rls.test", { verified: true, role: "moderator" });
      await c.query(
        `insert into events (id, creator_id, neighborhood_id, title, body, starts_at, location)
         values ($1,$2,(select id from neighborhoods limit 1),'probe','body', now()+interval '1 day','loc')`,
        [eid, creator],
      );
      await h.actAs(mod);
      const res = await c.query("delete from events where id=$1", [eid]);
      expect(res.rowCount).toBe(0); // a moderator's only takedown is the legible, appealable remove
    });
  });

  it("invariant 4: a member cannot read another member's ballot (secret ballot)", async () => {
    await h.inTxn(async (c) => {
      const a = "d1d10000-0000-0000-0000-000000000001";
      const b = "d2d20000-0000-0000-0000-000000000001";
      const pid = "0b0d0000-0000-0000-0000-000000000001";
      await h.createMember(a, "voter-a@rls.test", { verified: true, tenure: "2020-01-01" });
      await h.createMember(b, "voter-b@rls.test", { verified: true, tenure: "2020-01-01" });
      await c.query(
        `insert into proposals (id, author_id, title, kind, opens_at, closes_at)
         values ($1,$2,'secret ballot probe','minor', now()-interval '1 minute', now()+interval '1 hour')`,
        [pid, a],
      );
      // A casts a ballot; the trigger stamps user_id/weight from auth.uid().
      await h.actAs(a);
      await c.query("insert into votes (proposal_id, choice) values ($1,'yes')", [pid]);
      // B can see neither a tally nor A's row.
      await h.actAs(b);
      const visible = await c.query("select count(*)::int as n from votes");
      const aRows = await c.query("select count(*)::int as n from votes where user_id=$1", [a]);
      expect(visible.rows[0].n).toBe(0); // B has cast none
      expect(aRows.rows[0].n).toBe(0); // and cannot read A's ballot
    });
  });
});
