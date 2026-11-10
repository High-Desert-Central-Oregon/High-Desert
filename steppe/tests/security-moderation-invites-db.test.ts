import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { securityDb, target } from "./helpers/security-db";
describe.skipIf(!target)(
  "moderation ordering and invitation provenance",
  () => {
    const { db, act } = securityDb();
    const mod = randomUUID(),
      reviewer = randomUUID(),
      member = randomUUID();
    let event: string;
    beforeAll(async () => {
      await db.connect();
      for (const id of [mod, reviewer, member]) {
        await db.query("insert into auth.users(id,email) values($1,$2)", [
          id,
          `${id}@example.test`,
        ]);
        await db.query(
          "update profiles set verified=true,role=$2 where id=$1",
          [id, id === member ? "member" : "moderator"],
        );
      }
      event = (
        await db.query(
          "insert into events(group_id,creator_id,title,starts_at) select id,$1,'Appeal fixture',now() from groups where slug='everyone' returning id",
          [member],
        )
      ).rows[0].id;
    });
    afterAll(async () => {
      await db.end();
    });
    it("stamps future-dated actions and makes a second moderator appeal authoritative in both projections", async () => {
      const removal = (
        await act(
          mod,
          "insert into moderation_actions(actor_id,target_type,target_id,action,reason,created_at) values($1,'event',$2,'remove','Fixture','2099-01-01') returning id,created_at",
          [mod, event],
        )
      ).rows[0];
      expect(new Date(removal.created_at).getFullYear()).toBeLessThan(2099);
      const appeal = (
        await act(member, "select public.file_appeal($1,'Please review') id", [
          removal.id,
        ])
      ).rows[0].id;
      await expect(
        act(mod, "select public.resolve_appeal($1,false,'Restore')", [appeal]),
      ).rejects.toThrow(/separation of duties/);
      await act(reviewer, "select public.resolve_appeal($1,false,'Restore')", [
        appeal,
      ]);
      expect(
        (
          await act(
            member,
            "select public.is_content_hidden('event',$1) hidden",
            [event],
          )
        ).rows[0].hidden,
      ).toBe(false);
      expect(
        (
          await act(
            member,
            "select action from content_moderation where target_id=$1",
            [event],
          )
        ).rows[0].action,
      ).toBe("restore");
      await expect(
        db.query("update moderation_actions set created_at=now() where id=$1", [
          removal.id,
        ]),
      ).rejects.toThrow(/append.only/);
    });
    it("restores a pre-migration future-dated removal without changing the historical row", async () => {
      const legacy = (
        await db.query(
          "select id,target_id,created_at from moderation_actions where reason='Security fixture legacy future action' limit 1",
        )
      ).rows[0];
      expect(legacy).toBeTruthy();
      await act(
        reviewer,
        "insert into moderation_actions(actor_id,target_type,target_id,action,reason) values($1,'event',$2,'restore','Legacy restoration')",
        [reviewer, legacy.target_id],
      );
      expect(
        (
          await act(
            member,
            "select public.is_content_hidden('event',$1) hidden",
            [legacy.target_id],
          )
        ).rows[0].hidden,
      ).toBe(false);
      expect(
        (
          await act(
            member,
            "select action from content_moderation where target_id=$1",
            [legacy.target_id],
          )
        ).rows[0].action,
      ).toBe("restore");
      expect(
        (
          await db.query(
            "select created_at from moderation_actions where id=$1",
            [legacy.id],
          )
        ).rows[0].created_at,
      ).toEqual(legacy.created_at);
    });
    it("binds both insertion paths and rejects later actor changes while preserving service redemption", async () => {
      const token = (
        await act(
          mod,
          "insert into invite_tokens(max_uses,expires_at,created_by) values(3,now()+interval '1 day',$1) returning id,token,created_by",
          [member],
        )
      ).rows[0];
      expect(token.created_by).toBe(mod);
      await expect(
        act(mod, "update invite_tokens set created_by=$1 where id=$2", [
          member,
          token.id,
        ]),
      ).rejects.toThrow(/immutable/);
      const email = `${randomUUID()}@example.test`;
      expect(
        (
          await act(
            mod,
            "insert into invited_emails(email,invited_by) values($1,$2) returning invited_by",
            [email, member],
          )
        ).rows[0].invited_by,
      ).toBe(mod);
      await expect(
        act(mod, "update invited_emails set invited_by=$1 where email=$2", [
          reviewer,
          email,
        ]),
      ).rejects.toThrow(/immutable/);
      const redeemed = `${randomUUID()}@example.test`;
      for (let i = 0; i < 2; i++)
        expect(
          (
            await act(
              null,
              "select public.redeem_invite($1,$2) ok",
              [token.token, redeemed],
              "service_role",
            )
          ).rows[0].ok,
        ).toBe(true);
      expect(
        (
          await db.query(
            "select invited_by from invited_emails where email=$1",
            [redeemed],
          )
        ).rows[0].invited_by,
      ).toBe(mod);
      expect(
        (
          await db.query("select uses_count from invite_tokens where id=$1", [
            token.id,
          ])
        ).rows[0].uses_count,
      ).toBe(1);
      await act(mod, "update invite_tokens set revoked_at=now() where id=$1", [
        token.id,
      ]);
    });
    it("allows only actual Auth deletion to anonymize inviter foreign keys", async () => {
      const retired = randomUUID(),
        email = `${randomUUID()}@example.test`;
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        retired,
        `${retired}@example.test`,
      ]);
      const token = (
        await db.query(
          "insert into invite_tokens(max_uses,expires_at,created_by) values(1,now()+interval '1 day',$1) returning id",
          [retired],
        )
      ).rows[0].id;
      await db.query(
        "insert into invited_emails(email,invited_by) values($1,$2)",
        [email, retired],
      );
      await expect(
        act(mod, "update invite_tokens set created_by=null where id=$1", [
          token,
        ]),
      ).rejects.toThrow(/immutable/);
      // Disposable fixture account without a civic record; production removal is soft.
      await db.query("delete from auth.users where id=$1", [retired]);
      expect(
        (
          await db.query("select created_by from invite_tokens where id=$1", [
            token,
          ])
        ).rows[0].created_by,
      ).toBeNull();
      expect(
        (
          await db.query(
            "select invited_by from invited_emails where email=$1",
            [email],
          )
        ).rows[0].invited_by,
      ).toBeNull();
    });
  },
);
