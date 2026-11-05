import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { securityDb, target } from "./helpers/security-db";

describe.skipIf(!target)(
  "self-deletion durable cleanup and retired-session authority",
  () => {
    const { db, act } = securityDb();
    const member = randomUUID(),
      other = randomUUID(),
      legacy = randomUUID();
    let group: string, job: string;
    beforeAll(async () => {
      await db.connect();
      for (const id of [member, other, legacy]) {
        await db.query("insert into auth.users(id,email) values($1,$2)", [
          id,
          `${id}@example.test`,
        ]);
        await db.query("update profiles set verified=true where id=$1", [id]);
      }
      group = (
        await db.query(
          "insert into groups(slug,name) values($1,'Removal group') returning id",
          [randomUUID()],
        )
      ).rows[0].id;
      await db.query(
        "insert into group_members(group_id,user_id,role) values($1,$2,'maintainer'),($1,$3,'member')",
        [group, member, other],
      );
      for (const id of [member, legacy])
        await db.query(
          "insert into storage.objects(bucket_id,name) values('verification-evidence',$1)",
          [`${id}/orphan/nested.pdf`],
        );
      await db.query("update profiles set deleted_at=now() where id=$1", [
        legacy,
      ]);
    });
    afterAll(async () => {
      await db.end();
    });
    it("records the stable prefix before erasing references and deactivates trust", async () => {
      await act(member, "select public.delete_my_account()");
      const state = (
        await act(member, "select * from public.my_account_removal()")
      ).rows[0];
      job = state.id;
      expect(state).toMatchObject({
        target_id: member,
        completed_at: null,
        pending_email: `${member}@example.test`,
      });
      expect(
        (
          await db.query(
            "select verified,role,tenure_start,deleted_at from profiles where id=$1",
            [member],
          )
        ).rows[0],
      ).toMatchObject({
        verified: false,
        role: "member",
        tenure_start: null,
        deleted_at: expect.any(Date),
      });
      expect(
        (
          await db.query("select * from group_members where user_id=$1", [
            member,
          ])
        ).rows,
      ).toEqual([]);
      expect(
        (
          await act(
            null,
            "select * from public.account_removal_evidence($1)",
            [job],
            "service_role",
          )
        ).rows,
      ).toEqual([{ name: `${member}/orphan/nested.pdf` }]);
      await expect(
        act(
          null,
          "select public.finish_account_removal($1)",
          [job],
          "service_role",
        ),
      ).rejects.toThrow(/cleanup incomplete/);
    });
    it("retains a single pending job on retry and denies every ordinary stale write", async () => {
      await act(member, "select public.delete_my_account()");
      expect(
        (await act(member, "select * from public.my_account_removal()")).rows[0]
          .id,
      ).toBe(job);
      expect(
        (await act(other, "select * from public.my_account_removal()")).rows,
      ).toEqual([]);
      for (const sql of [
        "select public.add_member($1,$2)",
        "select public.approve_member($1,$2)",
        "select public.deny_member($1,$2)",
        "select public.remove_member($1,$2)",
        "select public.set_member_role($1,$2,'maintainer')",
      ])
        await expect(act(member, sql, [group, other])).rejects.toThrow();
      await expect(
        act(
          member,
          "insert into storage.objects(bucket_id,name) values('verification-evidence',$1)",
          [`${member}/new.pdf`],
        ),
      ).rejects.toThrow(/account removed/);
      await expect(
        act(
          member,
          "insert into steppe_security_private.deletion_context values(pg_backend_pid(),txid_current(),$1)",
          [member],
        ),
      ).rejects.toThrow(/permission denied/);
      expect(
        (
          await db.query(
            "select * from steppe_security_private.deletion_context",
          )
        ).rows,
      ).toEqual([]);
    });
    it("supports old tombstones without preexisting cleanup jobs", async () => {
      await act(legacy, "select public.delete_my_account()");
      const legacyJob = (
        await act(legacy, "select * from public.my_account_removal()")
      ).rows[0];
      expect(legacyJob.target_id).toBe(legacy);
      expect(
        (
          await act(
            null,
            "select * from public.account_removal_evidence($1)",
            [legacyJob.id],
            "service_role",
          )
        ).rows,
      ).toEqual([{ name: `${legacy}/orphan/nested.pdf` }]);
    });
    it("acknowledges only after both external cleanups and keeps audit originals", async () => {
      // Fixture simulation only. Production deletes bytes through Storage API;
      // its returned-error/retry contract is exercised in removal.test.ts.
      await db.query("delete from storage.objects where name=$1", [
        `${member}/orphan/nested.pdf`,
      ]);
      await expect(
        act(
          null,
          "select public.finish_account_removal($1)",
          [job],
          "service_role",
        ),
      ).rejects.toThrow(/cleanup incomplete/);
      await db.query("update auth.users set deleted_at=now() where id=$1", [
        member,
      ]);
      await act(
        null,
        "select public.finish_account_removal($1)",
        [job],
        "service_role",
      );
      const completed = (
        await db.query("select * from account_removals where id=$1", [job])
      ).rows[0];
      expect(completed.completed_at).toBeInstanceOf(Date);
      expect(completed.pending_email).toBeNull();
      expect(
        (
          await db.query(
            "select * from audit_log where entity_id=$1 and action='account.removal_requested'",
            [member],
          )
        ).rows,
      ).toHaveLength(1);
    });
  },
);
