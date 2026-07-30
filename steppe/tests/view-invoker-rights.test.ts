import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { dbReachable, makeClient, impersonate } from "./helpers/pg-impersonation";

/**
 * Migration 0028 — owner rights on the two views that depend on them.
 *
 * THE BUG THIS EXISTS TO CATCH. A Supabase advisor remediation applied from the
 * dashboard set `security_invoker = on` on all four public views. For two of
 * them that is not hardening, it is breakage, and the breakage is SILENT — no
 * error, no empty page, just wrong numbers:
 *
 *   public_profiles   the caller's own `pf_read` (id = auth.uid()) starts
 *                     applying, so a member sees only themselves. Nine call
 *                     sites read this view for OTHER members' names.
 *   proposal_results  the caller's `vt_select` (user_id = auth.uid()) starts
 *                     applying INSIDE the aggregate, so the tally counts one
 *                     ballot — the reader's. This is the only sanctioned read
 *                     path for governance results (invariant 4).
 *
 * Each positive assertion below is paired with the same read under
 * `security_invoker = on`, which must FAIL. A test that only asserts the good
 * state would pass just as happily against a view that reads past nothing —
 * this suite has to watch the failure to be worth anything.
 *
 * Everything runs in rolled-back transactions and builds its own fixtures.
 */

const dbUp = await dbReachable();
const PFX = "dddddddd-0028-4000-8000-";
/** Member i is PFX + 12-digit i; the proposal is PFX + "000000000099". */
const PROP = PFX + "000000000099";

