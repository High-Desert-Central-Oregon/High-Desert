import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
const target = process.env.GROUP_MESSAGING_TEST_DB_URL;
if (target) {
  const u = new URL(target);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) ||
    u.pathname !== "/steppe_pipelines_test"
  )
    throw new Error("Isolated loopback steppe_pipelines_test only");
}
describe.skipIf(!target)(
  "Group messaging and request database boundaries",
  () => {
    const db = new pg.Client({ connectionString: target });
    let author: string,
      member: string,
      outsider: string,
      admin: string,
      mod: string,
      group: string,
      post: string;
    let oldPair: string, oldAuthor: string, oldMember: string;
    async function act(
      uid: string | null,
      sql: string,
      args: unknown[] = [],
      client = db,
      role = "authenticated",
    ) {
      await client.query("begin");
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify(uid ? { sub: uid } : {}),
        ]);
        await client.query(`set local role ${role}`);
        const r = await client.query(sql, args);
        await client.query("commit");
        return r;
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }
    async function person(verified = true) {
      const id = randomUUID();
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
        [id, `${id}@example.test`],
      );
      await db.query("update public.profiles set verified=$2 where id=$1", [
        id,
        verified,
      ]);
      return id;
    }
    async function prefs(uid: string, allow = true, version = 1, client = db) {
      return act(
        uid,
        "select public.set_group_contact_preference($1,$2,$3)",
        [group, version, allow],
        client,
      );
    }
    async function start(uid = member, to = author, g = group, client = db) {
      return (
        await act(
          uid,
          "select public.start_group_thread($1,'Synthetic request',$2) id",
          [to, g],
          client,
        )
      ).rows[0].id as string;
    }
    async function postStart(uid = member, to = author) {
      return (
        await act(
          uid,
          "select public.start_thread($1,'Synthetic post request',$2) id",
          [to, post],
        )
      ).rows[0].id as string;
    }
    async function reply(uid: string, t: string, client = db) {
      return act(
        uid,
        "insert into public.messages(thread_id,sender_id,body) values($1,$2,'Synthetic reply')",
        [t, uid],
        client,
      );
    }
    async function respond(uid: string, t: string, response = "accept") {
      return act(uid, "select public.respond_message_request($1,$2)", [
        t,
        response,
      ]);
    }
    async function ready() {
      await act(
        author,
        "select public.set_group_messaging_rules($1,'Respect group members. Contact about this group only.')",
        [group],
      );
      await prefs(author);
      await prefs(member, false);
    }
    async function messages(t: string) {
      return (
        await db.query("select * from public.messages where thread_id=$1", [t])
      ).rows;
    }
    beforeAll(async () => {
      await db.connect();
      oldAuthor = await person();
      oldMember = await person();
      const everyone = (
        await db.query("select id from groups where slug='everyone'")
      ).rows[0].id;
      const p = (
        await act(
          oldAuthor,
          "insert into public.posts(author_id,group_id,category,title,body,allow_messages) values($1,$2,'offer','Old synthetic post','Synthetic',true) returning id",
          [oldAuthor, everyone],
        )
      ).rows[0].id;
      oldPair = (
        await act(
          oldMember,
          "select public.start_thread($1,'Synthetic established history',$2) id",
          [oldAuthor, p],
        )
      ).rows[0].id;
      if (
        (
          await db.query(
            "select to_regprocedure('public.respond_message_request(uuid,text)') present",
          )
        ).rows[0].present &&
        (await db.query("select request_status from threads where id=$1",[oldPair])).rows[0].request_status === "pending"
      )
        await act(oldAuthor, "select respond_message_request($1,'accept')", [
          oldPair,
        ]);
      await reply(oldAuthor, oldPair);
      await db.query(
        readFileSync(
          new URL(
            "../../migrations/0044_group_messaging_requests.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
    });
    beforeEach(async () => {
      author = await person();
      member = await person();
      outsider = await person();
      admin = await person();
      mod = await person();
      await db.query("update public.profiles set role='admin' where id=$1", [
        admin,
      ]);
      await db.query(
        "update public.profiles set role='moderator' where id=$1",
        [mod],
      );
      group = (
        await act(
          author,
          "select public.create_group('Synthetic group',$1,null,null,'members_only','open') id",
          [`synthetic-${randomUUID()}`],
        )
      ).rows[0].id;
      await act(member, "select public.join_group($1)", [group]);
      const everyone = (
        await db.query("select id from groups where slug='everyone'")
      ).rows[0].id;
      post = (
        await act(
          author,
          "insert into public.posts(author_id,group_id,category,title,body,allow_messages) values($1,$2,'offer','Synthetic opt-in','Synthetic',true) returning id",
          [author, everyone],
        )
      ).rows[0].id;
    });
    afterAll(async () => {
      await db.end();
    });
    it("preserves established pairs and history through migration and rerun", async () => {
      expect(
        (
          await db.query(
            "select request_status from public.threads where id=$1",
            [oldPair],
          )
        ).rows[0].request_status,
      ).toBe("accepted");
      await reply(oldMember, oldPair);
      expect((await messages(oldPair)).length).toBeGreaterThanOrEqual(3);
      await db.query(
        readFileSync(
          new URL(
            "../../migrations/0044_group_messaging_requests.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await reply(oldAuthor, oldPair);
    });
    it("defaults off and never automatically acknowledges current members", async () => {
      expect(
        (
          await db.query(
            "select messaging_rules,messaging_rules_version from groups where id=$1",
            [group],
          )
        ).rows[0],
      ).toEqual({ messaging_rules: null, messaging_rules_version: 0 });
      expect(
        (await act(member, "select * from group_message_preferences")).rowCount,
      ).toBe(0);
      await expect(start()).rejects.toThrow(/unavailable/);
      await ready();
      expect(
        (
          await act(
            member,
            "select allow_requests from group_message_preferences",
          )
        ).rows[0].allow_requests,
      ).toBe(false);
      const t = await start();
      expect(
        (
          await db.query(
            "select request_status,about_group_id from threads where id=$1",
            [t],
          )
        ).rows[0],
      ).toEqual({ request_status: "pending", about_group_id: group });
    });
    it("requires both current acknowledgments and recipient opt-in, with only own preferences readable", async () => {
      await act(
        author,
        "select set_group_messaging_rules($1,'Synthetic rules')",
        [group],
      );
      await expect(start()).rejects.toThrow(/unavailable/);
      await prefs(author, false);
      await prefs(member);
      await expect(start()).rejects.toThrow(/unavailable/);
      await prefs(author);
      await start();
      for (const uid of [member, admin, mod])
        expect(
          (
            await act(
              uid,
              "select * from group_message_preferences where member_id=$1",
              [author],
            )
          ).rowCount,
        ).toBe(0);
      await expect(
        act(
          member,
          "update group_message_preferences set allow_requests=true where member_id=$1",
          [author],
        ),
      ).rejects.toThrow(/permission denied/);
    });
    it("exposes eligible contact names only to acknowledged active group members", async () => {
      await ready();
      expect(
        (
          await act(member, "select * from group_message_contacts($1)", [group])
        ).rows.map((r) => r.member_id),
      ).toEqual([author]);
      for (const uid of [outsider, admin, mod])
        expect(
          (await act(uid, "select * from group_message_contacts($1)", [group]))
            .rowCount,
        ).toBe(0);
      await act(author, "select disable_group_contact($1)", [group]);
      expect(
        (await act(member, "select * from group_message_contacts($1)", [group]))
          .rowCount,
      ).toBe(0);
    });
    it("requires reacknowledgment after changed/disabled/re-enabled rules and rejects stale form versions", async () => {
      await ready();
      await act(
        author,
        "select set_group_messaging_rules($1,'Updated synthetic rules')",
        [group],
      );
      await expect(start()).rejects.toThrow(/unavailable/);
      await expect(prefs(member, true, 1)).rejects.toThrow(
        /current group rules/,
      );
      await prefs(member, true, 2);
      await expect(start()).rejects.toThrow(/unavailable/);
      await prefs(author, true, 2);
      const t = await start();
      await act(author, "select set_group_messaging_rules($1,null)", [group]);
      await expect(start(author, member)).rejects.toThrow(/unavailable/);
      await act(
        author,
        "select set_group_messaging_rules($1,'Updated synthetic rules')",
        [group],
      );
      await expect(start()).rejects.toThrow(/unavailable/);
      expect((await messages(t)).length).toBe(1);
      await act(author, "select disable_group_contact($1)", [group]);
      expect(
        (
          await act(
            author,
            "select allow_requests from group_message_preferences",
          )
        ).rows[0].allow_requests,
      ).toBe(false);
    });
    it("keeps the rule version stable when a maintainer saves unchanged rules", async () => {
      await ready();
      await act(
        author,
        "select set_group_messaging_rules($1,'Respect group members. Contact about this group only.')",
        [group],
      );
      expect(
        (
          await db.query(
            "select messaging_rules_version from groups where id=$1",
            [group],
          )
        ).rows[0].messaging_rules_version,
      ).toBe(1);
      await start();
    });
    it("rejects nonmaintainer/anonymous rule writes, system groups, archived groups, and overlong rules", async () => {
      for (const uid of [member, admin, mod])
        await expect(
          act(uid, "select set_group_messaging_rules($1,'Forged')", [group]),
        ).rejects.toThrow(/unavailable/);
      await expect(
        act(
          null,
          "select set_group_messaging_rules($1,'Forged')",
          [group],
          db,
          "anon",
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        act(author, "select set_group_messaging_rules($1,$2)", [
          group,
          "x".repeat(2001),
        ]),
      ).rejects.toThrow(/long/);
      const everyone = (
        await db.query("select id from groups where slug='everyone'")
      ).rows[0].id;
      await expect(start(member, author, everyone)).rejects.toThrow(
        /unavailable/,
      );
      await ready();
      await db.query("update groups set archived_at=now() where id=$1", [
        group,
      ]);
      await expect(start()).rejects.toThrow(/unavailable/);
    });
    it("rejects pending/invited/cross-group and unverified or removed participants", async () => {
      await ready();
      for (const status of ["pending", "invited"]) {
        await db.query(
          "update group_members set status=$1 where group_id=$2 and user_id=$3",
          [status, group, member],
        );
        await expect(start()).rejects.toThrow(/unavailable/);
        await db.query(
          "update group_members set status='active' where group_id=$1 and user_id=$2",
          [group, member],
        );
        expect(
          (await act(member, "select * from group_message_preferences"))
            .rowCount,
        ).toBe(0);
        await prefs(member);
      }
      for (const uid of [outsider, admin, mod])
        await expect(start(uid)).rejects.toThrow(/unavailable/);
      await db.query("update profiles set verified=false where id=$1", [
        author,
      ]);
      await expect(start()).rejects.toThrow(/reached/);
      await db.query(
        "update profiles set verified=true,deleted_at=now() where id=$1",
        [author],
      );
      await expect(start()).rejects.toThrow(/unavailable/);
    });
    it("clears consent when leaving/rejoining or account deletion, including self-deletion", async () => {
      await ready();
      await act(member, "select leave_group($1)", [group]);
      expect(
        (await act(member, "select * from group_message_preferences")).rowCount,
      ).toBe(0);
      await act(member, "select join_group($1)", [group]);
      await expect(start()).rejects.toThrow(/unavailable/);
      await prefs(member);
      await act(member, "select delete_my_account()");
      expect(
        (
          await db.query(
            "select * from group_message_preferences where member_id=$1",
            [member],
          )
        ).rowCount,
      ).toBe(0);
    });
    it("caps new group contact at one pending message, including raw replies and opposite-direction starts", async () => {
      await ready();
      const t = await start();
      for (const uid of [author, member]) {
        expect((await act(uid, "select can_send($1) ok", [t])).rows[0].ok).toBe(
          false,
        );
        await expect(reply(uid, t)).rejects.toThrow();
      }
      await expect(start()).rejects.toThrow(/not available/);
      await expect(start(author, member)).rejects.toThrow(/unavailable/);
      await prefs(member);
      await expect(start(author, member)).rejects.toThrow(/not available/);
      expect((await messages(t)).length).toBe(1);
    });
    it("applies requests to new opted-in post pairs and accepts only as the recipient", async () => {
      const t = await postStart();
      await expect(reply(author, t)).rejects.toThrow();
      await expect(postStart()).rejects.toThrow(/not available/);
      for (const uid of [member, admin, mod])
        await expect(respond(uid, t)).rejects.toThrow(/unavailable/);
      await respond(author, t);
      await reply(author, t);
      await reply(member, t);
      expect((await messages(t)).length).toBe(3);
      expect(await postStart()).toBe(t);
    });
    it.each(["decline", "block"])(
      "closes %s requests without retry or private audit disclosure",
      async (response) => {
        await ready();
        const t = await start();
        const n = (await db.query("select count(*) from audit_log")).rows[0]
          .count;
        await respond(author, t, response);
        for (const uid of [author, member])
          await expect(reply(uid, t)).rejects.toThrow();
        await expect(start()).rejects.toThrow();
        await expect(postStart()).rejects.toThrow();
        await expect(respond(author, t)).rejects.toThrow(/unavailable/);
        expect((await messages(t)).length).toBe(1);
        expect(
          (await db.query("select count(*) from audit_log")).rows[0].count,
        ).toBe(n);
        if (response === "block")
          expect(
            (await act(member, "select * from member_blocks")).rowCount,
          ).toBe(0);
      },
    );
    it("retains accepted history and replies after opt-out, changed rules, leaving, and deleted post anchors", async () => {
      await ready();
      const t = await start();
      await respond(author, t);
      await act(author, "select disable_group_contact($1)", [group]);
      await expect(start()).rejects.toThrow(/unavailable/);
      await act(author, "select set_group_messaging_rules($1,'Changed')", [
        group,
      ]);
      await act(member, "select leave_group($1)", [group]);
      await reply(member, t);
      await reply(author, t);
      const p = await postStart();
      expect(p).toBe(t);
      expect(
        (
          await db.query(
            "select about_group_id,about_post_id from threads where id=$1",
            [t],
          )
        ).rows[0],
      ).toEqual({ about_group_id: group, about_post_id: null });
      await act(author, "delete from posts where id=$1", [post]);
      await reply(member, t);
    });
    it.each(["author", "member"])(
      "stops accepted messages in both directions when %s blocks",
      async (side) => {
        await ready();
        const t = await start();
        await respond(author, t);
        const uid = side === "author" ? author : member,
          other = side === "author" ? member : author;
        await act(
          uid,
          "insert into member_blocks(blocker_id,blocked_id) values($1,$2)",
          [uid, other],
        );
        for (const who of [author, member])
          await expect(reply(who, t)).rejects.toThrow();
        await expect(start()).rejects.toThrow(/reached/);
      },
    );
    it("keeps zero-read privacy and prevents raw shell/status/identity forgery", async () => {
      await ready();
      const t = await start();
      for (const uid of [admin, mod, outsider])
        for (const table of ["threads", "messages", "thread_state"])
          expect(
            (
              await act(
                uid,
                `select * from ${table} where ${table === "threads" ? "id" : "thread_id"}=$1`,
                [t],
              )
            ).rowCount,
          ).toBe(0);
      await expect(
        act(
          member,
          "update threads set request_status='accepted' where id=$1",
          [t],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        act(
          member,
          "insert into messages(thread_id,sender_id,body) values($1,$2,'Forged')",
          [t, author],
        ),
      ).rejects.toThrow();
      await expect(
        act(
          member,
          "select steppe_messaging_private.start_contact($1,$2,null,$3)",
          [author, "Forged", group],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        act(
          null,
          "select start_group_thread($1,'Forged',$2)",
          [author, group],
          db,
          "anon",
        ),
      ).rejects.toThrow(/permission denied/);
      for (const body of ["", " ", "x".repeat(4001)])
        await expect(
          act(member, "select start_group_thread($1,$2,$3)", [
            author,
            body,
            group,
          ]),
        ).rejects.toThrow(/Write/);
    });
    it("also closes pending requests through the existing conversation-menu block path", async () => {
      await ready();
      const t = await start();
      await act(
        author,
        "insert into member_blocks(blocker_id,blocked_id) values($1,$2)",
        [author, member],
      );
      expect(
        (await db.query("select request_status from threads where id=$1", [t]))
          .rows[0].request_status,
      ).toBe("declined");
      await act(author, "delete from member_blocks where blocker_id=$1", [
        author,
      ]);
      await expect(start()).rejects.toThrow(/not available/);
    });
    it("preserves the support exception for pending members and explicitly reuses pending support pairs", async () => {
      await db.query("update profiles set role='admin' where id=$1", [author]);
      await db.query(
        "insert into steppe_contact_settings(singleton,contact_id) values(true,$1) on conflict(singleton) do update set contact_id=excluded.contact_id",
        [author],
      );
      await ready();
      const pending = await start();
      await db.query("update profiles set verified=false where id=$1", [
        member,
      ]);
      const t = (
        await act(member, "select start_support_thread('Synthetic support') id")
      ).rows[0].id;
      expect(t).toBe(pending);
      await reply(member, t);
      await reply(author, t);
      expect(
        (
          await db.query(
            "select request_status,about_group_id,support_contact_id from threads where id=$1",
            [t],
          )
        ).rows[0],
      ).toEqual({
        request_status: "accepted",
        about_group_id: group,
        support_contact_id: author,
      });
    });
    it("serializes duplicate starts to one pending message and one canonical pair", async () => {
      await ready();
      const clients = [
        new pg.Client({ connectionString: target }),
        new pg.Client({ connectionString: target }),
      ];
      await Promise.all(clients.map((c) => c.connect()));
      try {
        const result = await Promise.allSettled(
          clients.map((c) => start(member, author, group, c)),
        );
        expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const t = (
          result.find(
            (r) => r.status === "fulfilled",
          ) as PromiseFulfilledResult<string>
        ).value;
        expect(await messages(t)).toHaveLength(1);
      } finally {
        await Promise.all(clients.map((c) => c.end()));
      }
    });
    it("waits for a concurrent opt-out and then refuses contact", async () => {
      await ready();
      const editor = new pg.Client({ connectionString: target }),
        sender = new pg.Client({ connectionString: target });
      await editor.connect();
      await sender.connect();
      let work: Promise<PromiseSettledResult<string>[]> | undefined;
      try {
        await sender.query("set statement_timeout='5s'");
        const pid = (await sender.query("select pg_backend_pid() pid")).rows[0]
          .pid;
        await editor.query("begin");
        await editor.query(
          "update group_message_preferences set allow_requests=false where group_id=$1 and member_id=$2",
          [group, author],
        );
        work = Promise.allSettled([start(member, author, group, sender)]);
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          waiting =
            (
              await db.query(
                "select wait_event_type from pg_stat_activity where pid=$1",
                [pid],
              )
            ).rows[0]?.wait_event_type === "Lock";
          if (waiting) break;
          await new Promise((r) => setTimeout(r, 25));
        }
        expect(waiting).toBe(true);
        await editor.query("commit");
        expect((await work)[0].status).toBe("rejected");
      } finally {
        await editor.query("rollback");
        if (work) await work;
        await editor.end();
        await sender.end();
      }
    });
    it("enforces the ten-new-pair daily cap across group and post doors", async () => {
      await ready();
      for (let i = 0; i < 10; i++) {
        const to = await person();
        await db.query(
          "insert into group_members(group_id,user_id,status) values($1,$2,'active')",
          [group, to],
        );
        await prefs(to);
        await start(member, to);
      }
      await expect(start()).rejects.toThrow(/try again later/);
      await expect(postStart()).rejects.toThrow(/try again later/);
    });
  },
);
