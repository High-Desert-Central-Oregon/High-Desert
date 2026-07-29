import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dbReachable, makeClient, impersonate, RANDO, DB_URL } from "./helpers/pg-impersonation";

/**
 * Migration 0027 — bearer invite tokens.
 *
 * The property under test is not "tokens work". It is that adding a write path
 * to the signup allowlist did not weaken the gate that allowlist exists to feed.
 * So the suite is built around four claims, in descending order of how much
 * damage a regression would do:
 *
 *   1. An email that never passed through a token still cannot create an
 *      account. This is the regression that matters; everything else is
 *      features. Proven against a REAL `session_user = 'supabase_auth_admin'`
 *      connection, because enforce_invited_signup() keys on session_user and
 *      `SET LOCAL ROLE` does not change it — the gate cannot be exercised from
 *      the owner connection at all.
 *   2. enforce_invited_signup() is byte-identical to its pre-build state.
 *   3. Two simultaneous redemptions of a one-use token yield exactly one
 *      success. Demonstrated by first showing the check-then-act pattern losing
 *      the update, so the assertion is measuring something real.
 *   4. Redemption is idempotent per address, and expired / exhausted / revoked
 *      tokens admit nobody.
 *
 * The concurrency test needs real commits on two connections, so it cannot use
 * the rolled-back-transaction harness. It cleans up after itself instead; every
 * row it creates carries the TAG prefix below.
 */

const BASELINE_SHA =
  "8f2f632e92d2eab9900fd11b9a0bd9156c2f867bedff33d211f322086366532e";

/** Everything this suite writes is prefixed so cleanup is exact. */
const TAG = "zz-invite-test";

const dbUp = await dbReachable();

/** A connection whose LOGIN role is the auth service — the only way to make the
 *  gate fire. Local stack only; absent in CI, where the suite skips. */
function authAdminClient(): pg.Client {
  const url = new URL(DB_URL);
  url.username = "supabase_auth_admin";
  return new pg.Client({ connectionString: url.toString() });
}

