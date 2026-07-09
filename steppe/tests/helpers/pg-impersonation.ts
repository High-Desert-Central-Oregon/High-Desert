import pg from "pg";

const { Client } = pg;

// Shared harness for DB-level tests that need the dry-run runbook's impersonation
// pattern (docs/dry-run-runbook.md): a direct OWNER Postgres connection that becomes
// a member via `request.jwt.claims` + `set local role authenticated`, so RLS applies.
// Used by tests/rls-refusals.test.ts (negative paths) and, when built out,
// tests/walkthrough-positive.test.ts (positive paths). Everything runs in rolled-back
// transactions and builds its own fixtures, so no seed is required and nothing persists.

export const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// A sub with no profile row — is_moderator()/is_verified() are false for it.
export const RANDO = "99999999-9999-9999-9999-999999999999";

const CLAIMS =
  "select set_config('request.jwt.claims', json_build_object('sub',$1::text,'role','authenticated')::text, true)";

/** True iff a Postgres is reachable at DB_URL (used to skip cleanly in CI / no-DB). */
export async function dbReachable(): Promise<boolean> {
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

/** A fresh (unconnected) owner client. Connect it in beforeAll, end it in afterAll. */
export function makeClient(): pg.Client {
  return new Client({ connectionString: DB_URL });
}

/** Bind a connected owner client and return the impersonation helpers. */
export function impersonate(client: pg.Client) {
  /** Run ONE statement as a member, always rolled back; re-throws DB errors so a
   *  refusal can be asserted with `.rejects.toThrow(...)`. */
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

  /** Open a transaction for owner-context fixtures + impersonated assertions; always
   *  rolled back. The callback receives the same bound client. */
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

  /** Become `sub` inside an already-open transaction (create fixtures as owner FIRST,
   *  then call this). Safe to call repeatedly to switch the acting member. */
  async function actAs(sub: string) {
    await client.query(CLAIMS, [sub]);
    await client.query("set local role authenticated");
  }

  /** Create an auth user (the on_auth_user_created trigger makes the profile), then set
   *  trust via the sanctioned owner path (the self-edit guard doesn't freeze when
   *  auth.uid() is null). Call inside an open inTxn transaction. */
  async function createMember(
    id: string,
    email: string,
    opts: { verified?: boolean; role?: string; tenure?: string | null } = {},
  ) {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2::text,
         crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('display_name', $2::text), now(), now(), '', '', '', '')`,
      [id, email],
    );
    await client.query(
      `update profiles set verified=$2, role=$3::member_role, tenure_start=$4::date where id=$1`,
      [id, opts.verified ?? false, opts.role ?? "member", opts.tenure ?? null],
    );
  }

  return { runAs, inTxn, actAs, createMember };
}
