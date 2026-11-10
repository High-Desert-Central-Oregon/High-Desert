import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { securityDb, target } from "./helpers/security-db";
describe.skipIf(!target)(
  "governance integrity against direct database clients",
  () => {
    const { db, act } = securityDb();
    const author = randomUUID(),
      voters = Array.from({ length: 5 }, () => randomUUID());
    let first: string, second: string;
    beforeAll(async () => {
      await db.connect();
      for (const id of [author, ...voters]) {
        await db.query("insert into auth.users(id,email) values($1,$2)", [
          id,
          `${id}@example.test`,
        ]);
        await db.query("update profiles set verified=true where id=$1", [id]);
      }
      await db.query("update profiles set role='moderator' where id=$1", [
        author,
      ]);
      for (let i = 0; i < 2; i++) {
        const row = await act(
          author,
          "insert into proposals(author_id,title,opens_at,closes_at) values($1,'Fixture',now()-interval '1 day',now()+interval '1 day') returning id",
          [author],
        );
        if (i === 0) first = row.rows[0].id;
        else second = row.rows[0].id;
      }
    });
    afterAll(async () => {
      await db.end();
    });
    it("rejects backdated foundational notice and freezes publication time", async () => {
      await expect(
        act(
          author,
          "insert into proposals(author_id,title,kind,created_at,opens_at,closes_at) values($1,'Forged notice','immutable',now()-interval '40 days',now(),now()+interval '1 day')",
          [author],
        ),
      ).rejects.toThrow(/30 days/);
      const row = (
        await act(
          author,
          "insert into proposals(author_id,title,kind,created_at,opens_at,closes_at) values($1,'Valid notice','immutable','2000-01-01',now()+interval '31 days',now()+interval '40 days') returning id,created_at",
          [author],
        )
      ).rows[0];
      expect(new Date(row.created_at).getFullYear()).toBeGreaterThan(2025);
      const changed = (
        await act(
          author,
          "update proposals set created_at='2000-01-01',title='Revised title' where id=$1 returning created_at,title",
          [row.id],
        )
      ).rows[0];
      expect(changed.created_at).toEqual(row.created_at);
      expect(changed.title).toBe("Revised title");
    });
    it("keeps revisions but blocks moving, deleting, and rewriting identity of a ballot", async () => {
      await act(voters[0], "select public.cast_ballot($1,'yes')", [first]);
      await act(voters[0], "select public.cast_ballot($1,'no')", [first]);
      expect(
        (
          await act(
            voters[0],
            "select choice from votes where proposal_id=$1",
            [first],
          )
        ).rows[0].choice,
      ).toBe("no");
      await expect(
        act(voters[0], "update votes set proposal_id=$1 where proposal_id=$2", [
          second,
          first,
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("update votes set proposal_id=$1 where proposal_id=$2", [
          second,
          first,
        ]),
      ).rejects.toThrow(/immutable/);
      await expect(
        act(voters[0], "update votes set user_id=$1 where proposal_id=$2", [
          voters[1],
          first,
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("delete from votes where proposal_id=$1", [first]),
      ).rejects.toThrow(/cannot be deleted/);
      for (const id of voters.slice(1))
        await act(id, "select public.cast_ballot($1,'yes')", [first]);
    });
    it("embargoes early-close tallies even above the privacy floor and permits reopening", async () => {
      await act(author, "update proposals set status='closed' where id=$1", [
        first,
      ]);
      const rows = (
        await act(
          author,
          "select metadata from audit_log where entity_id=$1 and action='proposal.closed'",
          [first],
        )
      ).rows;
      expect(rows).toEqual([{ metadata: { results_pending: true } }]);
      await expect(
        act(voters[0], "select public.cast_ballot($1,'yes')", [first]),
      ).rejects.toThrow(/closed/);
      await act(author, "update proposals set status='open' where id=$1", [
        first,
      ]);
      await act(voters[0], "select public.cast_ballot($1,'yes')", [first]);
    });
    it("appends a final result once due after early closure without rewriting the pending entry", async () => {
      const id = (
        await act(
          author,
          "insert into proposals(author_id,title,opens_at,closes_at) values($1,'Early closure lifecycle',now()-interval '1 day',now()+interval '0.2 seconds') returning id",
          [author],
        )
      ).rows[0].id;
      await act(author, "update proposals set status='closed' where id=$1", [
        id,
      ]);
      await db.query("select pg_sleep(0.25)");
      await db.query("select public.close_due_proposals()");
      await act(author, "select public.finalize_proposal_outcome($1)", [id]);
      await db.query("select public.close_due_proposals()");
      const rows = (
        await act(
          author,
          "select metadata from audit_log where entity_id=$1 and action='proposal.closed' order by created_at",
          [id],
        )
      ).rows;
      expect(rows).toHaveLength(2);
      expect(rows[0].metadata).toEqual({ results_pending: true });
      expect(rows[1].metadata.outcome).toBe("insufficient_turnout");
    });
    it("retains post-deadline results and privacy-floor suppression", async () => {
      const id = (
        await act(
          author,
          "insert into proposals(author_id,title,opens_at,closes_at) values($1,'Past deadline',now()-interval '2 days',now()-interval '1 day') returning id",
          [author],
        )
      ).rows[0].id;
      await act(author, "update proposals set status='closed' where id=$1", [
        id,
      ]);
      const meta = (
        await act(
          author,
          "select metadata from audit_log where entity_id=$1 and action='proposal.closed'",
          [id],
        )
      ).rows[0].metadata;
      expect(meta.ballots).toBe(0);
      expect(meta.revealed).toBe(false);
      expect(meta).not.toHaveProperty("yes_weight");
    });
  },
);
