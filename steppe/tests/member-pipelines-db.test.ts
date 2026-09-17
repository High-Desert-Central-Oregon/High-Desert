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
describe.skipIf(!target)("member pipeline database boundaries", () => {
  const db = new pg.Client({ connectionString: target });
  const owner = randomUUID(),
    reviewer = randomUUID(),
    member = randomUUID(),
    other = randomUUID();
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
  async function invite(
    email = `${randomUUID()}@example.test`,
    interest: string | null = null,
  ) {
    return (
      await act(
        owner,
        "select public.create_individual_invitation($1,'en',$2) id",
        [email, interest],
      )
    ).rows[0].id as string;
  }
  async function verification(uid = member) {
    return (
      await db.query(
        "insert into public.verifications(user_id,method) values($1,'postcard_code') returning id",
        [uid],
      )
    ).rows[0].id as string;
  }
  beforeAll(async () => {
    await db.connect();
    for (const id of [owner, reviewer, member, other])
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
        [id, `${id}@example.test`],
      );
    await db.query("insert into public.support_operators(user_id) values($1)", [
      owner,
    ]);
    await db.query("update public.profiles set role='moderator' where id=$1", [
      reviewer,
    ]);
  });
  afterAll(async () => {
    await db.end();
  });
  it("keeps the interest list private except for designated onboarding operators", async () => {
    expect(
      (await act(owner, "select public.can_manage_onboarding() allowed"))
        .rows[0].allowed,
    ).toBe(true);
    await expect(
      act(member, "select * from public.onboarding_people()"),
    ).rejects.toThrow(/forbidden/);
    await expect(
      act(reviewer, "select * from public.onboarding_people()"),
    ).rejects.toThrow(/forbidden/);
    await expect(
      act(owner, "select email from public.interest_signups"),
    ).rejects.toThrow(/permission denied/);
  });
  it("binds to one email and saves one notice for repeated invitation clicks", async () => {
    const email = `${randomUUID()}@example.test`;
    const id = await invite(email);
    expect(await invite(email.toUpperCase())).toBe(id);
    expect(
      (
        await db.query(
          "select count(*)::int n from public.member_notices where invitation_id=$1",
          [id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await db.query("select public.can_start_email_signin($1) allowed", [
          email,
        ])
      ).rows[0].allowed,
    ).toBe(true);
    expect(
      (
        await db.query(
          "select public.can_start_email_signin('someone-else@example.test') allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  it("serializes simultaneous invitation creation and preserves one delivery job", async () => {
    const email = `${randomUUID()}@example.test`;
    const send = async () => {
      const client = new pg.Client({ connectionString: target });
      await client.connect();
      try {
        await client.query("begin");
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: owner }),
        ]);
        await client.query("set local role authenticated");
        const result = await client.query(
          "select public.create_individual_invitation($1) id",
          [email],
        );
        await client.query("commit");
        return result.rows[0].id;
      } finally {
        await client.end();
      }
    };
    const ids = await Promise.all([send(), send()]);
    expect(ids[0]).toBe(ids[1]);
    expect(
      (
        await db.query(
          "select count(*)::int n from public.member_notices where invitation_id=$1",
          [ids[0]],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("does not let the interest action bypass recorded consent", async () => {
    const email = `${randomUUID()}@example.test`;
    const result = await db.query(
      "insert into public.interest_signups(email,consent) values($1,false) returning id",
      [email],
    );
    await expect(invite(email, result.rows[0].id)).rejects.toThrow(/consent/);
  });
  it("checks invitation expiry/revocation at real Auth creation and first confirmation", async () => {
    const authUrl = new URL(target!);
    authUrl.username = "supabase_auth_admin";
    const auth = new pg.Client({ connectionString: authUrl.toString() });
    await auth.connect();
    try {
      await expect(
        auth.query("insert into auth.users(id,email) values($1,$2)", [
          randomUUID(),
          `${randomUUID()}@example.test`,
        ]),
      ).rejects.toThrow(/invite-only/);
      await expect(
        auth.query("insert into auth.users(id,email) values($1,null)", [
          randomUUID(),
        ]),
      ).rejects.toThrow(/email invitation/);
      const email = `${randomUUID()}@example.test`;
      const id = await invite(email);
      const uid = randomUUID();
      await auth.query("insert into auth.users(id,email) values($1,$2)", [
        uid,
        email,
      ]);
      expect(
        (
          await db.query("select verified from public.profiles where id=$1", [
            uid,
          ])
        ).rows[0].verified,
      ).toBe(false);
      await db.query(
        "update public.individual_invitations set expires_at=now()-interval '1 second' where id=$1",
        [id],
      );
      expect(
        (
          await db.query("select public.can_start_email_signin($1) allowed", [
            email,
          ])
        ).rows[0].allowed,
      ).toBe(false);
      await expect(
        auth.query(
          "update auth.users set email_confirmed_at=now() where id=$1",
          [uid],
        ),
      ).rejects.toThrow(/invite-only/);
      await invite(email);
      await act(owner, "select public.revoke_individual_invitation($1)", [id]);
      await expect(
        auth.query(
          "update auth.users set email_confirmed_at=now() where id=$1",
          [uid],
        ),
      ).rejects.toThrow(/invite-only/);
      await invite(email);
      await auth.query(
        "update auth.users set email_confirmed_at=now() where id=$1",
        [uid],
      );
      await act(owner, "select public.revoke_individual_invitation($1)", [id]);
      expect(
        (
          await db.query("select public.can_start_email_signin($1) allowed", [
            email,
          ])
        ).rows[0].allowed,
      ).toBe(true);
    } finally {
      await auth.end();
    }
  });
  it("keeps the legacy batch allowlist valid", async () => {
    const email = `${randomUUID()}@example.test`;
    await db.query("insert into public.invited_emails(email) values($1)", [
      email,
    ]);
    expect(
      (
        await db.query("select public.can_start_email_signin($1) allowed", [
          email,
        ])
      ).rows[0].allowed,
    ).toBe(true);
  });
  it("limits resends and cancels pending mail on revocation", async () => {
    const id = await invite();
    await expect(
      act(owner, "select public.retry_individual_invitation($1)", [id]),
    ).rejects.toThrow(/wait/);
    await act(owner, "select public.revoke_individual_invitation($1)", [id]);
    expect(
      (
        await db.query(
          "select state from public.member_notices where invitation_id=$1",
          [id],
        )
      ).rows[0].state,
    ).toBe("cancelled");
  });
  it("allows applicant clarification without granting verified status", async () => {
    const id = await verification();
    await act(
      reviewer,
      "select public.request_verification_information($1,'Which verification method would work for you?')",
      [id],
    );
    await expect(
      act(
        other,
        "select public.reply_to_verification($1,'A postcard please')",
        [id],
      ),
    ).rejects.toThrow(/unavailable/);
    await act(
      member,
      "select public.reply_to_verification($1,'A postcard please')",
      [id],
    );
    expect(
      (
        await db.query(
          "select review_state,member_reply from public.verifications where id=$1",
          [id],
        )
      ).rows[0],
    ).toEqual({ review_state: "ready", member_reply: "A postcard please" });
    expect(
      (
        await db.query("select verified from public.profiles where id=$1", [
          member,
        ])
      ).rows[0].verified,
    ).toBe(false);
  });
  it("requires the recorded human decision and confirmed purge, and preserves intent on retry", async () => {
    const id = await verification(other);
    await expect(
      act(member, "select public.begin_verification_decision($1,true,'')", [
        id,
      ]),
    ).rejects.toThrow(/forbidden/);
    const start = (
      await act(
        reviewer,
        "select * from public.begin_verification_decision($1,true,'')",
        [id],
      )
    ).rows[0];
    await expect(
      act(reviewer, "select public.decide_verification($1,true)", [id]),
    ).rejects.toThrow(/cleanup/);
    await expect(
      act(reviewer, "select public.confirm_verification_purge($1,$2)", [
        id,
        start.token,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      act(
        reviewer,
        "select public.begin_verification_decision($1,false,'Another reviewer chose differently')",
        [id],
      ),
    ).rejects.toThrow(/recorded decision/);
    expect(
      (
        await act(
          reviewer,
          "select * from public.begin_verification_decision($1,true,'')",
          [id],
        )
      ).rows[0].token,
    ).toBe(start.token);
    await db.query("select public.confirm_verification_purge($1,$2)", [
      id,
      start.token,
    ]);
    await act(reviewer, "select public.decide_verification($1,true)", [id]);
    await act(reviewer, "select public.decide_verification($1,true)", [id]);
    expect(
      (
        await db.query(
          "select status,evidence_path,review_state from public.verifications where id=$1",
          [id],
        )
      ).rows[0],
    ).toEqual({
      status: "approved",
      evidence_path: null,
      review_state: "complete",
    });
    expect(
      (
        await act(
          reviewer,
          "select * from public.begin_verification_decision($1,true,'')",
          [id],
        )
      ).rows[0].completed,
    ).toBe(true);
    expect(
      (
        await db.query(
          "select count(*)::int n from public.member_notices where verification_id=$1 and state='pending'",
          [id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await db.query(
          "select count(*)::int n from public.member_notices where verification_id=$1 and kind='verification_decided'",
          [id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("blocks self-review and direct control-field injection", async () => {
    const self = await verification(reviewer);
    await expect(
      act(
        reviewer,
        "select * from public.begin_verification_decision($1,true,'')",
        [self],
      ),
    ).rejects.toThrow(/unavailable/);
    const newMember = randomUUID();
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      newMember,
      `${newMember}@example.test`,
    ]);
    const row = (
      await act(
        newMember,
        "insert into public.verifications(user_id,method,review_state,evidence_purged,decision_approve) values($1,'postcard_code','finalizing',true,true) returning id,review_state,evidence_purged,decision_approve",
        [newMember],
      )
    ).rows[0];
    expect(row).toMatchObject({
      review_state: "ready",
      evidence_purged: false,
      decision_approve: null,
    });
    await expect(
      act(
        newMember,
        "insert into public.verifications(user_id,method) values($1,'postcard_code')",
        [newMember],
      ),
    ).rejects.toThrow(/already pending/);
  });
  it("exports only the acting applicant's clarification fields", async () => {
    const result = await act(
      member,
      "select * from public.my_verification_progress()",
    );
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0]).not.toHaveProperty("decision_token");
    expect(result.rows.every((row) => row.member_reply !== undefined)).toBe(
      true,
    );
  });
});
