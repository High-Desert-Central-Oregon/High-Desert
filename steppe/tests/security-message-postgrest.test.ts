import { randomUUID, createHmac } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { securityDb, target } from "./helpers/security-db";
const m = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => m.client,
}));
import { getInboxSubstrate, getUnreadState } from "@/lib/messages";
const endpoint = process.env.SECURITY_POSTGREST_URL;
if (endpoint && endpoint !== "http://127.0.0.1:55440")
  throw new Error("Disposable local PostgREST only");
function session(uid: string) {
  const enc = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: uid, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  const token = `${unsigned}.${createHmac("sha256", "steppe-disposable-security-test-secret-2026").update(unsigned).digest("base64url")}`;
  return createClient(endpoint!, "test-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) =>
        fetch(String(input).replace("/rest/v1/", "/"), init),
    },
  });
}
describe.skipIf(!target || !endpoint)(
  "real PostgREST message embeddings and per-thread bounds",
  () => {
    const { db } = securityDb();
    const viewer = randomUUID(),
      moderator = randomUUID();
    let quiet: string;
    beforeAll(async () => {
      await db.connect();
      for (const id of [viewer, moderator])
        await db.query("insert into auth.users(id,email) values($1,$2)", [
          id,
          `${id}@example.test`,
        ]);
      await db.query(
        "update profiles set verified=true,role=case when id=$1 then 'moderator'::member_role else 'member'::member_role end where id in ($1,$2)",
        [moderator, viewer],
      );
      for (let i = 0; i < 201; i++) {
        await db.query("select set_config('request.jwt.claims','',false)");
        const other = randomUUID();
        await db.query("insert into auth.users(id,email) values($1,$2)", [
          other,
          `${other}@example.test`,
        ]);
        await db.query("update profiles set verified=true where id=$1", [
          other,
        ]);
        const tid = (
          await db.query(
            "insert into threads(member_a,member_b,started_by) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),$1) returning id",
            [viewer, other],
          )
        ).rows[0].id;
        await db.query(
          "insert into thread_state(thread_id,member_id,last_read_at) values($1,$2,now()-interval '2 days')",
          [tid, viewer],
        );
        await db.query("select set_config('request.jwt.claims',$1,false)", [
          JSON.stringify({ sub: other, role: "authenticated" }),
        ]);
        await db.query(
          "insert into messages(thread_id,sender_id,body,created_at) values($1,$2,'quiet incoming',now()-interval '1 day')",
          [tid, other],
        );
        if (i === 0) {
          quiet = tid;
          await db.query("select set_config('request.jwt.claims',$1,false)", [
            JSON.stringify({ sub: viewer, role: "authenticated" }),
          ]);
          await db.query(
            "insert into messages(thread_id,sender_id,body,created_at) values($1,$2,'my later reply',now())",
            [tid, viewer],
          );
        }
        if (i === 1)
          await db.query(
            "insert into messages(thread_id,sender_id,body) select $1,$2,'busy '||n from generate_series(1,401) n",
            [tid, other],
          );
      }
    });
    afterAll(async () => {
      await db.end();
    });
    it("paginates all threads and preserves a quiet incoming message after a self-send", async () => {
      m.client = session(viewer);
      const inbox = await getInboxSubstrate(viewer);
      expect(inbox.threads).toHaveLength(201);
      expect(inbox.states).toHaveLength(201);
      expect(inbox.messages).toHaveLength(201);
      expect(inbox.incomingMessages).toHaveLength(201);
      expect(inbox.messages.find((row) => row.thread_id === quiet)?.body).toBe(
        "my later reply",
      );
      expect(
        inbox.incomingMessages.find((row) => row.thread_id === quiet)?.body,
      ).toBe("quiet incoming");
      expect(await getUnreadState(viewer)).toBe(true);
    });
    it("keeps the moderator zero-read boundary through both embeds", async () => {
      m.client = session(moderator);
      expect(await getInboxSubstrate(moderator)).toEqual({
        threads: [],
        states: [],
        messages: [],
        incomingMessages: [],
      });
    });
  },
);
