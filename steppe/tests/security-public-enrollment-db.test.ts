import { randomUUID, createHash } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { securityDb, target } from "./helpers/security-db";
describe.skipIf(!target)(
  "public enrollment ownership, privacy and durable budgets",
  () => {
    const { db, act } = securityDb();
    const slug = `security-${randomUUID()}`;
    let campaign: string;
    const caller = () =>
      createHash("sha256").update(randomUUID()).digest("hex");
    const enqueue = (email: string, purpose = "interest", key = caller()) =>
      act(
        null,
        "select public.queue_public_enrollment($1,$2,$3,$4,'en',$5) ok",
        [
          email,
          purpose,
          purpose === "pledge" ? slug : "",
          purpose === "interest" ? { consent: true, source: "bc" } : {},
          key,
        ],
        "service_role",
      );
    beforeAll(async () => {
      await db.connect();
      campaign = (
        await db.query(
          "insert into neighborhoods(slug,name,threshold) values($1,'Synthetic campaign',20) returning id",
          [slug],
        )
      ).rows[0].id;
    });
    beforeEach(async () => {
      await db.query("delete from steppe_security_private.enrollment_queue");
      await db.query("delete from steppe_security_private.enrollment_callers");
      await db.query(
        "update steppe_security_private.enrollment_budget set requests_hour=0,requests_day=0,sends_hour=0,sends_day=0,consecutive_failures=0,circuit_until=null,expired_unsent=0",
      );
      await db.query(
        "update steppe_security_private.enrollment_settings set enabled=true,mail_hour_limit=20,mail_day_limit=100",
      );
    });
    afterAll(async () => {
      await db.end();
    });
    it("gives existing and new addresses identical intake without enrollment until possession is proved", async () => {
      const existing = `${randomUUID()}@example.test`,
        fresh = `${randomUUID()}@example.test`;
      await db.query(
        "insert into interest_signups(email,consent) values($1,true)",
        [existing],
      );
      for (const email of [existing, fresh])
        expect((await enqueue(email)).rows).toEqual([{ ok: true }]);
      expect(
        (
          await db.query("select email from interest_signups where email=$1", [
            fresh,
          ])
        ).rows,
      ).toEqual([]);
      const q = (
        await db.query(
          "select token from steppe_security_private.enrollment_queue where email=$1",
          [fresh],
        )
      ).rows[0];
      expect(
        (
          await act(
            null,
            "select public.confirm_public_enrollment($1) result",
            ["0".repeat(64)],
            "service_role",
          )
        ).rows[0].result,
      ).toBeNull();
      for (let i = 0; i < 2; i++)
        expect(
          (
            await act(
              null,
              "select public.confirm_public_enrollment($1) result",
              [q.token],
              "service_role",
            )
          ).rows[0].result.purpose,
        ).toBe("interest");
      expect(
        (
          await db.query("select source from interest_signups where email=$1", [
            fresh,
          ])
        ).rows,
      ).toEqual([{ source: "bc" }]);
      await expect(
        act(
          null,
          "select public.confirm_public_enrollment($1)",
          [q.token],
          "anon",
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        act(
          null,
          "select * from steppe_security_private.enrollment_queue",
          [],
          "anon",
        ),
      ).rejects.toThrow(/permission denied/);
    });
    it("does not change public counts on request or confirmation; removal also forgets the challenge", async () => {
      const email = `${randomUUID()}@example.test`;
      const status = () =>
        act(
          null,
          "select * from public.neighborhood_status($1)",
          [slug],
          "anon",
        );
      const before = (await status()).rows;
      await enqueue(email, "pledge");
      expect((await status()).rows).toEqual(before);
      expect(
        (
          await db.query(
            "select id from pledges where neighborhood_id=$1 and email_normalized=$2",
            [campaign, email],
          )
        ).rows,
      ).toEqual([]);
      const token = (
        await db.query(
          "select token from steppe_security_private.enrollment_queue where email=$1",
          [email],
        )
      ).rows[0].token;
      const confirmed = (
        await act(
          null,
          "select public.confirm_public_enrollment($1) result",
          [token],
          "service_role",
        )
      ).rows[0].result;
      expect(confirmed.removal_token).toMatch(/^[a-f0-9-]{36}$/);
      expect((await status()).rows).toEqual(before);
      await act(
        null,
        "select public.remove_pledge($1)",
        [confirmed.removal_token],
        "service_role",
      );
      expect(
        (
          await db.query(
            "select id from steppe_security_private.enrollment_queue where email=$1",
            [email],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await act(
            null,
            "select public.confirm_public_enrollment($1) result",
            [token],
            "service_role",
          )
        ).rows[0].result,
      ).toBeNull();
    });
    it("keeps the emailed pledge link usable after challenge expiry and erases the receipt on removal", async () => {
      const email = `${randomUUID()}@example.test`;
      await enqueue(email, "pledge");
      const token = (
        await db.query(
          "select token from steppe_security_private.enrollment_queue where email=$1",
          [email],
        )
      ).rows[0].token;
      const first = (
        await act(
          null,
          "select public.confirm_public_enrollment($1) result",
          [token],
          "service_role",
        )
      ).rows[0].result;
      await db.query(
        "update steppe_security_private.enrollment_queue set expires_at=now()-interval '1 second' where token=$1",
        [token],
      );
      await act(
        null,
        "select public.purge_public_enrollment()",
        [],
        "service_role",
      );
      expect(
        (
          await act(
            null,
            "select public.confirm_public_enrollment($1) result",
            [token],
            "service_role",
          )
        ).rows[0].result,
      ).toEqual(first);
      await act(
        null,
        "select public.remove_pledge($1)",
        [first.removal_token],
        "service_role",
      );
      expect(
        (
          await act(
            null,
            "select public.confirm_public_enrollment($1) result",
            [token],
            "service_role",
          )
        ).rows[0].result,
      ).toBeNull();
    });
    it("allows interest and multiple campaigns for one address to receive mail before expiry", async () => {
      const email = `${randomUUID()}@example.test`,
        second = `security-${randomUUID()}`;
      await db.query(
        "insert into neighborhoods(slug,name,threshold) values($1,'Another synthetic campaign',20)",
        [second],
      );
      await enqueue(email);
      await enqueue(email, "pledge");
      await act(
        null,
        "select public.queue_public_enrollment($1,'pledge',$2,'{}','en',$3)",
        [email, second, caller()],
        "service_role",
      );
      for (let i = 0; i < 3; i++) {
        const row = (
          await act(
            null,
            "select * from public.claim_public_enrollment_mail()",
            [],
            "service_role",
          )
        ).rows[0];
        expect(row).toBeTruthy();
        await act(
          null,
          "select public.finish_public_enrollment_mail($1,$2,true)",
          [row.id, row.claim],
          "service_role",
        );
        expect(
          (
            await act(
              null,
              "select * from public.claim_public_enrollment_mail()",
              [],
              "service_role",
            )
          ).rows,
        ).toEqual([]);
        await db.query(
          "update steppe_security_private.enrollment_queue set sent_at=now()-interval '61 minutes' where sent_at is not null",
        );
      }
      expect(
        (
          await db.query(
            "select count(*)::int n from steppe_security_private.enrollment_queue where sent_at is not null",
          )
        ).rows[0].n,
      ).toBe(3);
    });
    it("account deletion cancels pending personal data and possession challenges", async () => {
      const uid = randomUUID(),
        email = `${uid}@example.test`;
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        uid,
        email,
      ]);
      await db.query("update profiles set verified=true where id=$1", [uid]);
      await enqueue(email);
      await enqueue(email, "pledge");
      const tokens = (
        await db.query(
          "select token from steppe_security_private.enrollment_queue where email=$1",
          [email],
        )
      ).rows;
      await act(uid, "select public.delete_my_account()");
      expect(
        (
          await db.query(
            "select * from steppe_security_private.enrollment_queue where email=$1",
            [email],
          )
        ).rows,
      ).toEqual([]);
      for (const row of tokens)
        expect(
          (
            await act(
              null,
              "select public.confirm_public_enrollment($1) result",
              [row.token],
              "service_role",
            )
          ).rows[0].result,
        ).toBeNull();
    });
    it("enforces cross-address global and caller budgets without storing an unbounded caller map", async () => {
      const key = caller();
      for (let i = 0; i < 60; i++)
        expect(
          (await enqueue(`a${i}@example.test`, "interest", key)).rows[0].ok,
        ).toBe(true);
      expect(
        (await enqueue("blocked@example.test", "interest", key)).rows[0].ok,
      ).toBe(false);
      await db.query(
        "update steppe_security_private.enrollment_budget set requests_hour=119",
      );
      expect((await enqueue("last@example.test")).rows[0].ok).toBe(true);
      expect((await enqueue("over@example.test")).rows[0].ok).toBe(false);
      expect(
        (
          await db.query(
            "select count(*)::int n from steppe_security_private.enrollment_callers",
          )
        ).rows[0].n,
      ).toBe(2);
    });
    it("serializes competing callers against the last global request allowance", async () => {
      await db.query(
        "update steppe_security_private.enrollment_budget set requests_hour=119",
      );
      const clients = [securityDb(), securityDb()];
      await Promise.all(clients.map((c) => c.db.connect()));
      try {
        const results = await Promise.all(
          clients.map((c, i) =>
            c.act(
              null,
              "select public.queue_public_enrollment($1,'interest','',$2,'en',$3) ok",
              [`race${i}@example.test`, { consent: true }, caller()],
              "service_role",
            ),
          ),
        );
        expect(results.map((r) => r.rows[0].ok).sort()).toEqual([false, true]);
        expect(
          (
            await db.query(
              "select requests_hour from steppe_security_private.enrollment_budget",
            )
          ).rows[0].requests_hour,
        ).toBe(120);
      } finally {
        await Promise.all(clients.map((c) => c.db.end()));
      }
    });
    it("leases one send, limits daily mail, and keeps failures visible behind a circuit breaker", async () => {
      for (let i = 0; i < 4; i++) await enqueue(`mail${i}@example.test`);
      for (let i = 0; i < 3; i++) {
        const row = (
          await act(
            null,
            "select * from public.claim_public_enrollment_mail()",
            [],
            "service_role",
          )
        ).rows[0];
        expect(row).toBeTruthy();
        await act(
          null,
          "select public.finish_public_enrollment_mail($1,$2,false)",
          [row.id, row.claim],
          "service_role",
        );
      }
      expect(
        (
          await act(
            null,
            "select * from public.claim_public_enrollment_mail()",
            [],
            "service_role",
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await act(
            null,
            "select public.public_enrollment_healthy() ok",
            [],
            "service_role",
          )
        ).rows[0].ok,
      ).toBe(false);
      await db.query(
        "update steppe_security_private.enrollment_budget set circuit_until=null,sends_day=100",
      );
      expect(
        (
          await act(
            null,
            "select * from public.claim_public_enrollment_mail()",
            [],
            "service_role",
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await db.query(
            "select count(*)::int n from steppe_security_private.enrollment_queue where sent_at is null",
          )
        ).rows[0].n,
      ).toBe(4);
    });
    it("purges expired personal data while retaining a content-free failure signal", async () => {
      const email = `${randomUUID()}@example.test`;
      await enqueue(email);
      await db.query(
        "update steppe_security_private.enrollment_queue set expires_at=now()-interval '1 second'",
      );
      await act(
        null,
        "select public.purge_public_enrollment()",
        [],
        "service_role",
      );
      expect(
        (
          await db.query(
            "select * from steppe_security_private.enrollment_queue",
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await act(
            null,
            "select public.public_enrollment_healthy() ok",
            [],
            "service_role",
          )
        ).rows[0].ok,
      ).toBe(false);
    });
  },
);
