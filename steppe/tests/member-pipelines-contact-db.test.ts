import pg from "pg";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
const target = process.env.CONTACT_STEPPE_TEST_DB_URL;
if (target) {
  const u = new URL(target);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) || u.pathname !== "/steppe_pipelines_test")
    throw new Error("Only isolated loopback steppe_pipelines_test is permitted");
}
describe.skipIf(!target)("Contact Steppe database boundaries", () => {
  const db = new pg.Client({ connectionString: target });
  let admin: string, member: string, outsider: string, mod: string;
  async function act(uid: string | null, sql: string, args: unknown[] = [], client = db, role = "authenticated") {
    await client.query("begin");
    try {
      await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(uid ? { sub: uid } : {})]);
      await client.query(`set local role ${role}`);
      const r = await client.query(sql, args); await client.query("commit"); return r;
    } catch (e) { await client.query("rollback"); throw e; }
  }
  async function start(uid = member) {
    return (await act(uid, "select public.start_support_thread('Synthetic support question') id")).rows[0].id as string;
  }
  async function reply(uid: string, thread: string) {
    return act(uid, "insert into public.messages(thread_id,sender_id,body) values($1,$2,'Synthetic reply')", [thread, uid]);
  }
  beforeAll(async () => { await db.connect(); });
  beforeEach(async () => {
    admin = randomUUID(); member = randomUUID(); outsider = randomUUID(); mod = randomUUID();
    for (const id of [admin, member, outsider, mod])
      await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [id, `${id}@example.test`]);
    await db.query("update public.profiles set verified=true,role='admin',display_name='Synthetic support contact' where id=$1", [admin]);
    await db.query("update public.profiles set verified=true,role='admin' where id=$1", [outsider]);
    await db.query("update public.profiles set verified=true,role='moderator' where id=$1", [mod]);
    await db.query("update public.profiles set display_name='Synthetic applicant' where id=$1", [member]);
    await db.query("insert into public.steppe_contact_settings(singleton,contact_id) values(true,$1) on conflict(singleton) do update set contact_id=excluded.contact_id", [admin]);
  });
  afterAll(async () => { await db.end(); });
  it("allows pending members to start, receive an admin reply, and reuse one conversation", async () => {
    const id = await start();
    expect(await start()).toBe(id); await reply(admin, id); await reply(member, id);
    expect((await act(member, "select public.can_send($1) ok", [id])).rows[0].ok).toBe(true);
    expect((await act(member, "select * from public.steppe_contact_status()")).rows[0]).toMatchObject({ thread_id: id, contact_name: "Synthetic support contact", is_contact: false });
    expect((await act(admin, "select * from public.my_support_threads()")).rows).toContainEqual({ thread_id: id, contact_id: admin, counterpart_name: "Synthetic applicant" });
    expect((await act(member, "select * from public.messages where thread_id=$1", [id])).rowCount).toBe(4);
    expect((await db.query("select verified from public.profiles where id=$1", [member])).rows[0].verified).toBe(false);
  });
  it("does not grant general messaging, routing writes, sender forgery or support promotion", async () => {
    const id = await start();
    await expect(act(member, "select public.start_thread($1,'Hi',null)", [outsider])).rejects.toThrow(/verified/);
    await expect(act(member, "update public.threads set support_contact_id=$1 where id=$2", [outsider, id])).rejects.toThrow(/permission denied/);
    await expect(act(member, "update public.steppe_contact_settings set contact_id=$1", [outsider])).rejects.toThrow(/permission denied/);
    await expect(act(member, "insert into public.messages(thread_id,sender_id,body) values($1,$2,'Forged')", [id, admin])).rejects.toThrow();
    await expect(act(member, "select public.start_support_thread('')")).rejects.toThrow(/Write/);
    await expect(act(member, "select public.start_support_thread($1)", ["x".repeat(4001)])).rejects.toThrow(/Write/);
  });
  it("keeps conversations private from nonparticipants, including admins, moderators and support operators", async () => {
    const id = await start();
    await db.query("insert into public.support_operators(user_id) values($1)", [outsider]);
    for (const uid of [outsider, mod]) {
      expect((await act(uid, "select * from public.messages where thread_id=$1", [id])).rowCount).toBe(0);
      expect((await act(uid, "select * from public.threads where id=$1", [id])).rowCount).toBe(0);
      expect((await act(uid, "select * from public.my_support_threads() where thread_id=$1", [id])).rowCount).toBe(0);
      await expect(reply(uid, id)).rejects.toThrow();
    }
    await expect(act(null, "select public.start_support_thread('Hi')", [], db, "anon")).rejects.toThrow(/permission denied/);
    await expect(act(member, "select * from public.steppe_contact_settings")).rejects.toThrow(/permission denied/);
  });
  it("preserves block/report safety for pending members only on their own support context", async () => {
    const id = await start();
    await act(member, "insert into public.reports(reporter_id,target_type,target_id,body,quoted_excerpt) values($1,'message_thread',$2,'Synthetic report','Synthetic excerpt')", [member, id]);
    await expect(act(member, "insert into public.reports(reporter_id,target_type,target_id,body) values($1,'message_thread',$2,'Synthetic report')", [member, randomUUID()])).rejects.toThrow();
    await expect(act(member, "insert into public.member_blocks(blocker_id,blocked_id) values($1,$2)", [member, outsider])).rejects.toThrow();
    await act(member, "insert into public.member_blocks(blocker_id,blocked_id) values($1,$2)", [member, admin]);
    for (const uid of [member, admin]) await expect(reply(uid, id)).rejects.toThrow();
    await expect(start()).rejects.toThrow(/unavailable/);
    await act(member, "delete from public.member_blocks where blocker_id=$1", [member]);
    await reply(member, id);
  });
  it("fails closed when the designated contact is unavailable or the requester was removed", async () => {
    const id = await start();
    await db.query("update public.profiles set role='member' where id=$1", [admin]);
    expect((await act(member, "select * from public.steppe_contact_status()")).rowCount).toBe(0);
    await expect(start()).rejects.toThrow(/unavailable/); await expect(reply(member, id)).rejects.toThrow();
    await db.query("update public.profiles set role='admin' where id=$1", [admin]);
    await db.query("update public.profiles set deleted_at=now() where id=$1", [member]);
    await expect(start()).rejects.toThrow(/unavailable/); await expect(reply(member, id)).rejects.toThrow();
    await expect(act(member, "insert into public.member_blocks(blocker_id,blocked_id) values($1,$2)", [member, admin])).rejects.toThrow();
    await expect(act(member, "insert into public.reports(reporter_id,target_type,target_id,body) values($1,'message_thread',$2,'Synthetic report')", [member, id])).rejects.toThrow();
  });
  it("does not give a replacement support contact access to prior conversations", async () => {
    const id = await start();
    await db.query("update public.steppe_contact_settings set contact_id=$1", [outsider]);
    expect((await act(outsider, "select * from public.messages where thread_id=$1", [id])).rowCount).toBe(0);
    await expect(reply(admin, id)).rejects.toThrow(); await expect(reply(member, id)).rejects.toThrow();
    expect(await start()).not.toBe(id);
  });
  it("enforces the requester cap on direct reply inserts as well as the start RPC", async () => {
    const id = await start();
    for (let i = 1; i < 20; i++) await reply(member, id);
    await expect(reply(member, id)).rejects.toThrow(/later/);
    await expect(start()).rejects.toThrow(/later/);
    for (let i = 0; i < 21; i++) await reply(admin, id);
    expect((await db.query("select count(*)::int n from public.messages where sender_id=$1", [member])).rows[0].n).toBe(20);
  });
  it("serializes simultaneous final-quota sends", async () => {
    const id = await start(); for (let i = 1; i < 19; i++) await reply(member, id);
    const send = async () => {
      const c = new pg.Client({ connectionString: target }); await c.connect();
      try { return await act(member, "select public.start_support_thread('Concurrent synthetic question')", [], c); }
      finally { await c.end(); }
    };
    const results = await Promise.allSettled([send(), send()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.query("select count(*)::int n from public.messages where sender_id=$1", [member])).rows[0].n).toBe(20);
  });
  it("retains ordinary verified post messaging without opening cold DMs", async () => {
    const group = (await db.query("select id from public.groups where is_system=true limit 1")).rows[0].id;
    const post = (await db.query("insert into public.posts(author_id,group_id,category,title,body,allow_messages) values($1,$2,'offer','Synthetic post','Synthetic body',true) returning id", [admin, group])).rows[0].id;
    const id = (await act(outsider, "select public.start_thread($1,'Synthetic post message',$2) id", [admin, post])).rows[0].id;
    if ((await db.query("select to_regprocedure('public.respond_message_request(uuid,text)') present")).rows[0].present)
      await act(admin,"select public.respond_message_request($1,'accept')",[id]);
    await reply(admin, id);
    await expect(act(outsider, "select public.start_thread($1,'Cold message',null)", [mod])).rejects.toThrow(/post/);
    expect(await start(outsider)).toBe(id);
    expect((await db.query("select about_post_id from public.threads where id=$1", [id])).rows[0].about_post_id).toBe(post);
  });
  it("includes support messages in the existing account-deletion behavior", async () => {
    const id = await start(); await reply(admin, id);
    await act(member, "select public.delete_my_account()");
    expect((await db.query("select count(*)::int n from public.messages where sender_id=$1", [member])).rows[0].n).toBe(0);
    expect((await db.query("select count(*)::int n from public.messages where thread_id=$1 and sender_id=$2", [id, admin])).rows[0].n).toBe(1);
  });
});
