import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { securityDb, target } from "./helpers/security-db";
describe.skipIf(!target)("bounded verification upload slots", () => {
  const { db, act } = securityDb();
  const user = randomUUID(),
    orphan = randomUUID();
  let path: string;
  beforeAll(async () => {
    await db.connect();
    for (const id of [user, orphan])
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        `${id}@example.test`,
      ]);
  });
  afterAll(async () => {
    await db.end();
  });
  it("refuses raw uploads and returns the same single slot for repeated reservations", async () => {
    await expect(
      act(
        user,
        "insert into storage.objects(bucket_id,name) values('verification-evidence',$1)",
        [`${user}/${randomUUID()}.pdf`],
      ),
    ).rejects.toThrow(/row-level security|reservation unavailable/);
    path = (
      await act(user, "select public.reserve_verification_upload('pdf') path")
    ).rows[0].path;
    expect(
      (await act(user, "select public.reserve_verification_upload('png') path"))
        .rows[0].path,
    ).toBe(path);
    await act(
      user,
      "insert into storage.objects(bucket_id,name) values('verification-evidence',$1)",
      [path],
    );
    await expect(
      act(
        user,
        "insert into storage.objects(bucket_id,name) values('verification-evidence',$1)",
        [`${user}/${randomUUID()}.pdf`],
      ),
    ).rejects.toThrow(/row-level security|reservation unavailable/);
    await expect(
      act(
        user,
        "insert into storage.objects(bucket_id,name) values('verification-evidence',$1)",
        [path],
      ),
    ).rejects.toThrow(/unique/);
  });
  it("releases abandoned uploads before replacement without allowing a stale attachment", async () => {
    expect(
      (
        await act(
          user,
          "select public.release_unused_verification_upload() path",
        )
      ).rows[0].path,
    ).toBe(path);
    await expect(
      act(
        user,
        "insert into verifications(user_id,method,evidence_path) values($1,'id',$2)",
        [user, path],
      ),
    ).rejects.toThrow(/evidence unavailable/);
    await expect(
      act(user, "select public.reserve_verification_upload('pdf')"),
    ).rejects.toThrow(/cleanup pending/);
    await db.query("delete from storage.objects where name=$1", [path]); // Storage API stub
    const next = (
      await act(user, "select public.reserve_verification_upload('pdf') path")
    ).rows[0].path;
    expect(next).not.toBe(path);
    path = next;
    await act(
      user,
      "insert into storage.objects(bucket_id,name) values('verification-evidence',$1)",
      [path],
    );
  });
  it("binds the document to the request and preserves the postcard alternative", async () => {
    await expect(
      act(
        user,
        "insert into verifications(user_id,method,evidence_path) values($1,'id',$2)",
        [user, `${user}/${randomUUID()}.pdf`],
      ),
    ).rejects.toThrow(/evidence unavailable/);
    await act(
      user,
      "insert into verifications(user_id,method,evidence_path) values($1,'id',$2)",
      [user, path],
    );
    await expect(
      act(user, "select public.reserve_verification_upload('pdf')"),
    ).rejects.toThrow(/request pending/);
    await expect(
      act(user, "select public.release_unused_verification_upload()"),
    ).rejects.toThrow(/request pending/);
    await act(
      orphan,
      "insert into verifications(user_id,method) values($1,'postcard_code')",
      [orphan],
    );
  });
  it("revocation wins against an upload statement waiting on the profile lock", async () => {
    const racing = randomUUID();
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      racing,
      `${racing}@example.test`,
    ]);
    const reserved = (
      await act(racing, "select public.reserve_verification_upload('pdf') path")
    ).rows[0].path;
    const concurrent = securityDb();
    await concurrent.db.connect();
    try {
      await db.query("begin");
      await db.query("select 1 from profiles where id=$1 for update", [racing]);
      const attempted = concurrent.act(
        racing,
        "insert into storage.objects(bucket_id,name) values('verification-evidence',$1)",
        [reserved],
      );
      const rejected = expect(attempted).rejects.toThrow(
        /reservation unavailable|row-level security/,
      );
      await db.query("select pg_sleep(0.1)");
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: racing, role: "authenticated" }),
      ]);
      await db.query("select public.release_unused_verification_upload()");
      await db.query("commit");
      await rejected;
      expect(
        (
          await db.query("select * from storage.objects where name=$1", [
            reserved,
          ])
        ).rows,
      ).toEqual([]);
    } finally {
      await db.query("rollback");
      await concurrent.db.end();
    }
  });
  it("queues legacy orphans, retains failures, and never claims referenced evidence", async () => {
    const unused = `${orphan}/legacy/nested.pdf`;
    await db.query(
      "insert into storage.objects(bucket_id,name,created_at) values('verification-evidence',$1,now()-interval '2 days')",
      [unused],
    );
    await db.query(
      "update storage.objects set created_at=now()-interval '2 days' where name=$1",
      [path],
    );
    const rows = (
      await act(
        null,
        "select * from public.claim_orphan_evidence_cleanup()",
        [],
        "service_role",
      )
    ).rows;
    expect(rows.some((r) => r.path === path)).toBe(false);
    const row = rows.find((r) => r.path === unused);
    expect(row).toBeTruthy();
    await act(
      null,
      "select public.finish_orphan_evidence_cleanup($1,$2,false)",
      [unused, row.claim],
      "service_role",
    );
    expect(
      (
        await db.query(
          "select attempts from steppe_security_private.evidence_cleanup where path=$1",
          [unused],
        )
      ).rows[0].attempts,
    ).toBe(1);
    await expect(
      act(user, "select * from public.claim_orphan_evidence_cleanup()"),
    ).rejects.toThrow(/permission denied/);
    await db.query(
      "update steppe_security_private.evidence_cleanup set retry_at=now() where path=$1",
      [unused],
    );
    const retry = (
      await act(
        null,
        "select * from public.claim_orphan_evidence_cleanup()",
        [],
        "service_role",
      )
    ).rows.find((r) => r.path === unused);
    await db.query("delete from storage.objects where name=$1", [unused]);
    await act(
      null,
      "select public.finish_orphan_evidence_cleanup($1,$2,true)",
      [unused, retry.claim],
      "service_role",
    );
    expect(
      (
        await db.query(
          "select * from steppe_security_private.evidence_cleanup where path=$1",
          [unused],
        )
      ).rows,
    ).toEqual([]);
  });
});
