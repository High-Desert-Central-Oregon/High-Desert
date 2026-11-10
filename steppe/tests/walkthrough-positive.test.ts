import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { securityDb, target } from "./helpers/security-db";
import {
  dbReachable,
  makeClient,
  impersonate,
} from "./helpers/pg-impersonation";

const dbUp = await dbReachable();

// A/B exercise the current application RPCs on the explicit disposable fixture.
// Separate committed requests let the voting window genuinely expire: now() is
// frozen inside a rollback-only transaction. Random synthetic records remain in
// the disposable database; no triggers, clocks, or append-only guards are disabled.
// Initialize an empty fixture with tests/fixtures/security-remediation-database.mjs
// and set MEMBER_PIPELINE_TEST_DB_URL (validated loopback + exact database name).
describe.skipIf(!target)(
  "Walkthroughs A/B: verification, appeals, and voting",
  () => {
    const { db, act } = securityDb();
    beforeAll(async () => {
      await db.connect();
    });
    afterAll(async () => {
      await db.end();
    });

    async function person(verified = true, role = "member", months = 0) {
      const id = randomUUID();
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        `${id}@example.test`,
      ]);
      await db.query(
        "update profiles set display_name=$2,verified=$3,role=$4::member_role,tenure_start=(current_date-$5::int*interval '1 month')::date where id=$1",
        [id, `Walkthrough ${id}`, verified, role, months],
      );
      if (!verified)
        await db.query("update profiles set tenure_start=null where id=$1", [
          id,
        ]);
      return id;
    }

    async function removedEvent() {
      const author = await person(),
        peer = await person();
      const moderator = await person(true, "moderator"),
        reviewer = await person(true, "moderator");
      const event = (
        await act(
          author,
          "insert into events(group_id,creator_id,title,starts_at) select id,$1,'Walkthrough gathering',now()+interval '1 day' from groups where slug='everyone' returning id",
          [author],
        )
      ).rows[0].id;
      expect(
        (await act(peer, "select title from events where id=$1", [event])).rows,
      ).toEqual([{ title: "Walkthrough gathering" }]);
      const removal = (
        await act(
          moderator,
          "insert into moderation_actions(target_type,target_id,actor_id,action,reason) values('event',$1,$2,'remove','Venue permission needs clarification') returning id",
          [event, moderator],
        )
      ).rows[0].id;
      return { author, peer, moderator, reviewer, event, removal };
    }

    async function overturn(f: Awaited<ReturnType<typeof removedEvent>>) {
      const appeal = (
        await act(
          f.author,
          "select file_appeal($1,'The venue has confirmed permission.') id",
          [f.removal],
        )
      ).rows[0].id;
      await expect(
        act(
          f.moderator,
          "select resolve_appeal($1,false,'Permission confirmed')",
          [appeal],
        ),
      ).rejects.toThrow(/separation of duties/);
      await act(
        f.reviewer,
        "select resolve_appeal($1,false,'Permission confirmed')",
        [appeal],
      );
      return appeal;
    }

    it("A2: approval sets verified status and tenure only after cleanup, purges the pointer, and audits once", async () => {
      const applicant = await person(false),
        moderator = await person(true, "moderator");
      const path = (
        await act(applicant, "select reserve_verification_upload('pdf') path")
      ).rows[0].path;
      // Storage schema fixture represents an uploaded object, not real document bytes.
      await act(
        applicant,
        "insert into storage.objects(bucket_id,name) values('verification-evidence',$1)",
        [path],
      );
      const request = (
        await act(
          applicant,
          "insert into verifications(user_id,method,evidence_path) values($1,'utility_bill',$2) returning id",
          [applicant, path],
        )
      ).rows[0].id;
      const decision = (
        await act(
          moderator,
          "select * from begin_verification_decision($1,true,'')",
          [request],
        )
      ).rows[0];
      expect(decision).toMatchObject({ evidence_path: path, completed: false });
      expect(decision.token).toBeTruthy();
      await expect(
        act(moderator, "select decide_verification($1,true)", [request]),
      ).rejects.toThrow(/cleanup/);
      expect(
        (
          await act(
            applicant,
            "select verified,tenure_start from profiles where id=$1",
            [applicant],
          )
        ).rows[0],
      ).toEqual({ verified: false, tenure_start: null });
      // Simulate successful Storage API removal in this metadata-only local fixture.
      // External API success/failure handling is covered by the review-worker tests.
      await db.query(
        "delete from storage.objects where bucket_id='verification-evidence' and name=$1",
        [path],
      );
      await act(
        null,
        "select confirm_verification_purge($1,$2)",
        [request, decision.token],
        "service_role",
      );
      await act(moderator, "select decide_verification($1,true)", [request]);
      await act(moderator, "select decide_verification($1,true)", [request]);
      expect(
        (
          await act(
            applicant,
            "select verified,tenure_start=current_date as tenure_today from profiles where id=$1",
            [applicant],
          )
        ).rows[0],
      ).toEqual({ verified: true, tenure_today: true });
      expect(
        (
          await act(
            moderator,
            "select status,review_state,evidence_path,reviewed_by,reviewed_at is not null as reviewed from verifications where id=$1",
            [request],
          )
        ).rows[0],
      ).toEqual({
        status: "approved",
        review_state: "complete",
        evidence_path: null,
        reviewed_by: moderator,
        reviewed: true,
      });
      expect(
        (
          await act(
            moderator,
            "select action,actor_id,metadata from audit_log where entity_id=$1 and action='verification.approved'",
            [request],
          )
        ).rows,
      ).toEqual([
        { action: "verification.approved", actor_id: moderator, metadata: {} },
      ]);
    });

    it("A3–A4: a member creates an event and a moderator removes it with a legible reason", async () => {
      const f = await removedEvent();
      expect(
        (await act(f.peer, "select id from events where id=$1", [f.event]))
          .rowCount,
      ).toBe(0);
      expect(
        (await act(f.author, "select id from events where id=$1", [f.event]))
          .rowCount,
      ).toBe(1);
      expect(
        (
          await act(f.peer, "select is_content_hidden('event',$1) hidden", [
            f.event,
          ])
        ).rows[0].hidden,
      ).toBe(true);
      expect(
        (
          await act(
            f.peer,
            "select actor_id,metadata from audit_log where entity_id=$1 and action='moderation.remove'",
            [f.event],
          )
        ).rows,
      ).toEqual([
        {
          actor_id: f.moderator,
          metadata: { reason: "Venue permission needs clarification" },
        },
      ]);
    });

    it("A5–A7: the creator appeals and a different moderator restores the event with its history intact", async () => {
      const f = await removedEvent();
      const appeal = await overturn(f);
      expect(
        (
          await act(f.author, "select status from appeals where id=$1", [
            appeal,
          ])
        ).rows[0].status,
      ).toBe("overturned");
      expect(
        (await act(f.peer, "select id from events where id=$1", [f.event]))
          .rows,
      ).toEqual([{ id: f.event }]);
      expect(
        (
          await act(f.peer, "select is_content_hidden('event',$1) hidden", [
            f.event,
          ])
        ).rows[0].hidden,
      ).toBe(false);
      const history = (
        await act(
          f.peer,
          "select action,actor_id from moderation_actions where target_type='event' and target_id=$1 order by created_at,id",
          [f.event],
        )
      ).rows;
      expect(history).toEqual([
        { action: "remove", actor_id: f.moderator },
        { action: "restore", actor_id: f.reviewer },
      ]);
      expect(
        (
          await act(
            f.peer,
            "select actor_id,metadata from audit_log where action='appeal.overturned' and entity_id=$1",
            [appeal],
          )
        ).rows,
      ).toEqual([
        {
          actor_id: f.reviewer,
          metadata: {
            moderation_action_id: f.removal,
            reason: "Permission confirmed",
          },
        },
      ]);
    });

    it("A8: the Record projection names acting moderators without including the affected member", async () => {
      const f = await removedEvent();
      const appeal = await overturn(f);
      // Same public columns and actor-name lookup as governance/record/page.tsx.
      const rows = (
        await act(
          f.peer,
          "select action,entity,entity_id,metadata,actor_id,created_at from audit_log where (action like 'moderation.%' or action like 'appeal.%') and entity_id=any($1::uuid[])",
          [[f.event, appeal]],
        )
      ).rows;
      expect(rows).toHaveLength(3);
      expect(new Set(rows.map((row) => row.actor_id))).toEqual(
        new Set([f.moderator, f.reviewer]),
      );
      const names = (
        await act(
          f.peer,
          "select id,display_name from public_profiles where id=any($1::uuid[])",
          [rows.map((row) => row.actor_id)],
        )
      ).rows;
      expect(new Set(names.map((row) => row.display_name))).toEqual(
        new Set([`Walkthrough ${f.moderator}`, `Walkthrough ${f.reviewer}`]),
      );
      expect(JSON.stringify({ rows, names })).not.toContain(f.author);
      expect(
        rows.every((row) => !("user_id" in row) && !("creator_id" in row)),
      ).toBe(true);
    });

    async function voteFixture(seconds = 2) {
      const moderator = await person(true, "moderator");
      const voters: string[] = [];
      // Three yes ballots weigh 1 + 1.5 + 2; no weighs 1; abstain weighs 3.
      for (const months of [0, 18, 36, 6, 60])
        voters.push(await person(true, "member", months));
      const proposal = (
        await act(
          moderator,
          "insert into proposals(author_id,title,kind,opens_at,closes_at) values($1,'Walkthrough vote','minor',now()-interval '1 day',clock_timestamp()+$2::int*interval '1 second') returning id",
          [moderator, seconds],
        )
      ).rows[0].id;
      return { moderator, voters, proposal };
    }

    async function castFive(f: Awaited<ReturnType<typeof voteFixture>>) {
      const choices = ["yes", "yes", "yes", "no", "abstain"];
      for (let i = 0; i < f.voters.length; i++)
        await act(f.voters[i], "select cast_ballot($1,$2::vote_choice)", [
          f.proposal,
          choices[i],
        ]);
    }

    async function closeAfterDeadline(
      f: Awaited<ReturnType<typeof voteFixture>>,
    ) {
      // Let real database time pass; never rewrite a frozen proposal deadline or seed ballots past it.
      await db.query(
        "select pg_sleep(greatest(0,extract(epoch from closes_at-clock_timestamp()))::double precision+0.02) from proposals where id=$1",
        [f.proposal],
      );
      await act(
        f.moderator,
        "update proposals set status='closed' where id=$1",
        [f.proposal],
      );
    }

    it("B2/B4: five weighted ballots reveal yes 4.5 / no 1.0 / abstain 3.0 only after the window closes", async () => {
      const f = await voteFixture();
      await castFive(f);
      expect(
        (
          await act(
            f.voters[0],
            "select * from proposal_results where proposal_id=$1",
            [f.proposal],
          )
        ).rows,
      ).toEqual([]);
      await closeAfterDeadline(f);
      const result = (
        await act(
          f.voters[0],
          "select * from proposal_results where proposal_id=$1",
          [f.proposal],
        )
      ).rows[0];
      expect(result).toMatchObject({
        status: "closed",
        revealed: true,
        quorum_met: true,
        outcome: "passed",
      });
      expect(Number(result.ballots)).toBe(5);
      expect(
        [result.yes_weight, result.no_weight, result.abstain_weight].map(
          Number,
        ),
      ).toEqual([4.5, 1, 3]);
      await expect(
        act(f.voters[0], "select cast_ballot($1,'no')", [f.proposal]),
      ).rejects.toThrow(/closed/);
    }, 10000);

    it("B3: an open ballot can be revised while retaining exactly one server-weighted row", async () => {
      const f = await voteFixture(60);
      const voter = f.voters[1];
      await act(voter, "select cast_ballot($1,'yes')", [f.proposal]);
      const original = (
        await act(
          voter,
          "select id,user_id,choice,weight from votes where proposal_id=$1",
          [f.proposal],
        )
      ).rows[0];
      await act(voter, "select cast_ballot($1,'abstain')", [f.proposal]);
      const revised = (
        await act(
          voter,
          "select id,user_id,choice,weight from votes where proposal_id=$1",
          [f.proposal],
        )
      ).rows;
      expect(revised).toEqual([{ ...original, choice: "abstain" }]);
      expect(original.user_id).toBe(voter);
      expect(Number(original.weight)).toBe(1.5);
      expect(
        (
          await db.query(
            "select count(*)::int n from votes where proposal_id=$1 and user_id=$2",
            [f.proposal, voter],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await act(f.voters[0], "select id from votes where proposal_id=$1", [
            f.proposal,
          ])
        ).rows,
      ).toEqual([]);
    });

    it("B4: closing records only aggregate results, never voter identities or individual choices", async () => {
      const f = await voteFixture();
      await castFive(f);
      await closeAfterDeadline(f);
      await act(f.moderator, "select finalize_proposal_outcome($1)", [
        f.proposal,
      ]);
      const rows = (
        await act(
          f.voters[0],
          "select actor_id,metadata from audit_log where action='proposal.closed' and entity_id=$1",
          [f.proposal],
        )
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].actor_id).toBe(f.moderator);
      const meta = rows[0].metadata;
      expect(Object.keys(meta).sort()).toEqual(
        [
          "ballots",
          "revealed",
          "electorate_size",
          "required_ballots",
          "quorum_met",
          "approval_fraction",
          "rules_version",
          "outcome",
          "yes_weight",
          "no_weight",
          "abstain_weight",
          "approval_ratio",
        ].sort(),
      );
      expect(meta).toMatchObject({
        ballots: 5,
        revealed: true,
        required_ballots: 5,
        quorum_met: true,
        outcome: "passed",
        yes_weight: 4.5,
        no_weight: 1,
        abstain_weight: 3,
      });
      expect(meta.approval_ratio).toBeCloseTo(4.5 / 5.5);
      for (const voter of f.voters)
        expect(JSON.stringify(rows)).not.toContain(voter);
    }, 10000);
  },
);