/** Six verified members and a closed proposal with six ballots (reveal gate is 5). */
async function seed(c: pg.Client) {
  await c.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
       email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, recovery_token, email_change_token_new, email_change)
     select '00000000-0000-0000-0000-000000000000', ($1||lpad(i::text,12,'0'))::uuid, 'authenticated',
            'authenticated', 'vw0028-'||i||'@example.test', 'x', now(),
            '{}'::jsonb,'{}'::jsonb, now(), now(), '','','',''
       from generate_series(1,6) i`,
    [PFX],
  );
  await c.query(
    `update profiles set verified=true, tenure_start='2024-01-01',
            neighborhood_id=(select id from neighborhoods order by slug limit 1)
      where id::text like $1||'%'`,
    [PFX],
  );
  await c.query(
    `insert into proposals (id, title, kind, status, opens_at, closes_at)
     values ($1, 'VW0028 probe', 'minor', 'open', now() - interval '10 days', now() + interval '1 day')`,
    [PROP],
  );
  // Votes must be cast while the proposal is OPEN, and user_id comes from the
  // JWT claim because set_vote_weight() derives it (invariant 3) — never from us.
  await c.query(
    `do $do$
     declare r record; i int := 0; ch text[] := array['yes','yes','yes','no','abstain','yes'];
     begin
       for r in select id from profiles where id::text like '${PFX}%' order by id loop
         i := i + 1;
         perform set_config('request.jwt.claims',
           json_build_object('sub', r.id::text, 'role','authenticated')::text, true);
         insert into votes (proposal_id, choice) values ('${PROP}', ch[i]::vote_choice);
       end loop;
       perform set_config('request.jwt.claims','', true);
     end $do$`,
  );
  // The goalpost guard preserves closes_at by design; disabled for the fixture
  // only. Vote immutability is deliberately left armed.
  await c.query(`alter table proposals disable trigger trg_guard_proposal_columns`);
  await c.query(
    `update proposals set closes_at = now() - interval '1 day', status='closed' where id=$1`,
    [PROP],
  );
  await c.query(`alter table proposals enable trigger trg_guard_proposal_columns`);
}

/** Read both views as one of the seeded members. */
async function readAsMember(c: pg.Client) {
  await c.query(
    `select set_config('request.jwt.claims',
       json_build_object('sub',$1||'000000000001','role','authenticated')::text, true)`,
    [PFX],
  );
  await c.query(`set local role authenticated`);
  const profiles = await c.query(
    `select count(*)::int as n from public_profiles where id::text like $1||'%'`,
    [PFX],
  );
  const results = await c.query(
    `select ballots::int as ballots, revealed from proposal_results where proposal_id=$1`,
    [PROP],
  );
  await c.query(`reset role`);
  return {
    membersVisible: profiles.rows[0].n as number,
    ballots: (results.rows[0]?.ballots ?? 0) as number,
    revealed: (results.rows[0]?.revealed ?? false) as boolean,
  };
}

describe.skipIf(!dbUp)("0028 view owner-rights", () => {
  let owner: pg.Client;
  let h: ReturnType<typeof impersonate>;

  beforeAll(async () => {
    owner = makeClient();
    await owner.connect();
    h = impersonate(owner);
  });
  afterAll(async () => {
    await owner?.end();
  });

  it("the two owner-rights views are not invoker-rights, and content_moderation is", async () => {
    const { rows } = await owner.query(
      `select c.relname, coalesce(array_to_string(c.reloptions,','),'') as opts
         from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind='v' order by c.relname`,
    );
    const opt = Object.fromEntries(rows.map((r) => [r.relname, r.opts]));
    // An absent reloption and security_invoker=off are both owner rights, so
    // assert NOT-on rather than equality to a literal.
    expect(opt.public_profiles).not.toMatch(/security_invoker=on/);
    expect(opt.proposal_results).not.toMatch(/security_invoker=on/);
    expect(opt.content_moderation).toMatch(/security_invoker=on/);
  });

  it("anon holds nothing on the four views; authenticated holds exactly SELECT", async () => {
    const { rows } = await owner.query(
      `select grantee, privilege_type, table_name
         from information_schema.role_table_grants
        where table_schema='public'
          and table_name in ('public_profiles','proposal_results','content_moderation','groups_directory')
          and grantee in ('anon','PUBLIC','authenticated')`,
    );
    expect(rows.filter((r) => r.grantee === "anon" || r.grantee === "PUBLIC")).toHaveLength(0);
    const authed = rows.filter((r) => r.grantee === "authenticated");
    expect(authed).toHaveLength(4);
    expect([...new Set(authed.map((r) => r.privilege_type))]).toEqual(["SELECT"]);
  });

  it("a member reads OTHER members and a FULL tally (owner rights working)", async () => {
    await h.inTxn(async (c) => {
      await seed(c);
      const r = await readAsMember(c);
      expect(r.membersVisible).toBe(6); // not 1 — the whole point
      expect(r.ballots).toBe(6);
      expect(r.revealed).toBe(true);
    });
  });

  it("flipping security_invoker ON breaks both reads — so the test above is real", async () => {
    await h.inTxn(async (c) => {
      await seed(c);
      await c.query(`alter view public_profiles  set (security_invoker = on)`);
      await c.query(`alter view proposal_results set (security_invoker = on)`);

      const r = await readAsMember(c);
      // This is exactly what production returns today.
      expect(r.membersVisible).toBe(1);
      expect(r.ballots).toBe(1);
      expect(r.revealed).toBe(false);
    });
  });

  it("the per-viewer CASE still withholds a hidden neighborhood, and pf_read stays owner-only", async () => {
    await h.inTxn(async (c) => {
      await seed(c);
      await c.query(
        `update profiles set neighborhood_visibility='hidden' where id=($1||'000000000002')::uuid`,
        [PFX],
      );
      await c.query(
        `update profiles set neighborhood_visibility='members' where id=($1||'000000000001')::uuid`,
        [PFX],
      );
      await c.query(
        `select set_config('request.jwt.claims',
           json_build_object('sub',$1||'000000000001','role','authenticated')::text, true)`,
        [PFX],
      );
      await c.query(`set local role authenticated`);
      const { rows } = await c.query(
        `select id::text, neighborhood_id from public_profiles
          where id::text in ($1||'000000000001', $1||'000000000002') order by id`,
        [PFX],
      );
      await c.query(`reset role`);

      // Owner rights let the viewer SEE the row; the CASE decides the column.
      expect(rows).toHaveLength(2);
      expect(rows[0].neighborhood_id).not.toBeNull(); // self / 'members'
      expect(rows[1].neighborhood_id).toBeNull(); // 'hidden' from others

      const pol = await c.query(
        `select qual from pg_policies where schemaname='public'
           and tablename='profiles' and policyname='pf_read'`,
      );
      // 0023 narrowed pf_read to owner-only; 0028 must not have widened it.
      expect(pol.rows[0].qual).not.toMatch(/is_moderator/);
    });
  });
});
