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

describe.skipIf(!dbUp)("X1 Exchange refusals (0018/0019, spec §5.3)", () => {
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

  // ---- Structural (privilege-level: the trust columns are not grantable) ----

  it("pin: a client cannot UPDATE posts.pinned_at by any path (column privilege)", async () => {
    await expect(h.runAs(RANDO, "update posts set pinned_at = now()")).rejects.toThrow(
      /permission denied for table posts/,
    );
  });

  it("pin: a client cannot INSERT a born-pinned post", async () => {
    await expect(
      h.runAs(
        RANDO,
        "insert into posts (group_id, author_id, category, title, body, pinned_at) values (gen_random_uuid(), $1, 'offer', 't', 'b', now())",
        [RANDO],
      ),
    ).rejects.toThrow(/permission denied for table posts/);
  });

  it("invariant 7: a client cannot backdate created_at at insert (chronological feed)", async () => {
    await expect(
      h.runAs(
        RANDO,
        "insert into posts (group_id, author_id, category, title, body, created_at) values (gen_random_uuid(), $1, 'offer', 't', 'b', now() - interval '30 days')",
        [RANDO],
      ),
    ).rejects.toThrow(/permission denied for table posts/);
  });

  it("G12: a client cannot UPDATE events.group_id (re-homing is not grantable)", async () => {
    await expect(h.runAs(RANDO, "update events set group_id = gen_random_uuid()")).rejects.toThrow(
      /permission denied for table events/,
    );
  });

  // ---- Fixture-backed (row policies + the self-guarding pin RPC) ----

  /** A members-only group with one active member, built as owner. */
  async function makeMembersOnlyGroup(c: pg.Client, gid: string, member: string) {
    await c.query(
      "insert into groups (id, slug, name, visibility, join_policy) values ($1::uuid, 'rls-x1-' || substr($2, 1, 8), 'X1 probe group', 'members_only', 'request')",
      [gid, gid],
    );
    await c.query(
      "insert into group_members (group_id, user_id, role, status) values ($1, $2, 'member', 'active')",
      [gid, member],
    );
  }

  it("invariant 2: a member cannot post as someone else (author is pinned)", async () => {
    await h.inTxn(async (c) => {
      const a = "e1e10000-0000-0000-0000-000000000001";
      const b = "e2e20000-0000-0000-0000-000000000001";
      await h.createMember(a, "author-a@rls.test", { verified: true });
      await h.createMember(b, "author-b@rls.test", { verified: true });
      const { rows } = await c.query("select id from groups where slug='everyone'");
      await h.actAs(a);
      await expect(
        c.query(
          "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'offer', 'forged', 'x')",
          [rows[0].id, b],
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("G8/G12: a verified non-member can neither read nor write a members-only board", async () => {
    await h.inTxn(async (c) => {
      const insider = "e3e30000-0000-0000-0000-000000000001";
      const outsider = "e4e40000-0000-0000-0000-000000000001";
      const gid = "0e0e0000-0000-0000-0000-00000000000a";
      await h.createMember(insider, "insider@rls.test", { verified: true });
      await h.createMember(outsider, "outsider@rls.test", { verified: true });
      await makeMembersOnlyGroup(c, gid, insider);
      await c.query(
        "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'need', 'members only', 'x')",
        [gid, insider],
      );
      await h.actAs(outsider);
      const read = await c.query("select count(*)::int as n from posts where group_id=$1", [gid]);
      expect(read.rows[0].n).toBe(0);
      await expect(
        c.query(
          "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'offer', 'intrude', 'x')",
          [gid, outsider],
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("G8: pending membership is NOT membership (reads 0, insert refused)", async () => {
    await h.inTxn(async (c) => {
      const insider = "e5e50000-0000-0000-0000-000000000001";
      const pending = "e6e60000-0000-0000-0000-000000000001";
      const gid = "0e0e0000-0000-0000-0000-00000000000b";
      await h.createMember(insider, "insider2@rls.test", { verified: true });
      await h.createMember(pending, "pending@rls.test", { verified: true });
      await makeMembersOnlyGroup(c, gid, insider);
      await c.query(
        "insert into group_members (group_id, user_id, role, status) values ($1, $2, 'member', 'pending')",
        [gid, pending],
      );
      await c.query(
        "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'need', 'p', 'x')",
        [gid, insider],
      );
      await h.actAs(pending);
      const read = await c.query("select count(*)::int as n from posts where group_id=$1", [gid]);
      expect(read.rows[0].n).toBe(0);
      await expect(
        c.query(
          "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'offer', 'w', 'x')",
          [gid, pending],
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("G-2: an unverified member reads ZERO Everyone posts (the boundary a vote must move)", async () => {
    await h.inTxn(async (c) => {
      const author = "e7e70000-0000-0000-0000-000000000001";
      const unverified = "e8e80000-0000-0000-0000-000000000001";
      await h.createMember(author, "vauthor@rls.test", { verified: true });
      await h.createMember(unverified, "unverified@rls.test", { verified: false });
      const { rows } = await c.query("select id from groups where slug='everyone'");
      await c.query(
        "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'offer', 'public-ish', 'x')",
        [rows[0].id, author],
      );
      await h.actAs(unverified);
      const read = await c.query("select count(*)::int as n from posts");
      expect(read.rows[0].n).toBe(0);
    });
  });

  it("G-1: a plain member cannot pin the community board (set_post_pin gate)", async () => {
    await h.inTxn(async (c) => {
      const author = "e9e90000-0000-0000-0000-000000000001";
      await h.createMember(author, "pinless@rls.test", { verified: true });
      const { rows } = await c.query("select id from groups where slug='everyone'");
      const post = await c.query(
        "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'offer', 'pin probe', 'x') returning id",
        [rows[0].id, author],
      );
      await h.actAs(author);
      await expect(c.query("select set_post_pin($1, true)", [post.rows[0].id])).rejects.toThrow(
        /only a moderator/,
      );
    });
  });

  it("P7: removal hides a post from other members while the AUTHOR keeps the legible row", async () => {
    await h.inTxn(async (c) => {
      const author = "eaea0000-0000-0000-0000-000000000001";
      const other = "ebeb0000-0000-0000-0000-000000000001";
      const mod = "ecec0000-0000-0000-0000-000000000001";
      await h.createMember(author, "removed-author@rls.test", { verified: true });
      await h.createMember(other, "bystander@rls.test", { verified: true });
      await h.createMember(mod, "mod-x1@rls.test", { verified: true, role: "moderator" });
      const { rows } = await c.query("select id from groups where slug='everyone'");
      const post = await c.query(
        "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'offer', 'to remove', 'x') returning id",
        [rows[0].id, author],
      );
      await c.query(
        "insert into moderation_actions (target_type, target_id, action, reason, actor_id) values ('post', $1, 'remove', 'probe', $2)",
        [post.rows[0].id, mod],
      );
      await h.actAs(other);
      const hiddenRead = await c.query("select count(*)::int as n from posts where id=$1", [post.rows[0].id]);
      expect(hiddenRead.rows[0].n).toBe(0);
      await h.actAs(author);
      const ownRead = await c.query("select count(*)::int as n from posts where id=$1", [post.rows[0].id]);
      expect(ownRead.rows[0].n).toBe(1);
    });
  });

  it("0019: only the affected member may appeal a post removal", async () => {
    await h.inTxn(async (c) => {
      const author = "edee0000-0000-0000-0000-000000000001";
      const stranger = "efef0000-0000-0000-0000-000000000001";
      const mod = "f0f00000-0000-0000-0000-000000000001";
      await h.createMember(author, "appellant@rls.test", { verified: true });
      await h.createMember(stranger, "stranger@rls.test", { verified: true });
      await h.createMember(mod, "mod-x2@rls.test", { verified: true, role: "moderator" });
      const { rows } = await c.query("select id from groups where slug='everyone'");
      const post = await c.query(
        "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'offer', 'appealable', 'x') returning id",
        [rows[0].id, author],
      );
      const action = await c.query(
        "insert into moderation_actions (target_type, target_id, action, reason, actor_id) values ('post', $1, 'remove', 'probe', $2) returning id",
        [post.rows[0].id, mod],
      );
      await h.actAs(stranger);
      await expect(
        c.query("select file_appeal($1, 'not mine')", [action.rows[0].id]),
      ).rejects.toThrow(/affected member/);
    });
  });
});

describe.skipIf(!dbUp)("C1 calendar-feed refusals (0020, spec §5.4)", () => {
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

  // ---- Structural refusals (grant / function-guard level) ----

  it("a stranger cannot mint — verification is the floor", async () => {
    await expect(h.runAs(RANDO, "select * from public.mint_calendar_feed()")).rejects.toThrow(
      /verified members/,
    );
  });

  it("the serving RPC is service_role-only — even a signed-in caller is refused", async () => {
    await expect(
      h.runAs(RANDO, "select public.calendar_feed_payload(repeat('a', 64))"),
    ).rejects.toThrow(/permission denied for function calendar_feed_payload/);
  });

  it("no client write path: INSERT and UPDATE on calendar_feeds are ungranted", async () => {
    await expect(
      h.runAs(
        RANDO,
        "insert into calendar_feeds (member_id, group_id, token) values ($1, null, repeat('b', 64))",
        [RANDO],
      ),
    ).rejects.toThrow(/permission denied for table calendar_feeds/);
    await expect(
      h.runAs(RANDO, "update calendar_feeds set last_fetched_at = null"),
    ).rejects.toThrow(/permission denied for table calendar_feeds/);
  });

  it("member_id is not even selectable (spec §5.3)", async () => {
    await expect(h.runAs(RANDO, "select member_id from calendar_feeds")).rejects.toThrow(
      /permission denied for table calendar_feeds/,
    );
  });

  // ---- Fixture-backed (standing gates + cross-member walls) ----

  it("an unverified member cannot mint; PENDING membership cannot mint a group feed", async () => {
    await h.inTxn(async (c) => {
      const unverified = "c1c10000-0000-0000-0000-000000000001";
      await h.createMember(unverified, "c1-unverified@rls.test", { verified: false });
      await h.actAs(unverified);
      await expect(c.query("select * from public.mint_calendar_feed()")).rejects.toThrow(
        /verified members/,
      );
    });
    await h.inTxn(async (c) => {
      const insider = "c1c10000-0000-0000-0000-000000000002";
      const pending = "c1c10000-0000-0000-0000-000000000003";
      const gid = "c1c10000-0000-0000-0000-00000000000a";
      await h.createMember(insider, "c1-insider@rls.test", { verified: true });
      await h.createMember(pending, "c1-pending@rls.test", { verified: true });
      await c.query(
        "insert into groups (id, slug, name, visibility, join_policy) values ($1::uuid, 'rls-c1-' || substr($2, 1, 8), 'C1 probe group', 'members_only', 'request')",
        [gid, gid],
      );
      await c.query(
        "insert into group_members (group_id, user_id, role, status) values ($1, $2, 'member', 'active'), ($1, $3, 'member', 'pending')",
        [gid, insider, pending],
      );
      await h.actAs(pending);
      await expect(
        c.query("select * from public.mint_calendar_feed($1)", [gid]),
      ).rejects.toThrow(/group members/);
    });
  });

  it("cross-member: a feed is not probeable, rotatable, or deletable by anyone else", async () => {
    await h.inTxn(async (c) => {
      const a = "c1c10000-0000-0000-0000-000000000004";
      const b = "c1c10000-0000-0000-0000-000000000005";
      await h.createMember(a, "c1-owner@rls.test", { verified: true });
      await h.createMember(b, "c1-other@rls.test", { verified: true });
      await h.actAs(a);
      const minted = (await c.query("select * from public.mint_calendar_feed()")).rows[0];
      await h.actAs(b);
      const probe = await c.query(
        "select count(id)::int as n from calendar_feeds where token = $1 or id = $2",
        [minted.feed_token, minted.feed_id],
      );
      expect(probe.rows[0].n).toBe(0);
      const del = await c.query("delete from calendar_feeds where id = $1", [minted.feed_id]);
      expect(del.rowCount).toBe(0);
      await expect(
        c.query("select public.rotate_calendar_feed($1)", [minted.feed_id]),
      ).rejects.toThrow(/Not your calendar link/);
    });
  });

  it("scope collapse: left group, demoted member, revoked token — all the bare dead object", async () => {
    await h.inTxn(async (c) => {
      const m = "c1c10000-0000-0000-0000-000000000006";
      const gid = "c1c10000-0000-0000-0000-00000000000b";
      await h.createMember(m, "c1-standing@rls.test", { verified: true });
      await c.query(
        "insert into groups (id, slug, name, visibility, join_policy) values ($1::uuid, 'rls-c1-' || substr($2, 1, 8), 'C1 standing group', 'members_only', 'request')",
        [gid, gid],
      );
      await c.query(
        "insert into group_members (group_id, user_id, role, status) values ($1, $2, 'member', 'active')",
        [gid, m],
      );
      await h.actAs(m);
      const personal = (await c.query("select * from public.mint_calendar_feed()")).rows[0];
      const group = (
        await c.query("select * from public.mint_calendar_feed($1)", [gid])
      ).rows[0];

      // Back to owner context — clear the lingering sub so the profile guard
      // can't silently freeze the demotion below (auth.uid() must be null).
      await c.query("select set_config('request.jwt.claims', '', true)");
      await c.query("reset role");

      // LEFT GROUP → the group feed dies whole, indistinguishable from absent.
      await c.query("delete from group_members where group_id = $1 and user_id = $2", [gid, m]);
      await c.query("set local role service_role");
      const leftPayload = (
        await c.query("select public.calendar_feed_payload($1) as p", [group.feed_token])
      ).rows[0].p;
      expect(leftPayload).toEqual({ ok: false });
      await c.query("reset role");

      // DEMOTED (unverified) → every feed of theirs dies.
      await c.query("update profiles set verified = false where id = $1", [m]);
      await c.query("set local role service_role");
      const demotedPayload = (
        await c.query("select public.calendar_feed_payload($1) as p", [personal.feed_token])
      ).rows[0].p;
      expect(demotedPayload).toEqual({ ok: false });
      await c.query("reset role");

      // REVOKED (row deleted) → dead even with standing restored.
      await c.query("update profiles set verified = true where id = $1", [m]);
      await c.query("delete from calendar_feeds where id = $1", [personal.feed_id]);
      await c.query("set local role service_role");
      const revokedPayload = (
        await c.query("select public.calendar_feed_payload($1) as p", [personal.feed_token])
      ).rows[0].p;
      expect(revokedPayload).toEqual({ ok: false });
      await c.query("reset role");
    });
  });
});
