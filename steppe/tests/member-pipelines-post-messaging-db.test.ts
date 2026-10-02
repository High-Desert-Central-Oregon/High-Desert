import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";

// Synthetic records in a disposable local fixture only. Never hosted Supabase.
const target = process.env.POST_MESSAGING_TEST_DB_URL;
if (target) {
  const url = new URL(target);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.pathname !== "/steppe_pipelines_test")
    throw new Error("Only isolated loopback steppe_pipelines_test is permitted");
}

describe.skipIf(!target)("Post messaging consent database boundaries", () => {
  const db = new pg.Client({ connectionString: target });
  let owner: string, member: string, admin: string, moderator: string;
  let group: string, post: string;
  async function act(uid: string | null, sql: string, args: unknown[] = [], client = db, role = "authenticated") {
    await client.query("begin");
    try {
      await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(uid ? { sub: uid } : {})]);
      await client.query(`set local role ${role}`);
      const result = await client.query(sql, args);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
  async function consent(allowed: boolean) {
    return act(owner, "update public.posts set allow_messages=$1 where id=$2 returning allow_messages,edited_at", [allowed, post]);
  }
  async function start(uid = member, about: string | null = post, withId = owner, client = db) {
    return (await act(uid, "select public.start_thread($1,'Synthetic post question',$2) id", [withId, about], client)).rows[0].id as string;
  }
  async function reply(uid: string, thread: string) {
    return act(uid, "insert into public.messages(thread_id,sender_id,body) values($1,$2,'Synthetic reply')", [thread, uid]);
  }
  beforeAll(async () => { await db.connect(); });
  beforeEach(async () => {
    owner = randomUUID(); member = randomUUID(); admin = randomUUID(); moderator = randomUUID();
    for (const id of [owner, member, admin, moderator]) {
      await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [id, `${id}@example.test`]);
      await db.query("update public.profiles set verified=true where id=$1", [id]);
    }
    await db.query("update public.profiles set role='admin' where id=$1", [admin]);
    await db.query("update public.profiles set role='moderator' where id=$1", [moderator]);
    group = (await db.query("select id from public.groups where slug='everyone' and is_system")).rows[0].id;
    // Omit the new column just as an older client would.
    post = (await act(owner, "insert into public.posts(author_id,group_id,category,title,body) values($1,$2,'offer','Synthetic tools','Synthetic body') returning id", [owner, group])).rows[0].id;
  });
  afterAll(async () => { await db.end(); });

  it("defaults off for older clients and persists only the author's edit", async () => {
    expect((await act(owner, "select allow_messages,edited_at from public.posts where id=$1", [post])).rows[0])
      .toEqual({ allow_messages: false, edited_at: null });
    await expect(start()).rejects.toThrow("This post is not available for messaging");
    const changed = (await consent(true)).rows[0];
    expect(changed.allow_messages).toBe(true);
    expect(changed.edited_at).toBeInstanceOf(Date);
    expect((await consent(true)).rows[0].edited_at).toEqual(changed.edited_at);
    expect((await act(owner, "select allow_messages from public.posts where id=$1", [post])).rows[0].allow_messages).toBe(true);
  });
  it("does not let other members, admins or moderators opt an author in", async () => {
    for (const uid of [member, admin, moderator]) {
      expect((await act(uid, "update public.posts set allow_messages=true where id=$1 returning id", [post])).rowCount).toBe(0);
      await expect(start(uid)).rejects.toThrow("This post is not available for messaging");
    }
    await expect(act(owner, "update public.posts set author_id=$1 where id=$2", [member, post])).rejects.toThrow(/permission denied/);
    await expect(act(owner, "update public.posts set edited_at=now() where id=$1", [post])).rejects.toThrow(/permission denied/);
    await expect(act(member, "insert into public.posts(author_id,group_id,category,title,body,allow_messages) values($1,$2,'offer','Forged','Forged',true)", [owner, group])).rejects.toThrow();
  });
  it("allows verified members, admins and moderators to contact an opted-in author as participants", async () => {
    await consent(true);
    for (const uid of [member, admin, moderator]) {
      const id = await start(uid);
      await reply(owner, id);
      expect((await act(uid, "select * from public.messages where thread_id=$1", [id])).rowCount).toBe(2);
    }
    const id = await start(member);
    for (const uid of [admin, moderator]) {
      expect((await act(uid, "select * from public.messages where thread_id=$1", [id])).rowCount).toBe(0);
      await expect(reply(uid, id)).rejects.toThrow();
    }
  });
  it("checks opt-in again for existing pairs and preserves replies, history and the first anchor", async () => {
    await consent(true);
    const id = await start();
    await consent(false);
    await expect(start()).rejects.toThrow("This post is not available for messaging");
    await reply(member, id); await reply(owner, id);
    expect((await act(member, "select * from public.messages where thread_id=$1", [id])).rowCount).toBe(3);
    await consent(true);
    expect(await start()).toBe(id);
    expect((await db.query("select about_post_id from public.threads where id=$1", [id])).rows[0].about_post_id).toBe(post);
  });
  it("uses the same refusal for opted-out, absent, hidden, wrong-author and cold contact", async () => {
    await expect(start()).rejects.toThrow("This post is not available for messaging");
    await consent(true);
    await expect(start(member, randomUUID())).rejects.toThrow("This post is not available for messaging");
    await expect(start(member, post, admin)).rejects.toThrow("This post is not available for messaging");
    await expect(start(member, null)).rejects.toThrow("This post is not available for messaging");
    await act(moderator, "insert into public.moderation_actions(target_type,target_id,actor_id,action,reason) values('post',$1,$2,'remove','Synthetic moderation check')", [post, moderator]);
    for (const uid of [member, admin, moderator])
      await expect(start(uid)).rejects.toThrow("This post is not available for messaging");
  });
  it("requires active group membership for members, admins and moderators", async () => {
    const privateGroup = (await db.query("insert into public.groups(slug,name,visibility,join_policy,created_by) values($1,'Synthetic private board','members_only','request',$2) returning id", [`synthetic-${randomUUID()}`, owner])).rows[0].id;
    await db.query("insert into public.group_members(group_id,user_id,role,status) values($1,$2,'maintainer','active'),($1,$3,'member','pending')", [privateGroup, owner, member]);
    post = (await act(owner, "insert into public.posts(author_id,group_id,category,title,body,allow_messages) values($1,$2,'offer','Synthetic board post','Synthetic body',true) returning id", [owner, privateGroup])).rows[0].id;
    for (const uid of [member, admin, moderator])
      await expect(start(uid)).rejects.toThrow("This post is not available for messaging");
    await db.query("update public.group_members set status='active' where group_id=$1 and user_id=$2", [privateGroup, member]);
    const id = await start();
    await db.query("update public.group_members set status='pending' where group_id=$1 and user_id=$2", [privateGroup, member]);
    await expect(start()).rejects.toThrow("This post is not available for messaging");
    await reply(member, id); // Existing conversations remain independent of the board.
  });
  it.each(["member", "owner"])("retains bidirectional blocking when %s blocks", async (side) => {
    await consent(true);
    const id = await start();
    const blocker = side === "member" ? member : owner;
    const blocked = side === "member" ? owner : member;
    await act(blocker, "insert into public.member_blocks(blocker_id,blocked_id) values($1,$2)", [blocker, blocked]);
    await expect(start()).rejects.toThrow(/can't be reached/);
    for (const uid of [owner, member]) await expect(reply(uid, id)).rejects.toThrow();
    await act(blocker, "delete from public.member_blocks where blocker_id=$1 and blocked_id=$2", [blocker, blocked]);
    expect(await start()).toBe(id);
  });
  it.each(["unverified", "removed"])("refuses %s senders and receivers", async (state) => {
    await consent(true);
    const sql = state === "unverified"
      ? "update public.profiles set verified=false where id=$1"
      : "update public.profiles set deleted_at=now() where id=$1";
    await db.query(sql, [member]);
    await expect(start()).rejects.toThrow(/Only verified/);
    await db.query(sql, [owner]);
    await expect(start(admin)).rejects.toThrow(/can't be reached/);
  });
  it("rejects anonymous RPC calls, raw thread creation, sender forgery and invalid bodies", async () => {
    await consent(true);
    await expect(act(null, "select public.start_thread($1,'Synthetic',$2)", [owner, post], db, "anon")).rejects.toThrow(/permission denied/);
    await expect(act(member, "insert into public.threads(member_a,member_b,started_by,about_post_id) values($1,$2,$1,$3)", [member, owner, post])).rejects.toThrow(/permission denied/);
    await expect(start(owner)).rejects.toThrow(/yourself/);
    for (const body of ["", " ", "x".repeat(4001)])
      await expect(act(member, "select public.start_thread($1,$2,$3)", [owner, body, post])).rejects.toThrow(/Write/);
    const id = await start();
    await expect(act(member, "insert into public.messages(thread_id,sender_id,body) values($1,$2,'Forged')", [id, owner])).rejects.toThrow();
  });
  it("keeps existing conversations readable and replyable after the author deletes the post", async () => {
    await consent(true);
    const id = await start();
    await act(owner, "delete from public.posts where id=$1", [post]);
    await expect(start()).rejects.toThrow("This post is not available for messaging");
    await reply(member, id); await reply(owner, id);
    expect((await act(member, "select about_post_id from public.threads where id=$1", [id])).rows[0].about_post_id).toBeNull();
    expect((await act(owner, "select * from public.messages where thread_id=$1", [id])).rowCount).toBe(3);
  });
  it("retains multi-tag edits and does not reset consent on a migration retry", async () => {
    await consent(true);
    await act(owner, "update public.posts set category='need',tags=array['need','goods'] where id=$1", [post]);
    await db.query(readFileSync(new URL("../../migrations/0043_post_messaging_opt_in.sql", import.meta.url), "utf8"));
    expect((await act(owner, "select category,tags,allow_messages from public.posts where id=$1", [post])).rows[0])
      .toMatchObject({ category: "need", tags: ["need", "goods"], allow_messages: true });
    await act(owner, "update public.posts set category='offer' where id=$1", [post]);
    expect((await act(owner, "select tags,allow_messages from public.posts where id=$1", [post])).rows[0])
      .toEqual({ tags: ["offer"], allow_messages: true });
  });
  it("waits for a concurrent opt-out and refuses the send after that opt-out commits", async () => {
    await consent(true);
    const editor = new pg.Client({ connectionString: target });
    const sender = new pg.Client({ connectionString: target });
    await editor.connect(); await sender.connect();
    let sending: Promise<PromiseSettledResult<string>[]> | undefined;
    try {
      await sender.query("set statement_timeout='5s'");
      const pid = (await sender.query("select pg_backend_pid() pid")).rows[0].pid;
      await editor.query("begin");
      await editor.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner })]);
      await editor.query("set local role authenticated");
      await editor.query("update public.posts set allow_messages=false where id=$1", [post]);
      sending = Promise.allSettled([start(member, post, owner, sender)]);
      let waiting = false;
      const until = Date.now() + 3000;
      while (Date.now() < until) {
        waiting = (await db.query("select wait_event_type from pg_stat_activity where pid=$1", [pid])).rows[0]?.wait_event_type === "Lock";
        if (waiting) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(waiting).toBe(true);
      await editor.query("commit");
      const [result] = await sending;
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") expect(result.reason.message).toBe("This post is not available for messaging");
      expect((await db.query("select count(*)::int n from public.messages where sender_id=$1", [member])).rows[0].n).toBe(0);
    } finally {
      await editor.query("rollback");
      if (sending) await sending;
      await editor.end(); await sender.end();
    }
  });
});
