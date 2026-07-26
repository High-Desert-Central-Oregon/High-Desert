import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dbReachable, makeClient, impersonate, RANDO } from "./helpers/pg-impersonation";

/**
 * Migration 0026 — neighborhood pledge campaigns.
 *
 * The thing under test is a table holding pre-member email addresses behind a
 * count that is printed on public signage. So the suite is mostly refusals: it
 * asserts that `pledges` is unreachable from every client role under every query
 * shape, and that the one function a client CAN call hands back an aggregate and
 * nothing else.
 *
 * Two harnesses, deliberately:
 *   • a direct owner Postgres connection with role impersonation, for the
 *     privilege and behaviour assertions (fixtures built inside a rolled-back
 *     transaction — no seed needed, nothing persists);
 *   • a real anon supabase-js client, because the PostgREST embed syntax only
 *     exists at that layer and is exactly the shape an attacker would reach for.
 *
 * Both skip cleanly when their dependency is absent (CI with no DB, no
 * .env.local), rather than failing for the wrong reason.
 */

const dbUp = await dbReachable();

// ---------------------------------------------------------------------------
// 1 · Privilege + behaviour, against the database itself
// ---------------------------------------------------------------------------
describe.skipIf(!dbUp)("pledges — isolation and behaviour (owner connection)", () => {
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

  /** A campaign with `n` pledges, inside the caller's open transaction. */
  async function seedCampaign(
    c: pg.Client,
    slug: string,
    threshold: number,
    emails: string[],
  ) {
    const { rows } = await c.query(
      "insert into neighborhoods (slug, name, threshold) values ($1, $2, $3) returning id",
      [slug, `Test ${slug}`, threshold],
    );
    const id = rows[0].id as string;
    for (const email of emails) {
      await c.query(
        "insert into pledges (neighborhood_id, email_normalized) values ($1, $2)",
        [id, email],
      );
    }
    return id;
  }

  // ---- the table is unreachable, under every shape -------------------------

  it("anon cannot SELECT pledges directly", async () => {
    await client.query("begin");
    try {
      await client.query("set local role anon");
      await expect(client.query("select * from public.pledges")).rejects.toThrow(
        /permission denied for table pledges/,
      );
    } finally {
      await client.query("rollback");
    }
  });

  it("anon cannot reach pledges by joining from the readable neighborhoods table", async () => {
    await client.query("begin");
    try {
      await client.query("set local role anon");
      await expect(
        client.query(
          "select p.email_normalized from public.neighborhoods n join public.pledges p on p.neighborhood_id = n.id",
        ),
      ).rejects.toThrow(/permission denied for table pledges/);
    } finally {
      await client.query("rollback");
    }
  });

  it("anon cannot reach pledges through a subquery or an aggregate", async () => {
    // Each probe gets its own savepoint: the first refusal aborts the
    // transaction, and without a rollback to a savepoint the second assertion
    // would see "current transaction is aborted" and pass for the wrong reason.
    await client.query("begin");
    try {
      await client.query("set local role anon");
      for (const sql of [
        "select count(*) from public.pledges where email_normalized like '%@%'",
        "select (select count(*) from public.pledges) as n from public.neighborhoods limit 1",
        "select 1 where exists (select 1 from public.pledges)",
      ]) {
        await client.query("savepoint probe");
        await expect(client.query(sql), sql).rejects.toThrow(
          /permission denied for table pledges/,
        );
        await client.query("rollback to savepoint probe");
      }
    } finally {
      await client.query("rollback");
    }
  });

  it("anon cannot build a view over pledges to read them through", async () => {
    await client.query("begin");
    try {
      await client.query("set local role anon");
      await expect(
        client.query("create view anon_peek as select * from public.pledges"),
      ).rejects.toThrow();
    } finally {
      await client.query("rollback");
    }
  });

  it("an authenticated member fares no better — no read, no write, no delete", async () => {
    await expect(h.runAs(RANDO, "select * from public.pledges")).rejects.toThrow(
      /permission denied for table pledges/,
    );
    await expect(
      h.runAs(RANDO, "insert into public.pledges (neighborhood_id, email_normalized) values (gen_random_uuid(), 'x@y.com')"),
    ).rejects.toThrow(/permission denied for table pledges/);
    await expect(h.runAs(RANDO, "delete from public.pledges")).rejects.toThrow(
      /permission denied for table pledges/,
    );
  });

  it("pledges has RLS on and, by design, ZERO policies", async () => {
    const { rows } = await client.query(
      `select (select relrowsecurity from pg_class where relname = 'pledges') as rls,
              (select count(*)::int from pg_policies where tablename = 'pledges') as policies`,
    );
    expect(rows[0].rls).toBe(true);
    // A policy appearing here means someone opened a read path that is supposed
    // not to exist. The definer functions are the only door.
    expect(rows[0].policies).toBe(0);
  });

  it("no client role holds ANY table privilege on pledges — the second, independent lock", async () => {
    const { rows } = await client.query(
      `select grantee, privilege_type from information_schema.role_table_grants
        where table_name = 'pledges' and grantee in ('anon','authenticated','service_role')`,
    );
    expect(rows).toEqual([]);
  });

  it("the write RPCs are unreachable by clients, so the route handler is the only door", async () => {
    for (const fn of [
      "public.submit_pledge('x','a@b.com')",
      "public.remove_pledge(gen_random_uuid())",
      "public.pledge_removal_token('x','a@b.com')",
      "public.close_stale_pledge_campaigns()",
    ]) {
      await expect(h.runAs(RANDO, `select ${fn}`)).rejects.toThrow(/permission denied for function/);
    }
  });

  // ---- neighborhood_status: an aggregate, and only an aggregate ------------

  it("neighborhood_status returns correct counts to anon", async () => {
    await h.inTxn(async (c) => {
      await seedCampaign(c, "t-count", 20, ["a@x.com", "b@x.com", "c@x.com"]);
      await c.query("set local role anon");
      const { rows } = await c.query("select * from public.neighborhood_status('t-count')");
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].pledge_count)).toBe(3);
      expect(rows[0].threshold).toBe(20);
      expect(rows[0].slug).toBe("t-count");
    });
  });

  it("never leaks a column outside its declared return type", async () => {
    const { rows } = await client.query(
      `select string_agg(a.nm || ':' || format_type(a.tp, null), ',' order by a.ord) as shape
         from pg_proc p,
              lateral (
                select n.nm, t.tp, n.ord
                  from unnest(p.proargnames)    with ordinality as n(nm, ord)
                  join unnest(p.proallargtypes) with ordinality as t(tp, ord2) on ord2 = n.ord
                  join unnest(p.proargmodes)    with ordinality as m(md, ord3) on ord3 = n.ord
                 where m.md = 't'
              ) a
        where p.proname = 'neighborhood_status'`,
    );
    // Pinned exactly. An address, an id, a removal token, or a created_at
    // appearing here is the failure this whole feature is guarding against.
    expect(rows[0].shape).toBe(
      "slug:text,name:text,threshold:integer,pledge_count:bigint,is_open:boolean",
    );
  });

  it("is_open follows the human-recorded opening, not the arithmetic", async () => {
    await h.inTxn(async (c) => {
      await seedCampaign(c, "t-open", 2, ["a@x.com", "b@x.com", "c@x.com"]);
      let { rows } = await c.query("select * from public.neighborhood_status('t-open')");
      // Past the threshold, and still not open: a person opens a neighborhood.
      expect(Number(rows[0].pledge_count)).toBeGreaterThanOrEqual(rows[0].threshold);
      expect(rows[0].is_open).toBe(false);

      await c.query("update neighborhoods set opened_at = now() where slug = 't-open'");
      ({ rows } = await c.query("select * from public.neighborhood_status('t-open')"));
      expect(rows[0].is_open).toBe(true);
    });
  });

  it("an unknown slug returns no row and does not raise, so the route can 404 cleanly", async () => {
    const { rows } = await client.query(
      "select * from public.neighborhood_status('no-such-neighborhood-anywhere')",
    );
    expect(rows).toEqual([]);
  });

  it("a real neighborhood with no campaign is indistinguishable from one that does not exist", async () => {
    // No browsable directory of neighborhoods Steppe has no presence in.
    const { rows } = await client.query(
      "select * from public.neighborhood_status('braydon-park')",
    );
    expect(rows).toEqual([]);
  });

  // ---- submit_pledge -------------------------------------------------------

  it("submit_pledge is idempotent for a repeated email, whatever its casing", async () => {
    await h.inTxn(async (c) => {
      await seedCampaign(c, "t-idem", 20, []);

      const first = await c.query("select * from public.submit_pledge('t-idem', '  Neighbor@Example.COM ')");
      expect(Number(first.rows[0].pledge_count)).toBe(1);
      expect(first.rows[0].already_pledged).toBe(false);

      const repeat = await c.query("select * from public.submit_pledge('t-idem', 'NEIGHBOR@example.com')");
      expect(Number(repeat.rows[0].pledge_count)).toBe(1); // no second layer
      expect(repeat.rows[0].already_pledged).toBe(true);

      const other = await c.query("select * from public.submit_pledge('t-idem', 'someone.else@example.com')");
      expect(Number(other.rows[0].pledge_count)).toBe(2);
      expect(other.rows[0].already_pledged).toBe(false);

      // exactly one stored row for that address, canonicalized
      const { rows } = await c.query(
        "select email_normalized from pledges where email_normalized like 'neighbor%'",
      );
      expect(rows).toEqual([{ email_normalized: "neighbor@example.com" }]);
    });
  });

  it("submit_pledge validates the address server-side and refuses a campaign-less slug", async () => {
    await h.inTxn(async (c) => {
      await seedCampaign(c, "t-valid", 20, []);
      await expect(c.query("select public.submit_pledge('t-valid', 'not-an-email')")).rejects.toThrow();
      await expect(c.query("select public.submit_pledge('ghost-hood', 'a@b.com')")).rejects.toThrow();
      await expect(c.query("select public.submit_pledge('braydon-park', 'a@b.com')")).rejects.toThrow();
    });
  });

  // ---- removal -------------------------------------------------------------

  it("a removal token deletes exactly one row and nothing else", async () => {
    await h.inTxn(async (c) => {
      await seedCampaign(c, "t-rm", 20, ["keep1@x.com", "target@x.com", "keep2@x.com"]);
      await seedCampaign(c, "t-rm-other", 20, ["bystander@x.com"]);

      const { rows: t } = await c.query(
        "select public.pledge_removal_token('t-rm', 'target@x.com') as token",
      );
      const removed = await c.query("select public.remove_pledge($1) as ok", [t[0].token]);
      expect(removed.rows[0].ok).toBe(true);

      // Scoped to this case's own fixtures. Asserting over the whole table
      // would make the test depend on the database being empty, which is a
      // property of whoever ran something last, not of the code under test.
      const { rows } = await c.query(
        `select p.email_normalized from pledges p
           join neighborhoods n on n.id = p.neighborhood_id
          where n.slug in ('t-rm', 't-rm-other')
          order by p.email_normalized`,
      );
      expect(rows.map((r) => r.email_normalized)).toEqual([
        "bystander@x.com",
        "keep1@x.com",
        "keep2@x.com",
      ]);
    });
  });

  it("nothing is retained after a removal — no tombstone, no suppression row", async () => {
    await h.inTxn(async (c) => {
      await seedCampaign(c, "t-forget", 20, ["gone@x.com"]);
      const { rows: t } = await c.query(
        "select public.pledge_removal_token('t-forget', 'gone@x.com') as token",
      );
      await c.query("select public.remove_pledge($1)", [t[0].token]);
      const { rows } = await c.query(
        "select count(*)::int as n from pledges where email_normalized = 'gone@x.com'",
      );
      expect(rows[0].n).toBe(0);
    });
  });

  it("an unknown or null token removes nothing and says so", async () => {
    await h.inTxn(async (c) => {
      await seedCampaign(c, "t-badtoken", 20, ["safe@x.com"]);
      const bogus = await c.query("select public.remove_pledge(gen_random_uuid()) as ok");
      expect(bogus.rows[0].ok).toBe(false);
      const nul = await c.query("select public.remove_pledge(null) as ok");
      expect(nul.rows[0].ok).toBe(false);
      const { rows } = await c.query(
        `select count(*)::int as n from pledges p
           join neighborhoods n on n.id = p.neighborhood_id
          where n.slug = 't-badtoken'`,
      );
      expect(rows[0].n).toBe(1);
    });
  });

  it("one token addresses exactly one row, by unique index", async () => {
    const { rows } = await client.query(
      `select i.indisunique from pg_index i
         join pg_class c on c.oid = i.indexrelid
        where c.relname = 'pledges_removal_token_idx'`,
    );
    expect(rows[0]?.indisunique).toBe(true);
  });

  // ---- the printed promise -------------------------------------------------

  it("a threshold can be lowered mid-campaign but never raised once anyone has pledged", async () => {
    await h.inTxn(async (c) => {
      await seedCampaign(c, "t-thresh", 20, ["a@x.com"]);
      await expect(
        c.query("update neighborhoods set threshold = 35 where slug = 't-thresh'"),
      ).rejects.toThrow(/cannot be raised/);
    });
    await h.inTxn(async (c) => {
      await seedCampaign(c, "t-thresh2", 20, ["a@x.com"]);
      await c.query("update neighborhoods set threshold = 12 where slug = 't-thresh2'");
      const { rows } = await c.query("select threshold from neighborhoods where slug = 't-thresh2'");
      expect(rows[0].threshold).toBe(12);
    });
  });

  // ---- moderator-only activity view ---------------------------------------

  it("pledge_activity is refused to a non-moderator and never declares an address column", async () => {
    await expect(h.runAs(RANDO, "select * from public.pledge_activity()")).rejects.toThrow(
      /moderators only/,
    );
    const { rows } = await client.query(
      `select string_agg(a.nm, ',' order by a.ord) as shape
         from pg_proc p,
              lateral (
                select n.nm, n.ord from unnest(p.proargnames) with ordinality as n(nm, ord)
                  join unnest(p.proargmodes) with ordinality as m(md, ord3) on ord3 = n.ord
                 where m.md = 't'
              ) a
        where p.proname = 'pledge_activity'`,
    );
    expect(rows[0].shape).toBe("slug,name,threshold,pledge_count,pledged_at");
    expect(rows[0].shape).not.toMatch(/email/);
  });

  // ---- the retention bound -------------------------------------------------

  it("close_stale_pledge_campaigns purges an unopened campaign past its window, and spares the rest", async () => {
    await h.inTxn(async (c) => {
      const stale = await seedCampaign(c, "t-stale", 20, []);
      const fresh = await seedCampaign(c, "t-fresh", 20, []);
      const opened = await seedCampaign(c, "t-opened", 20, []);
      await c.query("update neighborhoods set opened_at = now() where id = $1", [opened]);
      await c.query(
        `insert into pledges (neighborhood_id, email_normalized, created_at) values
           ($1, 'old@x.com',    now() - interval '200 days'),
           ($1, 'recent@x.com', now() - interval '2 days'),
           ($2, 'fresh@x.com',  now() - interval '10 days'),
           ($3, 'opened@x.com', now() - interval '300 days')`,
        [stale, fresh, opened],
      );

      // The purge is global by design, so both assertions are scoped to this
      // case's own fixtures. Asserting over the whole table would make the test
      // depend on the database being empty — a property of whoever ran
      // something last, not of the code under test.
      const mine = ["t-stale", "t-fresh", "t-opened"];
      const { rows: purged } = await c.query("select * from public.close_stale_pledge_campaigns()");
      // BOTH of the stale campaign's addresses go, including the recent one:
      // the commitment is "all pledge records for that neighborhood".
      expect(
        purged
          .filter((r) => mine.includes(r.slug))
          .map((r) => r.email_normalized)
          .sort(),
      ).toEqual(["old@x.com", "recent@x.com"]);

      const { rows: left } = await c.query(
        `select p.email_normalized from pledges p
           join neighborhoods n on n.id = p.neighborhood_id
          where n.slug = any($1)
          order by p.email_normalized`,
        [mine],
      );
      expect(left.map((r) => r.email_normalized)).toEqual(["fresh@x.com", "opened@x.com"]);
    });
  });
});

