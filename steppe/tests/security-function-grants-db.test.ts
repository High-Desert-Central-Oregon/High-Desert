import { afterAll, beforeAll, describe, expect, it } from "vitest";
import expected from "./fixtures/security-function-grants.json";
import { securityDb, target } from "./helpers/security-db";

// Role contracts frozen before the hosted-default regression was discovered.
// Includes member APIs, owner-only internals, and service-only workers.
describe.skipIf(!target)("security function role contracts", () => {
  const { db, act } = securityDb();
  beforeAll(async () => {
    await db.connect();
  });
  afterAll(async () => {
    await db.end();
  });

  it.each(expected)(
    "$signature keeps its intended role grants",
    async (entry) => {
      const result = await db.query(
        `select
      has_function_privilege('anon',p.oid,'execute') as anon_execute,
      has_function_privilege('authenticated',p.oid,'execute') as member_execute,
      has_function_privilege('service_role',p.oid,'execute') as service_execute
      from pg_proc p where p.oid=to_regprocedure($1)`,
        [entry.signature],
      );
      expect(result.rows).toEqual([
        {
          anon_execute: entry.anon_execute,
          member_execute: entry.member_execute,
          service_execute: entry.service_execute,
        },
      ]);
    },
  );

  it("rejects service-role calls to member removal and owner scheduling", async () => {
    for (const sql of [
      "select public.delete_my_account()",
      "select public.my_account_removal()",
      "select public.close_due_proposals()",
    ]) {
      await expect(act(null, sql, [], "service_role")).rejects.toThrow(
        /permission denied/,
      );
    }
  });
});