// Walkthrough X1 — the Exchange happy path (IMPLEMENTED; spec §10 step 5).
// post → author edit → moderator pin/unpin → remove → author appeal → a
// DIFFERENT moderator overturns → restored. Everything through the same
// grants/policies/RPCs the app uses; rolled back, nothing persists.
describe.skipIf(!dbUp)(
  "Walkthrough X1: post → pin → remove → appeal → overturn",
  () => {
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

    it("carries a post through the full moderation chain with the audit trail intact", async () => {
      await h.inTxn(async (c) => {
        const author = "0x100000-0000-0000-0000-000000000001".replace("x", "a");
        const mod1 = "0b100000-0000-0000-0000-000000000002";
        const mod2 = "0c100000-0000-0000-0000-000000000003";
        await h.createMember(author, "x1-author@walk.test", { verified: true });
        await h.createMember(mod1, "x1-mod1@walk.test", {
          verified: true,
          role: "moderator",
        });
        await h.createMember(mod2, "x1-mod2@walk.test", {
          verified: true,
          role: "moderator",
        });
        const everyone = (
          await c.query("select id from groups where slug='everyone'")
        ).rows[0].id;

        // 1 · The member posts to the community board (the app's exact payload).
        await h.actAs(author);
        const post = (
          await c.query(
            "insert into posts (group_id, author_id, category, title, body) values ($1, $2, 'offer', 'Free tomato starts', 'Heirloom seedlings, more than I can plant.') returning id",
            [everyone, author],
          )
        ).rows[0].id;

        // 2 · Author edits — edited_at is server-stamped; identity frozen.
        await c.query(
          "update posts set title = 'Free tomato starts (updated)' where id=$1",
          [post],
        );
        await c.query("reset role");
        const afterEdit = (
          await c.query(
            "select edited_at, group_id, pinned_at from posts where id=$1",
            [post],
          )
        ).rows[0];
        expect(afterEdit.edited_at).not.toBeNull();
        expect(afterEdit.group_id).toBe(everyone);
        expect(afterEdit.pinned_at).toBeNull();

        // 3 · A moderator pins — pinned_by recorded, audit row written (G13).
        await h.actAs(mod1);
        await c.query("select set_post_pin($1, true)", [post]);
        await c.query("reset role");
        const pinned = (
          await c.query("select pinned_by, edited_at from posts where id=$1", [
            post,
          ])
        ).rows[0];
        expect(pinned.pinned_by).toBe(mod1);
        const pinAudit = await c.query(
          "select count(*)::int as n from audit_log where action='post.pinned' and entity_id=$1",
          [post],
        );
        expect(pinAudit.rows[0].n).toBe(1);

        // 4 · Unpin (audited), then remove with a written reason (P7 — legible).
        // The remove row is backdated 1s: inside this single test transaction
        // now() is frozen, so remove and the later restore would otherwise tie
        // on created_at and is_content_hidden's id-desc tiebreak becomes a
        // random-UUID coin flip. Production never ties — the two actions are
        // separate requests; the backdate restores the real ordering.
        await h.actAs(mod1);
        await c.query("select set_post_pin($1, false)", [post]);
        const action = (
          await c.query(
            "insert into moderation_actions (target_type, target_id, action, reason, actor_id, created_at) values ('post', $1, 'remove', 'walkthrough probe', $2, now() - interval '1 second') returning id",
            [post, mod1],
          )
        ).rows[0].id;
        await c.query("reset role");
        const hidden = await c.query(
          "select is_content_hidden('post', $1) as h",
          [post],
        );
        expect(hidden.rows[0].h).toBe(true);

        // 5 · The author appeals (0019 taught file_appeal posts ownership).
        await h.actAs(author);
        const appeal = (
          await c.query(
            "select file_appeal($1, 'These were free seedlings.') as id",
            [action],
          )
        ).rows[0].id;
        expect(appeal).toBeTruthy();

        // 6 · A DIFFERENT moderator overturns → a restore action un-hides it.
        await h.actAs(mod2);
        await c.query(
          "select resolve_appeal($1, false, 'Removal was overbroad.')",
          [appeal],
        );
        await c.query("reset role");
        const restored = await c.query(
          "select is_content_hidden('post', $1) as h",
          [post],
        );
        expect(restored.rows[0].h).toBe(false);
        const trail = await c.query(
          "select count(*)::int as n from moderation_actions where target_type='post' and target_id=$1",
          [post],
        );
        expect(trail.rows[0].n).toBe(2); // remove + restore — the append-only record
      });
    });
  },
);

