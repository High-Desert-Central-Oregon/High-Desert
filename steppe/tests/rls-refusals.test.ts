import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const { Client } = pg;

// Automated port of the dry-run runbook's CORE REFUSALS (docs/dry-run-runbook.md §C/§D).
// These prove the database REFUSES what the invariants forbid — the "assume the client is
// hostile" guarantees. Unlike the anon-key suite (rls-smoke), these need the runbook's
// impersonation pattern (set request.jwt.claims + `set local role authenticated`), which
// only a direct OWNER Postgres connection can do. So this suite:
//   • connects as the local superuser (postgres) and impersonates members per-transaction;
//   • is self-contained — it builds its own minimal fixtures (auth user + profile, event,
//     verification, proposal, vote) inside a transaction that always ROLLS BACK, so it needs
//     no seed and persists nothing;
//   • skips cleanly when no local Postgres is reachable (e.g. CI without a DB), so it never
//     turns CI red. Point it elsewhere with SUPABASE_DB_URL.
// Structural refusals are data-independent (grant/guard level); fixture-backed ones exercise
// the row-level policies (own-only, creator-only, secret ballot).
const DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function reachable(): Promise<boolean> {
  const c = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    await c.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await c.end();
    } catch {
      /* ignore */
    }
  }
}

// Top-level await runs at collection time — decides skip vs run before the suite is defined.
const dbUp = await reachable();

// Impersonate a member: auth.uid() returns this sub and RLS is enforced (owner bypasses it).
const CLAIMS =
  "select set_config('request.jwt.claims', json_build_object('sub',$1::text,'role','authenticated')::text, true)";
// A sub with no profile row — is_moderator()/is_verified() are false for it.
const RANDO = "99999999-9999-9999-9999-999999999999";

