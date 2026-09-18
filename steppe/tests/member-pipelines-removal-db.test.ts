import pg from "pg";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const target = process.env.MEMBER_PIPELINE_TEST_DB_URL;
if (target) {
  const url = new URL(target);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/steppe_pipelines_test"
  )
    throw new Error(
      "Only the isolated loopback steppe_pipelines_test database is permitted",
    );
}

describe.skipIf(!target)("administrator account removal", () => {
  const db = new pg.Client({ connectionString: target });
  const admin = randomUUID(),
    member = randomUUID(),
    other = randomUUID(),
    moderator = randomUUID(),
    support = randomUUID();
  const email = `${member}@example.test`;
  let job: string, proposal: string, consent: string, thread: string;
  async function act(uid: string, sql: string, args: unknown[] = []) {
    await db.query("begin");
    try {
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: uid }),
      ]);
      await db.query("set local role authenticated");
      const result = await db.query(sql, args);
      await db.query("commit");
      return result;
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  }
  const remove = (uid = admin, who = member, confirm = email) =>
    act(uid, "select public.begin_account_removal($1,$2,'test_reset') id", [
      who,
      confirm,
    ]);
  beforeAll(async () => {
    await db.connect();
    for (const id of [admin, member, other, moderator, support]) {
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
        [id, `${id}@example.test`],
      );
      await db.query("update public.profiles set verified=true where id=$1", [
        id,
      ]);
    }
    await db.query("update public.profiles set role='admin' where id=$1", [
      admin,
    ]);
    await db.query("update public.profiles set role='moderator' where id=$1", [
      moderator,
    ]);
    await db.query("insert into public.support_operators(user_id) values($1)", [
      support,
    ]);
    proposal = (
      await db.query(
        "insert into public.proposals(author_id,title,closes_at) values($1,'Removal fixture',now()+interval '40 days') returning id",
        [member],
      )
    ).rows[0].id;
    await act(
      member,
      "insert into public.votes(proposal_id,user_id,choice) values($1,$2,'yes')",
      [proposal, member],
    );
    consent = (
      await db.query(
        "insert into public.consents(user_id,document_id) select $1,id from public.documents limit 1 returning id",
        [member],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.posts(group_id,author_id,category,title,body) select id,$1,'need','Fixture','Fixture body' from public.groups where slug='everyone'",
      [member],
    );
    const [a, b] = [member, other].sort();
    thread = (
      await db.query(
        "insert into public.threads(member_a,member_b,started_by) values($1,$2,$1) returning id",
        [a, b],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.messages(thread_id,sender_id,body) values($1,$2,'Remove this'),($1,$3,'Keep counterpart')",
      [thread, member, other],
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('verification-evidence',$1),('verification-evidence',$2)",
      [`${member}/orphan/nested.pdf`, `${other}/keep.pdf`],
    );
    await db.query(
      "insert into public.verifications(user_id,method,evidence_path) values($1,'utility_bill',$2)",
      [member, `${member}/orphan/nested.pdf`],
    );
    await db.query(
      "insert into public.interest_signups(email,consent,neighborhood) values($1,true,'Fixture neighborhood')",
      [email],
    );
    await db.query("insert into public.invited_emails(email) values($1)", [
      email,
    ]);
  });
  afterAll(async () => {
    await db.end();
  });

  it("allows only active administrators to look up and remove accounts", async () => {
    for (const uid of [member, moderator, support]) {
      await expect(
        act(uid, "select * from public.preview_account_removal($1)", [email]),
      ).rejects.toThrow(/forbidden/);
      await expect(remove(uid)).rejects.toThrow(/forbidden/);
    }
    const row = (
      await act(admin, "select * from public.preview_account_removal($1)", [
        email.toUpperCase(),
      ])
    ).rows[0];
    expect(row).toMatchObject({
      target_id: member,
      eligible: true,
      verified: true,
    });
  });
  it("protects self, staff and mismatched confirmation", async () => {
    await expect(remove(admin, admin, `${admin}@example.test`)).rejects.toThrow(
      /invalid removal/,
    );
    for (const id of [moderator, support])
      await expect(remove(admin, id, `${id}@example.test`)).rejects.toThrow(
        /protected account/,
      );
    await expect(
      remove(admin, member, `${other}@example.test`),
    ).rejects.toThrow(/confirmation mismatch/);
  });
  it("removes access and personal content while preserving civic records", async () => {
    job = (await remove()).rows[0].id;
    expect((await remove()).rows[0].id).toBe(job);
    expect(
      (
        await db.query(
          "select display_name,verified,deleted_at from public.profiles where id=$1",
          [member],
        )
      ).rows[0],
    ).toMatchObject({
      display_name: "Former member",
      verified: false,
      deleted_at: expect.any(Date),
    });
    for (const [table, column] of [
      ["posts", "author_id"],
      ["verifications", "user_id"],
      ["group_members", "user_id"],
      ["messages", "sender_id"],
    ])
      expect(
        (
          await db.query(
            `select count(*)::int n from public.${table} where ${column}=$1`,
            [member],
          )
        ).rows[0].n,
      ).toBe(0);
    expect(
      (
        await db.query("select body from public.messages where thread_id=$1", [
          thread,
        ])
      ).rows,
    ).toEqual([{ body: "Keep counterpart" }]);
    expect(
      (await db.query("select id from public.consents where id=$1", [consent]))
        .rowCount,
    ).toBe(1);
    expect(
      (
        await db.query(
          "select choice,weight from public.votes where proposal_id=$1 and user_id=$2",
          [proposal, member],
        )
      ).rows[0],
    ).toMatchObject({ choice: "yes", weight: "1.0" });
    expect(
      (
        await db.query("select id from public.proposals where id=$1", [
          proposal,
        ])
      ).rowCount,
    ).toBe(1);
    expect(
      (
        await db.query(
          "select email from public.interest_signups where email=$1",
          [email],
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await db.query(
          "select email from public.invited_emails where email=$1",
          [email],
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await db.query(
          "select action from public.audit_log where entity_id=$1 and action='account.removal_requested'",
          [member],
        )
      ).rowCount,
    ).toBe(1);
  });
  it("denies stale JWT reads including owner-rights views", async () => {
    for (const table of [
      "profiles",
      "public_profiles",
      "audit_log",
      "groups_directory",
      "proposal_results",
    ])
      expect((await act(member, `select * from public.${table}`)).rows).toEqual(
        [],
      );
    expect(
      (await act(other, "select * from public.public_profiles")).rows.length,
    ).toBeGreaterThan(0);
  });
  it("denies stale JWT writes, definer RPCs and new evidence uploads", async () => {
    await expect(
      act(member, "select public.log_audit('forged','profile',$1)", [member]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      act(member, "select public.delete_my_account()"),
    ).rejects.toThrow(/account removed/);
    await expect(
      act(member, "update public.profiles set deleted_at=null where id=$1", [
        member,
      ]),
    ).rejects.toThrow(/account removed/);
    await expect(
      act(
        member,
        "insert into storage.objects(bucket_id,name) values('verification-evidence',$1)",
        [`${member}/late.pdf`],
      ),
    ).rejects.toThrow(/account removed/);
    await expect(
      db.query("update public.profiles set verified=true where id=$1", [
        member,
      ]),
    ).rejects.toThrow(/account removed/);
  });
  it("prevents reinvites and completion while external cleanup is pending", async () => {
    await expect(
      act(admin, "select public.create_individual_invitation($1)", [email]),
    ).rejects.toThrow(/removal pending/);
    await expect(
      db.query("insert into public.invited_emails(email) values($1)", [email]),
    ).rejects.toThrow(/removal pending/);
    await expect(
      db.query("select public.finish_account_removal($1)", [job]),
    ).rejects.toThrow(/cleanup incomplete/);
    await expect(
      act(admin, "select public.finish_account_removal($1)", [job]),
    ).rejects.toThrow(/permission denied/);
    expect(
      (await act(support, "select * from public.account_removals")).rows,
    ).toEqual([]);
  });
  it("finds orphaned evidence and retains other members' files", async () => {
    expect(
      (
        await db.query("select * from public.account_removal_evidence($1)", [
          job,
        ])
      ).rows,
    ).toEqual([{ name: `${member}/orphan/nested.pdf` }]);
    // LOCAL fixture simulates Storage/Auth acknowledgements, not real services.
    await db.query("delete from storage.objects where name=$1", [
      `${member}/orphan/nested.pdf`,
    ]);
    await db.query(
      "update auth.users set email=$2,deleted_at=now() where id=$1",
      [member, `removed-${member}`],
    );
    await db.query("select public.finish_account_removal($1)", [job]);
    await db.query("select public.finish_account_removal($1)", [job]);
    expect(
      (
        await db.query(
          "select pending_email,completed_at from public.account_removals where id=$1",
          [job],
        )
      ).rows[0],
    ).toMatchObject({ pending_email: null, completed_at: expect.any(Date) });
    expect(
      (
        await db.query("select * from storage.objects where name=$1", [
          `${other}/keep.pdf`,
        ])
      ).rowCount,
    ).toBe(1);
  });
  it("allows the same email to start over with a fresh unverified identity", async () => {
    await act(admin, "select public.create_individual_invitation($1)", [email]);
    const fresh = randomUUID();
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [fresh, email],
    );
    expect(
      (
        await db.query(
          "select verified,role,tenure_start from public.profiles where id=$1",
          [fresh],
        )
      ).rows[0],
    ).toEqual({ verified: false, role: "member", tenure_start: null });
    await db.query("select public.finish_account_removal($1)", [job]);
    expect(
      (await act(fresh, "select public.is_active_account() active")).rows[0]
        .active,
    ).toBe(true);
    expect(
      (await db.query("select * from public.votes where user_id=$1", [fresh]))
        .rows,
    ).toEqual([]);
  });

  it("waits for an in-flight member write, then removes that content too", async () => {
    const racing = randomUUID();
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [racing, `${racing}@example.test`],
    );
    await db.query("update public.profiles set verified=true where id=$1", [
      racing,
    ]);
    const writer = new pg.Client({ connectionString: target });
    const observer = new pg.Client({ connectionString: target });
    await writer.connect();
    await observer.connect();
    try {
      await writer.query("begin");
      await writer.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: racing }),
      ]);
      await writer.query("set local role authenticated");
      await writer.query(
        "insert into public.posts(group_id,author_id,category,title,body) select id,$1,'need','Racing post','Fixture content' from public.groups where slug='everyone'",
        [racing],
      );
      const pending = remove(admin, racing, `${racing}@example.test`);
      let waiting = false;
      for (let attempt = 0; attempt < 50 && !waiting; attempt++) {
        waiting = (
          await observer.query(
            "select exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and wait_event_type='Lock' and query like '%begin_account_removal%') waiting",
          )
        ).rows[0].waiting;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await writer.query("commit");
      await pending;
      expect(waiting).toBe(true);
      expect(
        (
          await db.query("select * from public.posts where author_id=$1", [
            racing,
          ])
        ).rowCount,
      ).toBe(0);
    } finally {
      await writer.query("rollback");
      await writer.end();
      await observer.end();
    }
  });
});
