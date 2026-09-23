// Run after account-removal-database.mjs on a disposable loopback database only.
import pg from "pg";
import fs from "node:fs";
import assert from "node:assert/strict";
const url = new URL(process.env.MEMBER_PIPELINE_TEST_DB_URL ?? "invalid:");
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
  url.pathname != "/steppe_pipelines_test"
)
  throw new Error("Disposable loopback test database required");
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
async function asUser(id, sql, values = []) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id }),
    ]);
    const r = await db.query(sql, values);
    await db.query("commit");
    return r;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
try {
  await db.query(
    "insert into auth.users(id,email) values ($1,'a@example.invalid'),($2,'b@example.invalid')",
    [a, b],
  );
  await db.query("update profiles set verified=true where id=any($1::uuid[])", [
    [a, b],
  ]);
  const group = (await db.query("select id from groups where slug='everyone'"))
    .rows[0].id;
  const legacy = (
    await asUser(
      a,
      "insert into posts(group_id,author_id,category,title,body) values ($1,$2,'offer','Test','Content') returning id",
      [group, a],
    )
  ).rows[0].id;
  await db.query(
    fs.readFileSync(
      new URL("../../../migrations/0039_post_tags.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    (await db.query("select tags from posts where id=$1", [legacy])).rows[0]
      .tags,
    ["offer"],
  );
  await asUser(
    a,
    "update posts set tags=array['offer','goods'],body='Updated' where id=$1",
    [legacy],
  );
  const edited = (
    await db.query("select tags,edited_at from posts where id=$1", [legacy])
  ).rows[0];
  assert.deepEqual(edited.tags, ["offer", "goods"]);
  assert.ok(edited.edited_at);
  assert.equal(
    (
      await asUser(
        b,
        "update posts set title='Not mine' where id=$1 returning id",
        [legacy],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (await asUser(b, "delete from posts where id=$1 returning id", [legacy]))
      .rowCount,
    0,
  );
  await assert.rejects(
    asUser(a, "update posts set tags=array['unknown'] where id=$1", [legacy]),
    /primary category|check constraint/,
  );
  await assert.rejects(
    asUser(a, "update posts set tags=array['goods'] where id=$1", [legacy]),
    /primary category/,
  );
  await assert.rejects(
    asUser(a, "update posts set author_id=$1 where id=$2", [b, legacy]),
    /permission denied/,
  );
  await asUser(a, "update posts set category='need' where id=$1", [legacy]);
  assert.deepEqual(
    (await db.query("select tags from posts where id=$1", [legacy])).rows[0]
      .tags,
    ["need"],
  );
  const newRow = (
    await asUser(
      a,
      "insert into posts(group_id,author_id,category,title,body) values ($1,$2,'offer','Legacy client','Still works') returning tags",
      [group, a],
    )
  ).rows[0];
  assert.deepEqual(newRow.tags, ["offer"]);
  assert.equal(
    (await asUser(a, "delete from posts where id=$1 returning id", [legacy]))
      .rowCount,
    1,
  );
  console.log(
    "PASS: migration backfill, multiple tags, category consistency, legacy client, owner edit/delete, non-owner denial, identity grants",
  );
} finally {
  await db.end();
}