describe.skipIf(!dbUp)("RLS core refusals (impersonated, owner connection)", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL });
    await client.connect();
  });
  afterAll(async () => {
    await client?.end();
  });

  // Run ONE statement as a member, always rolling back. Re-throws the DB error so a
  // refusal can be asserted with .rejects.toThrow(...).
  async function runAs(sub: string, sql: string, params: unknown[] = []) {
    await client.query("begin");
    try {
      await client.query(CLAIMS, [sub]);
      await client.query("set local role authenticated");
      const res = await client.query(sql, params);
      await client.query("rollback");
      return res;
    } catch (e) {
      try {
        await client.query("rollback");
      } catch {
        /* already aborted */
      }
      throw e;
    }
  }

  // Owner-context fixture builder + assertion, always rolled back.
  async function inTxn(fn: (c: pg.Client) => Promise<void>) {
    await client.query("begin");
    try {
      await fn(client);
    } finally {
      try {
        await client.query("rollback");
      } catch {
        /* ignore */
      }
    }
  }

  // Create an auth user (the on_auth_user_created trigger makes the profile), then set trust
  // via the sanctioned owner path (the self-edit guard doesn't freeze when auth.uid() is null).
  async function createMember(
    c: pg.Client,
    id: string,
    email: string,
    opts: { verified?: boolean; role?: string; tenure?: string | null } = {},
  ) {
    await c.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2::text,
         crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('display_name', $2::text), now(), now(), '', '', '', '')`,
      [id, email],
    );
    await c.query(
      `update profiles set verified=$2, role=$3::member_role, tenure_start=$4::date where id=$1`,
      [id, opts.verified ?? false, opts.role ?? "member", opts.tenure ?? null],
    );
  }

  // ---- Structural refusals (data-independent: grant / function-guard level) ----

  it("G2: authenticated cannot EXECUTE log_audit (no forged audit entries)", async () => {
    await expect(
      runAs(RANDO, "select public.log_audit('moderation.remove','event', gen_random_uuid(), '{}'::jsonb)"),
    ).rejects.toThrow(/permission denied for function log_audit/);
  });

  it("G2: authenticated cannot EXECUTE vote_weight_for (no weight leak)", async () => {
    await expect(runAs(RANDO, "select public.vote_weight_for($1)", [RANDO])).rejects.toThrow(
      /permission denied for function vote_weight_for/,
    );
  });

  it("D-forge: authenticated cannot INSERT into group_members (writes are RPC-only)", async () => {
    await expect(
      runAs(
        RANDO,
        "insert into group_members (group_id,user_id,role,status) values (gen_random_uuid(), $1, 'maintainer','active')",
        [RANDO],
      ),
    ).rejects.toThrow(/permission denied for table group_members/);
  });

  it("G3: a non-moderator cannot decide a verification", async () => {
    await expect(runAs(RANDO, "select public.decide_verification(gen_random_uuid(), true)")).rejects.toThrow(
      /only moderators may decide verifications/,
    );
  });

  // ---- Fixture-backed refusals (row-level policies; RLS silently filters, so assert 0 rows) ----

  it("G3: a member cannot UPDATE their own verification to approved (no update policy)", async () => {
    await inTxn(async (c) => {
      const uid = "a1a10000-0000-0000-0000-000000000001";
      const vid = "0d0a0000-0000-0000-0000-000000000001";
      await createMember(c, uid, "selfverify@rls.test");
      await c.query(
        "insert into verifications (id,user_id,method,evidence_path) values ($1,$2,'utility_bill','x/y.jpg')",
        [vid, uid],
      );
      await c.query(CLAIMS, [uid]);
      await c.query("set local role authenticated");
      const res = await c.query("update verifications set status='approved' where id=$1", [vid]);
      expect(res.rowCount).toBe(0); // RLS permits no row — the half-state path is closed
    });
  });

  it("G4: a moderator cannot hard-delete another member's event (creator-only)", async () => {
    await inTxn(async (c) => {
      const creator = "cc010000-0000-0000-0000-000000000001";
      const mod = "cc020000-0000-0000-0000-000000000001";
      const eid = "0ecc0000-0000-0000-0000-000000000001";
      await createMember(c, creator, "creator@rls.test", { verified: true });
      await createMember(c, mod, "mod@rls.test", { verified: true, role: "moderator" });
      await c.query(
        `insert into events (id, creator_id, neighborhood_id, title, body, starts_at, location)
         values ($1,$2,(select id from neighborhoods limit 1),'probe','body', now()+interval '1 day','loc')`,
        [eid, creator],
      );
      await c.query(CLAIMS, [mod]);
      await c.query("set local role authenticated");
      const res = await c.query("delete from events where id=$1", [eid]);
      expect(res.rowCount).toBe(0); // a moderator's only takedown is the legible, appealable remove
    });
  });

  it("invariant 4: a member cannot read another member's ballot (secret ballot)", async () => {
    await inTxn(async (c) => {
      const a = "d1d10000-0000-0000-0000-000000000001";
      const b = "d2d20000-0000-0000-0000-000000000001";
      const pid = "0b0d0000-0000-0000-0000-000000000001";
      await createMember(c, a, "voter-a@rls.test", { verified: true, tenure: "2020-01-01" });
      await createMember(c, b, "voter-b@rls.test", { verified: true, tenure: "2020-01-01" });
      await c.query(
        `insert into proposals (id, author_id, title, kind, opens_at, closes_at)
         values ($1,$2,'secret ballot probe','minor', now()-interval '1 minute', now()+interval '1 hour')`,
        [pid, a],
      );
      await c.query("set local role authenticated");
      // A casts a ballot; the trigger stamps user_id/weight from auth.uid().
      await c.query(CLAIMS, [a]);
      await c.query("insert into votes (proposal_id, choice) values ($1,'yes')", [pid]);
      // B can see neither a tally nor A's row.
      await c.query(CLAIMS, [b]);
      const visible = await c.query("select count(*)::int as n from votes");
      const aRows = await c.query("select count(*)::int as n from votes where user_id=$1", [a]);
      expect(visible.rows[0].n).toBe(0); // B has cast none
      expect(aRows.rows[0].n).toBe(0); // and cannot read A's ballot
    });
  });
});