describe.skipIf(!dbUp)(
  "Walkthrough C1: mint → fetch → rotate → leave → dead feed",
  () => {
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

    it("carries a feed through its whole life under the owner's standing", async () => {
      await h.inTxn(async (c) => {
        const alice = "c1a10000-0000-0000-0000-00000000000a";
        const gid = "c1a10000-0000-0000-0000-00000000000b";
        await h.createMember(alice, "alice-c1@rls.test", { verified: true });
        await c.query(
          "insert into groups (id, slug, name, visibility, join_policy) values ($1::uuid, 'c1-wt-' || substr($2, 1, 8), 'C1 walkthrough group', 'members_only', 'request')",
          [gid, gid],
        );
        await c.query(
          "insert into group_members (group_id, user_id, role, status) values ($1, $2, 'member', 'active')",
          [gid, alice],
        );
        // One group event (with an end → DTEND source), one Everyone event
        // alice RSVP'd (the only door Everyone events have into My Calendar).
        const ev1 = (
          await c.query(
            "insert into events (creator_id, group_id, title, starts_at, ends_at, location) values ($1, $2, 'Group hall night', now() + interval '3 days', now() + interval '3 days 2 hours', 'Grange Hall') returning id",
            [alice, gid],
          )
        ).rows[0].id;
        const everyone = (
          await c.query("select id from groups where slug = 'everyone'")
        ).rows[0].id;
        const ev2 = (
          await c.query(
            "insert into events (creator_id, group_id, title, starts_at, location) values ($1, $2, 'Town picnic', now() + interval '5 days', 'Sam Johnson Park') returning id",
            [alice, everyone],
          )
        ).rows[0].id;
        await c.query(
          "insert into event_rsvps (event_id, user_id, status) values ($1, $2, 'going')",
          [ev2, alice],
        );

        // MINT (as alice) — the server makes the secrets; 256-bit hex.
        await h.actAs(alice);
        const personal = (
          await c.query("select * from public.mint_calendar_feed()")
        ).rows[0];
        const group = (
          await c.query("select * from public.mint_calendar_feed($1)", [gid])
        ).rows[0];
        expect(personal.feed_token).toMatch(/^[0-9a-f]{64}$/);
        expect(group.feed_token).toMatch(/^[0-9a-f]{64}$/);

        // FETCH (as the route does: service_role). Clear the sub first — every
        // owner-context write below must see auth.uid() = null.
        await c.query("select set_config('request.jwt.claims', '', true)");
        await c.query("reset role");
        await c.query("set local role service_role");
        const pay = (
          await c.query("select public.calendar_feed_payload($1) as p", [
            personal.feed_token,
          ])
        ).rows[0].p;
        expect(pay.ok).toBe(true);
        expect(pay.cal_name).toBe("Steppe — My calendar · Mi calendario");
        // Both scopes, one clock, ascending (+3d before +5d).
        expect(pay.events.map((e: { id: string }) => e.id)).toEqual([ev1, ev2]);
        // Minimized payload: exactly the seven keys, nothing more (spec §6.2).
        expect(Object.keys(pay.events[0]).sort()).toEqual([
          "created_at",
          "ends_at",
          "id",
          "location",
          "starts_at",
          "status",
          "title",
        ]);
        expect(pay.events[0].ends_at).not.toBeNull(); // DTEND source carried
        await c.query("reset role");

        // The member-visible leak detector stamped (C-G3).
        const stamped = await c.query(
          "select last_fetched_at from calendar_feeds where id = $1",
          [personal.feed_id],
        );
        expect(stamped.rows[0].last_fetched_at).not.toBeNull();

        // ROTATE (as alice) — the old token dies the instant the new one exists.
        await h.actAs(alice);
        const fresh = (
          await c.query("select public.rotate_calendar_feed($1) as t", [
            personal.feed_id,
          ])
        ).rows[0].t;
        expect(fresh).not.toBe(personal.feed_token);
        await c.query("select set_config('request.jwt.claims', '', true)");
        await c.query("reset role");
        await c.query("set local role service_role");
        expect(
          (
            await c.query("select public.calendar_feed_payload($1) as p", [
              personal.feed_token,
            ])
          ).rows[0].p,
        ).toEqual({ ok: false });
        expect(
          (
            await c.query("select public.calendar_feed_payload($1) as p", [
              fresh,
            ])
          ).rows[0].p.ok,
        ).toBe(true);
        await c.query("reset role");

        // LEAVE — the group's rows fall out of the personal feed (RSVP'd or
        // not); the group feed dies whole. Fail closed, no cleanup job.
        await c.query(
          "delete from group_members where group_id = $1 and user_id = $2",
          [gid, alice],
        );
        await c.query("set local role service_role");
        const after = (
          await c.query("select public.calendar_feed_payload($1) as p", [fresh])
        ).rows[0].p;
        expect(after.ok).toBe(true);
        expect(after.events.map((e: { id: string }) => e.id)).toEqual([ev2]);
        expect(
          (
            await c.query("select public.calendar_feed_payload($1) as p", [
              group.feed_token,
            ])
          ).rows[0].p,
        ).toEqual({ ok: false });
        await c.query("reset role");

        // REVOKE (as alice) — delete = the feed is gone for good.
        await h.actAs(alice);
        const del = await c.query("delete from calendar_feeds where id = $1", [
          personal.feed_id,
        ]);
        expect(del.rowCount).toBe(1);
        await c.query("select set_config('request.jwt.claims', '', true)");
        await c.query("reset role");
        await c.query("set local role service_role");
        expect(
          (
            await c.query("select public.calendar_feed_payload($1) as p", [
              fresh,
            ])
          ).rows[0].p,
        ).toEqual({ ok: false });
        await c.query("reset role");
      });
    });
  },
);