// ---------------------------------------------------------------------------
// 2 · The same isolation, through PostgREST with a real anon key
// ---------------------------------------------------------------------------
// The embed syntax below exists only at this layer, and it is precisely the
// shape someone probing the API would try first. Only attempts operations that
// must be denied, plus one positive control — so it is safe against local or
// prod, and cannot pass vacuously because everything is broken.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!(url && anonKey))("pledges — anon PostgREST client", () => {
  let supa: SupabaseClient;
  beforeAll(() => {
    supa = createClient(url as string, anonKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  const denied = (error: { message?: string } | null, data: unknown) =>
    Boolean(error) || (Array.isArray(data) && data.length === 0);

  it("anon cannot select pledges", async () => {
    const { data, error } = await supa.from("pledges").select("*").limit(5);
    expect(denied(error, data)).toBe(true);
  });

  it("anon cannot select pledges through the PostgREST embed syntax", async () => {
    const { data, error } = await supa
      .from("neighborhoods")
      .select("slug,pledges(email_normalized,removal_token)")
      .limit(5);

    // Assert on the EMBEDDED rows, not on the outer array: neighborhoods is
    // anon-readable, so `data` is non-empty whenever the query is allowed to
    // run at all. What must be true is that no pledge ever rides along inside
    // it. Correctly configured the whole query is refused outright; this also
    // holds the line if it ever starts succeeding.
    if (!error) {
      const embedded = (data ?? []).flatMap(
        (row) => (row as { pledges?: unknown[] }).pledges ?? [],
      );
      expect(embedded).toEqual([]);
    }
    expect(error).toBeTruthy();
  });

  it("anon cannot insert or delete a pledge", async () => {
    const ins = await supa
      .from("pledges")
      .insert({ neighborhood_id: crypto.randomUUID(), email_normalized: "probe@example.com" });
    expect(ins.error).toBeTruthy();
    const del = await supa.from("pledges").delete().neq("id", crypto.randomUUID());
    expect(del.error).toBeTruthy();
  });

  it("anon cannot call the write RPCs", async () => {
    for (const [fn, args] of [
      ["submit_pledge", { p_slug: "x", p_email: "a@b.com" }],
      ["remove_pledge", { p_token: crypto.randomUUID() }],
      ["pledge_removal_token", { p_slug: "x", p_email: "a@b.com" }],
    ] as const) {
      const { error } = await supa.rpc(fn, args);
      expect(error, `${fn} must be denied to anon`).toBeTruthy();
    }
  });

  it("positive control: anon CAN call neighborhood_status, so the denials above mean something", async () => {
    const { error } = await supa.rpc("neighborhood_status", { p_slug: "no-such-slug" });
    expect(error).toBeNull();
  });
});