async function authAdminReachable(): Promise<boolean> {
  const c = authAdminClient();
  try {
    await c.connect();
    const { rows } = await c.query("select session_user as u");
    return rows[0].u === "supabase_auth_admin";
  } catch {
    return false;
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}

const authAdminUp = dbUp ? await authAdminReachable() : false;

/** Insert an auth.users row the way GoTrue does. Caller supplies the client so
 *  the login role — and therefore whether the gate fires — is explicit. */
const INSERT_USER = `
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at,
    updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
    'authenticated', $1::text, 'x', now(), '{}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '')`;

describe.skipIf(!dbUp)("0027 invite tokens", () => {
  let owner: pg.Client;
  let h: ReturnType<typeof impersonate>;

  beforeAll(async () => {
    owner = makeClient();
    await owner.connect();
    h = impersonate(owner);
  });

  afterAll(async () => {
    // Only the concurrency + gate tests commit; clear anything they left.
    try {
      await owner.query(`delete from invite_tokens where label like $1`, [`${TAG}%`]);
      await owner.query(`delete from invited_emails where email like $1`, [`%@${TAG}.test`]);
      await owner.query(`delete from auth.users where email like $1`, [`%@${TAG}.test`]);
    } catch { /* best effort */ }
    await owner?.end();
  });

  // ---- 2. the gate function itself is untouched ---------------------------

  it("enforce_invited_signup is byte-identical to its pre-build state", async () => {
    const { rows } = await owner.query(
      `select encode(sha256(pg_get_functiondef(p.oid)::bytea), 'hex') as sha
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'enforce_invited_signup'`,
    );
    expect(rows[0].sha).toBe(BASELINE_SHA);
  });

  it("the gate still reads only invited_emails, and still keys on session_user", async () => {
    const { rows } = await owner.query(
      `select pg_get_functiondef(p.oid) as src from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='enforce_invited_signup'`,
    );
    const src = rows[0].src as string;
    expect(src).toContain("session_user = 'supabase_auth_admin'");
    expect(src).toContain("public.invited_emails");
    // The whole point of 0027: the gate learned nothing about tokens.
    expect(src).not.toMatch(/invite_tokens|invite_redemptions|redeem_invite/);
  });

  // ---- 4. validity, idempotency, and the closed doors --------------------

  it("a valid token puts the address on the allowlist, attributed to the minter", async () => {
    await h.inTxn(async (c) => {
      await c.query(`insert into auth.users (instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token,
        email_change_token_new, email_change)
        values ('00000000-0000-0000-0000-000000000000',
          '2b2b2b2b-0027-4000-8000-00000000da1a'::uuid, 'authenticated','authenticated',
          'minter@zz.test','x',now(),'{}'::jsonb,'{}'::jsonb,now(),now(),'','','','')`);
      const { rows: t } = await c.query(
        `insert into invite_tokens (max_uses, expires_at, created_by, label)
         values (5, now() + interval '7 days', '2b2b2b2b-0027-4000-8000-00000000da1a'::uuid, $1)
         returning token`,
        [`${TAG}-valid`],
      );
      const tok = t[0].token as string;

      const { rows: r } = await c.query(`select public.redeem_invite($1,$2) as ok`, [
        tok,
        `  Neighbor@${TAG}.TEST `,
      ]);
      expect(r[0].ok).toBe(true);

      // normalized on the way in, so casing cannot make a second person
      const { rows: allow } = await c.query(
        `select email, invited_by, note from invited_emails where email = $1`,
        [`neighbor@${TAG}.test`],
      );
      expect(allow).toHaveLength(1);
      expect(allow[0].invited_by).toBe("2b2b2b2b-0027-4000-8000-00000000da1a");
      expect(allow[0].note).toBe("invite token");

      const { rows: used } = await c.query(`select uses_count from invite_tokens where token=$1`, [tok]);
      expect(used[0].uses_count).toBe(1);
    });
  });

  it("the same address redeeming twice burns exactly one use", async () => {
    await h.inTxn(async (c) => {
      const { rows: t } = await c.query(
        `insert into invite_tokens (max_uses, expires_at, label)
         values (25, now() + interval '7 days', $1) returning token`,
        [`${TAG}-idem`],
      );
      const tok = t[0].token as string;

      const a = await c.query(`select public.redeem_invite($1,$2) as ok`, [tok, `dup@${TAG}.test`]);
      const b = await c.query(`select public.redeem_invite($1,$2) as ok`, [tok, `DUP@${TAG}.test`]);
      // Both succeed — a double-tap is not an error to the person tapping.
      expect([a.rows[0].ok, b.rows[0].ok]).toEqual([true, true]);

      const { rows } = await c.query(
        `select (select count(*)::int from invited_emails where email=$2) as allow_rows,
                (select count(*)::int from invite_redemptions r join invite_tokens t on t.id=r.token_id
                  where t.token=$1) as redemptions,
                (select uses_count from invite_tokens where token=$1) as uses`,
        [tok, `dup@${TAG}.test`],
      );
      // ...but it must not cost two of twenty-five.
      expect(rows[0]).toEqual({ allow_rows: 1, redemptions: 1, uses: 1 });
    });
  });

  it("exhausted, expired, and revoked tokens each admit nobody", async () => {
    for (const [name, sql] of [
      ["exhausted", `insert into invite_tokens (max_uses, uses_count, expires_at, label)
                     values (1, 1, now() + interval '7 days', $1) returning token`],
      ["expired", `insert into invite_tokens (max_uses, expires_at, label)
                   values (5, now() - interval '1 minute', $1) returning token`],
      ["revoked", `insert into invite_tokens (max_uses, expires_at, revoked_at, label)
                   values (5, now() + interval '7 days', now(), $1) returning token`],
    ] as const) {
      await h.inTxn(async (c) => {
        const { rows: t } = await c.query(sql, [`${TAG}-${name}`]);
        const tok = t[0].token as string;
        const email = `${name}@${TAG}.test`;

        const { rows: r } = await c.query(`select public.redeem_invite($1,$2) as ok`, [tok, email]);
        expect(r[0].ok, `${name} token must be refused`).toBe(false);

        const { rows } = await c.query(
          `select (select count(*)::int from invited_emails where email=$1) as allow_rows,
                  (select count(*)::int from invite_redemptions r join invite_tokens t on t.id=r.token_id
                    where t.token=$2) as redemptions`,
          [email, tok],
        );
        // No allowlist row, and no orphan redemption row left behind by the
        // rolled-back claim.
        expect(rows[0], `${name} must write nothing`).toEqual({ allow_rows: 0, redemptions: 0 });
      });
    }
  });

  it("an unknown token and a malformed address are refused the same way", async () => {
    const { rows } = await owner.query(
      `select public.redeem_invite('deadbeefdeadbeefdeadbeefdeadbeef', $1) as unknown_tok,
              public.redeem_invite('deadbeefdeadbeefdeadbeefdeadbeef', 'not-an-email') as bad_email`,
      [`ghost@${TAG}.test`],
    );
    // One neutral answer for every failure — no oracle in the return value.
    expect(rows[0].unknown_tok).toBe(false);
    expect(rows[0].bad_email).toBe(false);
  });

  // ---- RLS: neither new table is readable by a client --------------------

  it("anon cannot SELECT either new table", async () => {
    await owner.query("begin");
    try {
      await owner.query("set local role anon");
      for (const t of ["invite_tokens", "invite_redemptions"]) {
        await owner.query("savepoint p");
        await expect(owner.query(`select * from public.${t}`), t).rejects.toThrow(
          /permission denied for table/,
        );
        await owner.query("rollback to savepoint p");
      }
    } finally {
      await owner.query("rollback");
    }
  });

  it("a plain authenticated member cannot read the tokens or the graph", async () => {
    for (const t of ["invite_tokens", "invite_redemptions"]) {
      const res = await h.runAs(RANDO, `select count(*)::int as n from public.${t}`);
      // RLS is moderator-only, so a non-moderator sees an empty set.
      expect(res.rows[0].n, t).toBe(0);
    }
  });

  it("nothing in 0027 is reachable by anon; service_role reaches both functions", async () => {
    // INVERTED from an earlier revision, which asserted redeem_anon: true on the
    // reasoning that the redeemer has no session. That conflated an anonymous
    // person with an anonymous database role — the redeem route is server-side
    // and holds the service key. Kept as a guard rather than deleted, because
    // the grant it now forbids was once deliberate.
    const { rows } = await owner.query(`
      select has_function_privilege('anon','public.redeem_invite(text,text)','EXECUTE') as redeem_anon,
             has_function_privilege('public','public.redeem_invite(text,text)','EXECUTE') as redeem_public,
             has_function_privilege('service_role','public.redeem_invite(text,text)','EXECUTE') as redeem_svc,
             has_function_privilege('anon','public.purge_stale_invites(interval)','EXECUTE') as purge_anon,
             has_function_privilege('public','public.purge_stale_invites(interval)','EXECUTE') as purge_public,
             has_function_privilege('service_role','public.purge_stale_invites(interval)','EXECUTE') as purge_svc`);
    expect(rows[0]).toEqual({
      redeem_anon: false,   // reversed — see the GRANT-site note in 0027
      redeem_public: false, // default EXECUTE-to-PUBLIC revoked
      redeem_svc: true,     // the route handler's role, and the only door
      purge_anon: false,
      purge_public: false,
      purge_svc: true,
    });
  });

  it("no anon TABLE privilege either — asserted apart from the function grants", async () => {
    // Two catalogs, two assertions. A single "no anon grant" check covering both
    // is an invariant that can be true and false at once, and one did pass while
    // anon held EXECUTE on redeem_invite.
    const { rows } = await owner.query(
      `select coalesce(string_agg(distinct grantee||':'||privilege_type, ', '), '') as g
         from information_schema.role_table_grants
        where table_schema='public'
          and table_name in ('invite_tokens','invite_redemptions')
          and grantee = 'anon'`,
    );
    expect(rows[0].g).toBe("");
  });

  it("both new functions pin search_path including pg_temp", async () => {
    const { rows } = await owner.query(
      `select p.proname, array_to_string(p.proconfig, ',') as cfg
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname in ('redeem_invite','purge_stale_invites')
        order by p.proname`,
    );
    expect(rows).toEqual([
      { proname: "purge_stale_invites", cfg: "search_path=public, pg_temp" },
      { proname: "redeem_invite", cfg: "search_path=public, pg_temp" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 3 · concurrency — real commits on two connections
// ---------------------------------------------------------------------------
describe.skipIf(!dbUp)("0027 redeem_invite is race-safe", () => {
  let owner: pg.Client;
  const tokens: string[] = [];

  beforeAll(async () => {
    owner = makeClient();
    await owner.connect();
  });

  afterAll(async () => {
    try {
      await owner.query(`delete from invite_tokens where label like $1`, [`${TAG}%`]);
      await owner.query(`delete from invited_emails where email like $1`, [`%@${TAG}.test`]);
    } catch { /* best effort */ }
    await owner?.end();
  });

  /**
   * Block until some other backend is genuinely WAITING ON A LOCK inside
   * redeem_invite.
   *
   * Without this the test is vacuous, and it silently was: committing A
   * immediately after issuing B's query let B's statement reach the server after
   * A had already committed, so the two never overlapped and the naive
   * check-then-act implementation passed. Verified by swapping that
   * implementation in — it must fail, and with this barrier it does.
   */
  async function waitUntilBlocked(timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const { rows } = await owner.query(
        `select count(*)::int as n from pg_stat_activity
          where datname = current_database()
            and wait_event_type = 'Lock'
            and query ilike '%redeem_invite%'`,
      );
      if (rows[0].n > 0) return;
      if (Date.now() > deadline) {
        throw new Error(
          "no backend ever blocked on the row lock — the two redemptions did not " +
            "overlap, so this test would prove nothing",
        );
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  async function mintOneUse(label: string): Promise<string> {
    const { rows } = await owner.query(
      `insert into invite_tokens (max_uses, expires_at, label)
       values (1, now() + interval '1 day', $1) returning token`,
      [`${TAG}-${label}`],
    );
    tokens.push(rows[0].token);
    return rows[0].token as string;
  }

  it("the check-then-act pattern this replaces DOES lose the update", async () => {
    // Not a test of our code — a demonstration that the thing being defended
    // against is real, so the assertion in the next test is measuring something.
    const tok = await mintOneUse("naive");
    const a = makeClient();
    const b = makeClient();
    await a.connect();
    await b.connect();
    try {
      await a.query("begin");
      await b.query("begin");
      // Both read the counter before either writes — a plain SELECT takes no lock.
      const ra = await a.query(`select uses_count, max_uses from invite_tokens where token=$1`, [tok]);
      const rb = await b.query(`select uses_count, max_uses from invite_tokens where token=$1`, [tok]);

      const aWouldProceed = ra.rows[0].uses_count < ra.rows[0].max_uses;
      const bWouldProceed = rb.rows[0].uses_count < rb.rows[0].max_uses;

      // BOTH believe a use is available. A naive implementation admits two
      // people to a one-use token here.
      expect(aWouldProceed && bWouldProceed).toBe(true);

      await a.query("rollback");
      await b.query("rollback");
    } finally {
      await a.end();
      await b.end();
    }
  });

  it("two simultaneous redemptions of a one-use token yield exactly one success", async () => {
    const tok = await mintOneUse("race");
    const a = makeClient();
    const b = makeClient();
    await a.connect();
    await b.connect();
    try {
      // A opens a transaction and redeems, taking the row lock and holding it.
      await a.query("begin");
      const resA = await a.query(`select public.redeem_invite($1,$2) as ok`, [
        tok,
        `racer-a@${TAG}.test`,
      ]);

      // B starts redeeming while A still holds the lock. Its conditional UPDATE
      // blocks; do NOT await yet.
      await b.query("begin");
      const pendingB = b.query(`select public.redeem_invite($1,$2) as ok`, [
        tok,
        `racer-b@${TAG}.test`,
      ]);

      // Do not release A until B is demonstrably stuck on the row lock. This
      // barrier is what makes the assertion below mean anything.
      await waitUntilBlocked();

      // Release A. B now re-evaluates its WHERE against the committed row.
      await a.query("commit");
      const resB = await pendingB;
      await b.query("commit");

      const successes = [resA.rows[0].ok, resB.rows[0].ok].filter(Boolean).length;
      expect(successes).toBe(1);

      const { rows } = await owner.query(
        `select (select uses_count from invite_tokens where token=$1) as uses,
                (select count(*)::int from invite_redemptions r
                   join invite_tokens t on t.id = r.token_id where t.token=$1) as redemptions,
                (select count(*)::int from invited_emails where email like $2) as allow_rows`,
        [tok, `racer-%@${TAG}.test`],
      );
      // The loser leaves nothing behind: no extra use, no orphan redemption row,
      // no allowlist row for the address that was refused.
      expect(rows[0]).toEqual({ uses: 1, redemptions: 1, allow_rows: 1 });
    } finally {
      await a.end();
      await b.end();
    }
  });
});

// ---------------------------------------------------------------------------
// 1 · THE REGRESSION THAT MATTERS — the gate still refuses uninvited signups
// ---------------------------------------------------------------------------
// Needs a connection whose LOGIN role is supabase_auth_admin, because
// enforce_invited_signup() keys on session_user and SET LOCAL ROLE cannot change
// it. Skips where that connection is unavailable (CI) rather than passing
// vacuously from the owner connection, where the gate never fires at all.
describe.skipIf(!dbUp || !authAdminUp)(
  "0027 did not weaken the signup gate (as the auth service)",
  () => {
    let auth: pg.Client;
    let owner: pg.Client;

    beforeAll(async () => {
      auth = authAdminClient();
      await auth.connect();
      owner = makeClient();
      await owner.connect();
    });

    afterAll(async () => {
      try {
        await owner.query(`delete from auth.users where email like $1`, [`%@${TAG}.test`]);
        await owner.query(`delete from invite_tokens where label like $1`, [`${TAG}%`]);
        await owner.query(`delete from invited_emails where email like $1`, [`%@${TAG}.test`]);
      } catch { /* best effort */ }
      await auth?.end();
      await owner?.end();
    });

    it("the connection really is the auth service (otherwise this suite proves nothing)", async () => {
      const { rows } = await auth.query("select session_user as u");
      expect(rows[0].u).toBe("supabase_auth_admin");
    });

    it("an email that never redeemed a token STILL cannot create an account", async () => {
      const email = `never-invited@${TAG}.test`;
      await auth.query("begin");
      try {
        await expect(auth.query(INSERT_USER, [email])).rejects.toThrow(
          /signups are invite-only/,
        );
      } finally {
        await auth.query("rollback");
      }
    });

    it("adding the token subsystem did not open a side door for an unlisted email", async () => {
      // A token EXISTS and is valid, but this address never redeemed it. Holding
      // a token is not the same as being on the list — that distinction is the
      // whole reason redemption writes to the allowlist instead of the trigger
      // learning about tokens.
      await owner.query(
        `insert into invite_tokens (max_uses, expires_at, label)
         values (10, now() + interval '7 days', $1)`,
        [`${TAG}-sidedoor`],
      );
      const email = `has-not-redeemed@${TAG}.test`;
      await auth.query("begin");
      try {
        await expect(auth.query(INSERT_USER, [email])).rejects.toThrow(
          /signups are invite-only/,
        );
      } finally {
        await auth.query("rollback");
      }
    });

    it("an email that DID redeem a token can create an account", async () => {
      // The positive control. Without it the two refusals above could pass
      // because signup is broken outright rather than because the gate is right.
      const email = `redeemed@${TAG}.test`;
      const { rows: t } = await owner.query(
        `insert into invite_tokens (max_uses, expires_at, label)
         values (3, now() + interval '7 days', $1) returning token`,
        [`${TAG}-admits`],
      );
      const { rows: r } = await owner.query(`select public.redeem_invite($1,$2) as ok`, [
        t[0].token,
        email,
      ]);
      expect(r[0].ok).toBe(true);

      await auth.query("begin");
      try {
        await expect(auth.query(INSERT_USER, [email])).resolves.toBeTruthy();
      } finally {
        await auth.query("rollback");
      }
    });
  },
);

// ---------------------------------------------------------------------------
// anon through PostgREST — the layer where G-INV-4's consequence is visible
// ---------------------------------------------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!(url && anonKey))("0027 invite tables via the anon API", () => {
  let supa: SupabaseClient;
  beforeAll(() => {
    supa = createClient(url as string, anonKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it("anon cannot read invite_tokens or invite_redemptions", async () => {
    for (const t of ["invite_tokens", "invite_redemptions"]) {
      const { data, error } = await supa.from(t).select("*").limit(5);
      expect(Boolean(error) || (data ?? []).length === 0, t).toBe(true);
    }
  });

  it("anon CANNOT call redeem_invite through the public API", async () => {
    // The end-to-end form of the reversal: not just "the catalog says no grant",
    // but PostgREST actually refusing the call with the publishable key. This is
    // the surface that mattered — a printed token is meant to be photographed,
    // and an exposed RPC would let a holder burn a 25-use cap on garbage
    // addresses before a real neighbor arrived.
    const { error } = await supa.rpc("redeem_invite", {
      p_token: "deadbeefdeadbeefdeadbeefdeadbeef",
      p_email: `probe@${TAG}.test`,
    });
    expect(error).toBeTruthy();
    expect(error?.message ?? "").toMatch(/permission denied/i);
  });

  it("anon cannot reach purge_stale_invites either", async () => {
    const { error } = await supa.rpc("purge_stale_invites", {});
    expect(error).toBeTruthy();
  });
});
