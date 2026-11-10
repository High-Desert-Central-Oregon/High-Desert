import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { securityDb, target } from "./helpers/security-db";

describe.skipIf(!target)(
  "group privacy through direct database operations",
  () => {
    const { db, act } = securityDb();
    const owner = randomUUID(),
      member = randomUUID(),
      outsider = randomUUID(),
      deleted = randomUUID();
    let group: string, event: string, secondEvent: string;
    beforeAll(async () => {
      await db.connect();
      for (const id of [owner, member, outsider, deleted]) {
        await db.query("insert into auth.users(id,email) values($1,$2)", [
          id,
          `${id}@example.test`,
        ]);
        await db.query("update profiles set verified=true where id=$1", [id]);
      }
      group = (
        await db.query(
          "insert into groups(slug,name,created_by) values($1,'Private fixture',$2) returning id",
          [randomUUID(), owner],
        )
      ).rows[0].id;
      for (const id of [owner, member, deleted])
        await db.query(
          "insert into group_members(group_id,user_id,role) values($1,$2,$3)",
          [group, id, id === member ? "member" : "maintainer"],
        );
      const events = await db.query(
        "insert into events(group_id,creator_id,title,starts_at) values($1,$2,'Private event',now()),($1,$2,'Second event',now()) returning id",
        [group, owner],
      );
      [event, secondEvent] = events.rows.map((r) => r.id);
      await act(owner, "select public.add_member($1,$2)", [group, member]);
      await act(
        member,
        "insert into event_rsvps(event_id,user_id,status) values($1,$2,'going')",
        [event, member],
      );
    });
    afterAll(async () => {
      await db.end();
    });
    it("pins helper grants despite hosted function defaults", async () => {
      const result = await db.query(`select p.proname,
        has_function_privilege('anon',p.oid,'execute') as anon_execute,
        has_function_privilege('authenticated',p.oid,'execute') as member_execute,
        has_function_privilege('service_role',p.oid,'execute') as service_execute
        from pg_proc p where p.oid in (
          'public.can_read_group_audit(text,uuid,jsonb)'::regprocedure,
          'public.can_rsvp_event(uuid)'::regprocedure,
          'public.guard_rsvp_identity()'::regprocedure) order by p.proname`);
      expect(result.rows).toEqual([
        {
          proname: "can_read_group_audit",
          anon_execute: false,
          member_execute: true,
          service_execute: false,
        },
        {
          proname: "can_rsvp_event",
          anon_execute: false,
          member_execute: true,
          service_execute: false,
        },
        {
          proname: "guard_rsvp_identity",
          anon_execute: false,
          member_execute: false,
          service_execute: false,
        },
      ]);
      for (const role of ["anon", "service_role"]) {
        await expect(
          act(null, "select public.can_rsvp_event($1)", [event], role),
        ).rejects.toThrow(/permission denied/);
        await expect(
          act(
            null,
            "select public.can_read_group_audit('event',$1,'{}')",
            [event],
            role,
          ),
        ).rejects.toThrow(/permission denied/);
      }
    });
    it("scopes old audit rows but keeps own history and community governance", async () => {
      expect(
        (
          await act(
            outsider,
            "select * from audit_log where entity='group' and entity_id=$1",
            [group],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await act(
            member,
            "select * from audit_log where entity='group' and entity_id=$1",
            [group],
          )
        ).rows.length,
      ).toBeGreaterThan(0);
      await db.query("select public.log_audit('proposal.test','proposal',$1)", [
        randomUUID(),
      ]);
      expect(
        (
          await act(
            outsider,
            "select * from audit_log where action='proposal.test'",
          )
        ).rows.length,
      ).toBeGreaterThan(0);
      await db.query(
        "delete from group_members where group_id=$1 and user_id=$2",
        [group, owner],
      );
      expect(
        (
          await act(
            owner,
            "select * from audit_log where entity_id=$1 and actor_id=$2",
            [group, owner],
          )
        ).rows.length,
      ).toBeGreaterThan(0);
      await db.query(
        "insert into group_members(group_id,user_id,role) values($1,$2,'maintainer')",
        [group, owner],
      );
    });
    it("scopes post-pinning audit membership even after a post is deleted", async () => {
      const post = (
        await db.query(
          "insert into posts(group_id,author_id,category,title,body) values($1,$2,'offer','Private offer','Fixture') returning id",
          [group, owner],
        )
      ).rows[0].id;
      await act(owner, "select public.set_post_pin($1,true)", [post]);
      expect(
        (
          await act(outsider, "select * from audit_log where entity_id=$1", [
            post,
          ])
        ).rows,
      ).toEqual([]);
      expect(
        (
          await act(member, "select * from audit_log where entity_id=$1", [
            post,
          ])
        ).rows,
      ).toHaveLength(1);
      await db.query("delete from posts where id=$1", [post]);
      expect(
        (
          await act(outsider, "select * from audit_log where entity_id=$1", [
            post,
          ])
        ).rows,
      ).toEqual([]);
      expect(
        (
          await act(member, "select * from audit_log where entity_id=$1", [
            post,
          ])
        ).rows,
      ).toHaveLength(1);
    });
    it("refuses outsider attendance reads/writes and ballot-like RSVP reassignment", async () => {
      expect(
        (
          await act(outsider, "select * from event_rsvps where event_id=$1", [
            event,
          ])
        ).rows,
      ).toEqual([]);
      await expect(
        act(
          outsider,
          "insert into event_rsvps(event_id,user_id,status) values($1,$2,'going')",
          [event, outsider],
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(
        act(
          member,
          "update event_rsvps set event_id=$1 where event_id=$2 and user_id=$3",
          [secondEvent, event, member],
        ),
      ).rejects.toThrow(/immutable/);
      expect(
        (
          await act(
            member,
            "update event_rsvps set bringing='bread' where event_id=$1 and user_id=$2 returning bringing",
            [event, member],
          )
        ).rows[0].bringing,
      ).toBe("bread");
    });
    it("preserves self-owned withdrawal after leaving while denying updates", async () => {
      await act(member, "select public.leave_group($1)", [group]);
      expect(
        (
          await act(
            member,
            "update event_rsvps set bringing='changed' where event_id=$1 returning id",
            [event],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await act(
            member,
            "delete from event_rsvps where event_id=$1 returning id",
            [event],
          )
        ).rowCount,
      ).toBe(1);
      await act(owner, "select public.add_member($1,$2)", [group, member]);
    });
    it("enforces moderation on event bodies and RSVP writes in the database", async () => {
      await db.query(
        "insert into moderation_actions(actor_id,target_type,target_id,action,reason) values($1,'event',$2,'remove','Synthetic removal')",
        [owner, event],
      );
      expect(
        (
          await act(
            member,
            "select title,body,location from events where id=$1",
            [event],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (await act(owner, "select id from events where id=$1", [event])).rows,
      ).toHaveLength(1);
      await expect(
        act(
          member,
          "insert into event_rsvps(event_id,user_id,status) values($1,$2,'going')",
          [event, member],
        ),
      ).rejects.toThrow(/row-level security/);
    });
    it("denies retained-JWT maintainer calls even with a legacy membership row", async () => {
      await db.query("update profiles set deleted_at=now() where id=$1", [
        deleted,
      ]);
      expect(
        (
          await act(deleted, "select public.is_group_maintainer($1) ok", [
            group,
          ])
        ).rows[0].ok,
      ).toBe(false);
      await expect(
        act(deleted, "select public.add_member($1,$2)", [group, outsider]),
      ).rejects.toThrow(/maintainer/);
      await expect(
        act(deleted, "select public.set_member_role($1,$2,'maintainer')", [
          group,
          member,
        ]),
      ).rejects.toThrow(/maintainer/);
    });
    it("keeps archived group history and append-only audit protection", async () => {
      await act(owner, "select public.archive_group($1)", [group]);
      expect(
        (await act(member, "select id from events where id=$1", [secondEvent]))
          .rows,
      ).toHaveLength(1);
      await expect(
        db.query("delete from audit_log where entity_id=$1", [group]),
      ).rejects.toThrow();
    });
  },
);