describe.skipIf(!dbUp)(
  "Walkthrough M1: message → reply → block → report(excerpt) → moderator sees excerpt only",
  () => {
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

    it("carries a conversation through its life, and the report shows only the quoted excerpt", async () => {
      await h.inTxn(async (c) => {
        const aida = "a11d0000-0000-0000-0000-00000000000a";
        const ben = "be110000-0000-0000-0000-00000000000b";
        const mod = "eec70000-0000-0000-0000-00000000000e";
        await h.createMember(aida, "wt-aida@msg.test", { verified: true });
        await h.createMember(ben, "wt-ben@msg.test", { verified: true });
        await h.createMember(mod, "wt-mod@msg.test", {
          verified: true,
          role: "moderator",
        });
        const everyone = (
          await c.query("select id from groups where slug='everyone'")
        ).rows[0].id;
        const post = (
          await c.query(
            "insert into posts (group_id, author_id, category, title, body, allow_messages) values ($1, $2, 'offer', 'Free tomato starts', 'body', true) returning id",
            [everyone, ben],
          )
        ).rows[0].id;

        // 1 · aida starts a thread from ben's post; 2 · ben replies.
        await h.actAs(aida);
        const tid = (
          await c.query(
            "select public.start_thread($1, 'Are these still free?', $2) as id",
            [ben, post],
          )
        ).rows[0].id;
        await h.actAs(ben);
        await c.query("select public.respond_message_request($1,'accept')", [
          tid,
        ]);
        await c.query(
          "insert into messages (thread_id, sender_id, body) values ($1, $2, 'Yes — porch pickup.')",
          [tid, ben],
        );
        await c.query("reset role");
        const msgs = await c.query(
          "select count(*)::int n from messages where thread_id=$1",
          [tid],
        );
        expect(msgs.rows[0].n).toBe(2);

        // 3 · aida reports the conversation with HER OWN quoted excerpt.
        const excerpt =
          "aida: Are these still free? / ben: Yes — porch pickup.";
        await h.actAs(aida);
        const report = (
          await c.query(
            "insert into reports (reporter_id, target_type, target_id, body, quoted_excerpt) values ($1, 'message_thread', $2, 'This felt off', $3) returning id",
            [aida, tid, excerpt],
          )
        ).rows[0].id;

        // 4 · aida blocks ben — silent, symmetric. Sending is now frozen.
        // (Savepoint: the refused insert aborts the txn; recover so the
        // moderator reads below still run in the same inTxn.)
        await c.query(
          "insert into member_blocks (blocker_id, blocked_id) values ($1, $2)",
          [aida, ben],
        );
        await c.query("savepoint sp_block");
        let frozen = false;
        try {
          await c.query(
            "insert into messages (thread_id, sender_id, body) values ($1, $2, 'more')",
            [tid, aida],
          );
        } catch {
          frozen = true;
        }
        await c.query("rollback to savepoint sp_block");
        expect(frozen).toBe(true);
        await c.query("reset role");

        // 5 · the moderator sees the REPORT and its excerpt — but NOT the thread.
        await h.actAs(mod);
        const seen = (
          await c.query("select quoted_excerpt from reports where id=$1", [
            report,
          ])
        ).rows[0];
        expect(seen.quoted_excerpt).toBe(excerpt);
        // the zero-read pin holds: the moderator cannot open the thread itself.
        expect(
          (
            await c.query(
              "select count(*)::int n from messages where thread_id=$1",
              [tid],
            )
          ).rows[0].n,
        ).toBe(0);
        expect(
          (
            await c.query("select count(*)::int n from threads where id=$1", [
              tid,
            ])
          ).rows[0].n,
        ).toBe(0);
        // 6 · resolve the report (moderator close-out; audited).
        await c.query("select public.resolve_report($1, 'dismissed')", [
          report,
        ]);
        await c.query("reset role");
        const audited = await c.query(
          "select count(*)::int n from audit_log where action='report.resolved' and entity_id=$1",
          [report],
        );
        expect(audited.rows[0].n).toBe(1);
      });
    });
  },
);
