import pg from "pg";
export const target = process.env.MEMBER_PIPELINE_TEST_DB_URL;
if (target) {
  const url = new URL(target);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/steppe_pipelines_test"
  )
    throw new Error(
      "Disposable loopback steppe_pipelines_test database required",
    );
}
export function securityDb() {
  const db = new pg.Client({ connectionString: target });
  async function act(
    uid: string | null,
    sql: string,
    values: unknown[] = [],
    role = "authenticated",
  ) {
    if (!["authenticated", "service_role", "anon"].includes(role))
      throw new Error("Invalid test role");
    await db.query("begin");
    try {
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: uid, role }),
      ]);
      await db.query(`set local role ${role}`);
      const result = await db.query(sql, values);
      await db.query("commit");
      return result;
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  }
  return { db, act };
}
