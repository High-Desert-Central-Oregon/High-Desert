// Run after account-removal-database.mjs on a disposable loopback database only.
import pg from "pg";
import assert from "node:assert/strict";
const url = new URL(process.env.MEMBER_PIPELINE_TEST_DB_URL ?? "invalid:");
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
  url.pathname !== "/steppe_pipelines_test"
)
  throw new Error("Disposable loopback test database required");
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
const owner = "33333333-3333-4333-8333-333333333333",
  other = "44444444-4444-4444-8444-444444444444";
async function asUser(id, sql, values = []) {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id }),
    ]);
    const result = await db.query(sql, values);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}
const feed = async (token) =>
  (await db.query("select public.calendar_feed_payload($1) payload", [token]))
    .rows[0].payload;
try {
  await db.query(
    "insert into auth.users(id,email) values ($1,'event-owner@example.invalid'),($2,'event-member@example.invalid')",
    [owner, other],
  );
  await db.query("update profiles set verified=true where id=any($1::uuid[])", [
    [owner, other],
  ]);
  const create = async (creator, title) =>
    (
      await asUser(
        creator,
        "insert into events(creator_id,title,starts_at,ends_at,location) values ($1,$2,now()+interval '2 days',now()+interval '2 days 1 hour','Old park') returning id",
        [creator, title],
      )
    ).rows[0].id;
  const event = await create(owner, "Owner test"),
    untouched = await create(other, "Unrelated event");
  for (const id of [event, untouched])
    await asUser(
      other,
      "insert into event_rsvps(event_id,user_id,status,bringing) values ($1,$2,'going','Blanket')",
      [id, other],
    );
  // Synthetic capability for this local fixture only; never printed.
  const token = "e".repeat(64);
  await db.query("insert into calendar_feeds(member_id,token) values ($1,$2)", [
    other,
    token,
  ]);
  assert.equal((await feed(token)).events.length, 2);
  const before = (
    await db.query("select * from event_rsvps where event_id=$1", [event])
  ).rows;
  assert.equal(
    (
      await asUser(
        other,
        "update events set title='Not mine' where id=$1 returning id",
        [event],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await asUser(other, "delete from events where id=$1 returning id", [
        event,
      ])
    ).rowCount,
    0,
  );
  await assert.rejects(
    asUser(owner, "update events set creator_id=$1 where id=$2", [
      other,
      event,
    ]),
    /permission denied/,
  );
  await asUser(
    owner,
    "update events set title='Updated gathering', location='New park', starts_at=starts_at+interval '1 day', ends_at=ends_at+interval '1 day' where id=$1",
    [event],
  );
  assert.deepEqual(
    (await db.query("select * from event_rsvps where event_id=$1", [event]))
      .rows,
    before,
  );
  const edited = (await feed(token)).events.find((row) => row.id === event);
  assert.equal(edited.title, "Updated gathering");
  assert.equal(edited.location, "New park");
  assert.equal(
    new Date(edited.starts_at).toISOString(),
    (
      await db.query("select starts_at from events where id=$1", [event])
    ).rows[0].starts_at.toISOString(),
  );
  await db.query("update profiles set role='moderator' where id=$1", [other]);
  assert.equal(
    (
      await asUser(other, "delete from events where id=$1 returning id", [
        event,
      ])
    ).rowCount,
    0,
  );
  const moderation = (
    await db.query(
      "insert into moderation_actions(target_type,target_id,actor_id,action,reason) values ('event',$1,$2,'remove','Local fixture') returning id",
      [event, other],
    )
  ).rows[0].id;
  assert.equal(
    (
      await asUser(owner, "delete from events where id=$1 returning id", [
        event,
      ])
    ).rowCount,
    1,
  );
  assert.equal(
    (await db.query("select * from event_rsvps where event_id=$1", [event]))
      .rowCount,
    0,
  );
  assert.equal(
    (await db.query("select * from event_rsvps where event_id=$1", [untouched]))
      .rowCount,
    1,
  );
  assert.equal(
    (
      await db.query("select * from moderation_actions where id=$1", [
        moderation,
      ])
    ).rowCount,
    1,
  );
  const remaining = (await feed(token)).events;
  assert.deepEqual(
    remaining.map((row) => row.id),
    [untouched],
  );
  console.log(
    "PASS: creator edit/delete, non-owner refusals, identity grants, RSVP preservation and scoped cascade, current calendar payload, permanent moderation record retained",
  );
} finally {
  await db.end();
}
