import pg from "pg";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
// Explicit opt-in, exact disposable database name and loopback host. Never .env Supabase URLs.
const target = process.env.BUG_REPORT_TEST_DB_URL;
if (target) {
  const url = new URL(target);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/steppe_bug_reports_test"
  )
    throw new Error(
      "Bug-report DB tests require an isolated loopback steppe_bug_reports_test database",
    );
}
describe.skipIf(!target)("bug reports database boundaries", () => {
  const db = new pg.Client({ connectionString: target });
  const member = randomUUID();
  const other = randomUUID();
  const owner = randomUUID();
  let report: string;
  const bucket = () => randomUUID().replaceAll("-", "").repeat(2);
  async function asUser(uid: string, sql: string, values: unknown[] = []) {
    await db.query("begin");
    try {
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: uid, role: "authenticated" }),
      ]);
      await db.query("set local role authenticated");
      return await db.query(sql, values);
    } finally {
      await db.query("rollback");
    }
  }
  async function submit(key: string, reporter: string | null, rate = bucket()) {
    return (
      await db.query(
        "select public.submit_bug_report($1,$2,'The RSVP failed','Expected saved','','/protected/events/[id]','en','test',null,$3) as id",
        [key, reporter, rate],
      )
    ).rows[0].id as string;
  }
  beforeAll(async () => {
    await db.connect();
    for (const id of [member, other, owner])
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        `${id}@example.test`,
      ]);
    await db.query("insert into public.support_operators(user_id) values($1)", [
      owner,
    ]);
    report = await submit(randomUUID(), member);
  });
  afterAll(async () => {
    await db.end();
  });
  it("exposes only own reports to members and full cases to designated support", async () => {
    expect(
      (
        await asUser(member, "select id from public.bug_reports where id=$1", [
          report,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await asUser(other, "select id from public.bug_reports where id=$1", [
          report,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(owner, "select id from public.bug_reports where id=$1", [
          report,
        ])
      ).rows,
    ).toHaveLength(1);
    await expect(
      asUser(member, "select request_key from public.bug_reports"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        member,
        "update public.bug_reports set status='closed' where id=$1",
        [report],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(member, "select public.update_bug_report($1,'closed','')", [
        report,
      ]),
    ).rejects.toThrow(/forbidden/);
  });
  it("restricts all privileged intake/worker functions and tables", async () => {
    const result = await db.query(
      "select has_function_privilege('anon','public.submit_bug_report(uuid,uuid,text,text,text,text,text,text,jsonb,text)','EXECUTE') a,has_function_privilege('authenticated','public.claim_bug_report_notifications(uuid)','EXECUTE') b,has_table_privilege('anon','public.bug_reports','SELECT') c",
    );
    expect(result.rows[0]).toEqual({ a: false, b: false, c: false });
  });
  it("deduplicates retries and bounds accepted submissions", async () => {
    const key = randomUUID();
    const rate = bucket();
    const id = await submit(key, member, rate);
    expect(await submit(key, member, rate)).toBe(id);
    expect(
      (
        await db.query(
          "select hits from public.bug_report_limits where bucket=$1",
          [rate],
        )
      ).rows[0].hits,
    ).toBe(1);
    for (let i = 0; i < 4; i++) await submit(randomUUID(), member, rate);
    await expect(submit(randomUUID(), member, rate)).rejects.toThrow(
      /report limit/,
    );
    await expect(submit(key, other, rate)).rejects.toThrow(/request conflict/);
  });
  it("keeps review history and permits only support updates", async () => {
    const result = await asUser(
      owner,
      "select public.update_bug_report($1,'reproduced','Confirmed on a test device')",
      [report],
    );
    expect(result.rowCount).toBe(1);
    // Above transaction rolls back. Validate history inside the same authorized transaction.
    await db.query("begin");
    try {
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: owner }),
      ]);
      await db.query("set local role authenticated");
      await db.query(
        "select public.update_bug_report($1,'reproduced','Confirmed')",
        [report],
      );
      expect(
        (
          await db.query(
            "select status,note from public.bug_report_history where report_id=$1 order by created_at desc",
            [report],
          )
        ).rows[0],
      ).toMatchObject({ status: "reproduced", note: "Confirmed" });
    } finally {
      await db.query("rollback");
    }
  });
  it("deduplicates concurrent submissions and claims an alert only once", async () => {
    const peer = new pg.Client({ connectionString: target });
    await peer.connect();
    try {
      const key = randomUUID();
      const rate = bucket();
      const sql =
        "select public.submit_bug_report($1,$2,'Concurrent report','','','/contact','en','test',null,$3) as id";
      const results = await Promise.all([
        db.query(sql, [key, member, rate]),
        peer.query(sql, [key, member, rate]),
      ]);
      const id = results[0].rows[0].id;
      expect(results[1].rows[0].id).toBe(id);
      const claims = await Promise.all([
        db.query("select * from public.claim_bug_report_notifications($1)", [
          id,
        ]),
        peer.query("select * from public.claim_bug_report_notifications($1)", [
          id,
        ]),
      ]);
      expect(claims.flatMap((result) => result.rows)).toHaveLength(1);
    } finally {
      await peer.end();
    }
  });
  it("leases alerts, rejects stale completion, and leaves failures retryable", async () => {
    const id = await submit(randomUUID(), null);
    const claim = (
      await db.query(
        "select * from public.claim_bug_report_notifications($1)",
        [id],
      )
    ).rows[0];
    expect(
      (
        await db.query(
          "select * from public.claim_bug_report_notifications($1)",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
    await db.query("select public.finish_bug_report_notification($1,$2,true)", [
      id,
      randomUUID(),
    ]);
    expect(
      (
        await db.query(
          "select notification_state from public.bug_reports where id=$1",
          [id],
        )
      ).rows[0].notification_state,
    ).toBe("pending");
    await db.query(
      "select public.finish_bug_report_notification($1,$2,false)",
      [id, claim.claim],
    );
    expect(
      (
        await db.query(
          "select notification_state,notification_lease_until from public.bug_reports where id=$1",
          [id],
        )
      ).rows[0],
    ).toEqual({
      notification_state: "pending",
      notification_lease_until: null,
    });
  });
  it("hides expired cases and purges their content/history", async () => {
    const id = await submit(randomUUID(), null);
    await db.query(
      "update public.bug_reports set expires_at=now()-interval '1 second' where id=$1",
      [id],
    );
    expect(
      (
        await asUser(owner, "select id from public.bug_reports where id=$1", [
          id,
        ])
      ).rows,
    ).toHaveLength(0);
    await db.query("select public.purge_expired_bug_reports()");
    expect(
      (
        await db.query(
          "select id from public.bug_report_history where report_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("erases member cases on tombstoning and rejects stale identities", async () => {
    const id = randomUUID();
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      `deleted-${id}@example.test`,
    ]);
    const caseId = await submit(randomUUID(), id);
    await db.query("update public.profiles set deleted_at=now() where id=$1", [
      id,
    ]);
    expect(
      (
        await db.query("select id from public.bug_reports where id=$1", [
          caseId,
        ])
      ).rows,
    ).toHaveLength(0);
    await expect(submit(randomUUID(), id)).rejects.toThrow(/inactive account/);
  });
});
