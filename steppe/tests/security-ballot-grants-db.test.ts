import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { securityDb, target } from "./helpers/security-db";

describe.skipIf(!target)("ballot grants under hosted table defaults", () => {
  const { db, act } = securityDb();
  const voter = randomUUID(), other = randomUUID();
  let proposal: string;
  beforeAll(async () => {
    await db.connect();
    for (const id of [voter, other]) {
      await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${id}@example.test`]);
      await db.query("update profiles set verified=true where id=$1", [id]);
    }
    proposal = (await act(voter,
      "insert into proposals(author_id,title,opens_at,closes_at) values($1,'Ballot grant fixture',now()-interval '1 day',now()+interval '1 day') returning id",
      [voter])).rows[0].id;
    await act(voter, "select public.cast_ballot($1,'yes')", [proposal]);
    await act(other, "select public.cast_ballot($1,'abstain')", [proposal]);
  });
  afterAll(async () => { await db.end(); });

  it("denies every anonymous table and column privilege", async () => {
    const result = await db.query(`select
      not exists(select 1 from pg_class c,
        lateral aclexplode(acldefault('r',c.relowner)) a
        where c.oid='public.votes'::regclass
        and has_table_privilege('anon',c.oid,a.privilege_type)) as table_denied,
      not has_any_column_privilege('anon','public.votes','SELECT,INSERT,UPDATE,REFERENCES') as columns_denied`);
    expect(result.rows).toEqual([{ table_denied: true, columns_denied: true }]);
  });

  it.each(["select * from public.votes", "select choice from public.votes"])(
    "rejects anonymous access at the privilege boundary: %s", async (sql) => {
      await expect(act(null, sql, [], "anon")).rejects.toMatchObject({ code: "42501" });
    },
  );

  it("preserves member revision, own-ballot export, and isolation", async () => {
    await act(voter, "select public.cast_ballot($1,'no')", [proposal]);
    const rows = (await act(voter,
      "select proposal_id,user_id,choice,weight,created_at from public.votes where proposal_id=$1",
      [proposal])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ proposal_id: proposal, user_id: voter, choice: "no" });
    expect(rows[0].weight).not.toBeNull();
    expect(rows[0].created_at).toBeInstanceOf(Date);
    await expect(act(voter, "update public.votes set weight=2 where proposal_id=$1", [proposal]))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("preserves service ballot access and the authenticated choice-only update grant", async () => {
    const service = await act(null,
      "select user_id from public.votes where proposal_id=$1", [proposal], "service_role");
    expect(service.rows.map((r) => r.user_id).sort()).toEqual([voter, other].sort());
    const result = await db.query(`select
      has_table_privilege('authenticated','public.votes','SELECT') as member_read,
      has_table_privilege('authenticated','public.votes','INSERT') as member_insert,
      has_column_privilege('authenticated','public.votes','choice','UPDATE') as member_choice,
      has_table_privilege('authenticated','public.votes','UPDATE') as member_broad_update,
      has_table_privilege('service_role','public.votes','UPDATE') as service_update`);
    expect(result.rows).toEqual([{ member_read: true, member_insert: true,
      member_choice: true, member_broad_update: false, service_update: true }]);
  });
});
