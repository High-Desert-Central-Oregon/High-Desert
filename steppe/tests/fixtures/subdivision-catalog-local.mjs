// Seed-only migration proof. Explicitly refuses hosted or non-disposable databases.
import pg from "pg";
import fs from "node:fs";
import assert from "node:assert/strict";
const connectionString = process.env.SUBDIVISION_TEST_DB_URL;
const url = new URL(connectionString ?? "invalid:");
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
  url.pathname !== "/steppe_outlines_test"
)
  throw new Error("Empty loopback steppe_outlines_test database required");
const db = new pg.Client({ connectionString });
await db.connect();
try {
  if (
    (await db.query("select to_regclass('public.neighborhoods') existing"))
      .rows[0].existing
  )
    throw new Error(
      "Use an empty disposable database; existing records will not be erased",
    );
  await db.query("begin");
  const schema = fs.readFileSync("../schema.sql", "utf8");
  const table = schema.match(/create table neighborhoods \([\s\S]*?\n\);/)?.[0];
  assert.ok(table);
  await db.query(table);
  await db.query(
    "create table public.profiles (id uuid primary key default gen_random_uuid(), neighborhood_id uuid references public.neighborhoods(id))",
  );
  const old = JSON.parse(
    fs.readFileSync("scripts/maps/source-labels.json", "utf8"),
  );
  old.push(
    ...[
      "Cinder Butte Village",
      "Eagle Crest",
      "Rimrock West Estate",
      "Village at Ridgeview",
    ].map((name) => ({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    })),
  );
  for (const row of old)
    await db.query(
      "insert into public.neighborhoods(slug,name) values($1,$2)",
      [row.slug, row.name],
    );
  const before = (
    await db.query(
      "select id,slug,name from public.neighborhoods order by slug",
    )
  ).rows;
  assert.equal(before.length, 267);
  const saved = before.find((row) => row.slug === "braydon-park").id;
  await db.query("insert into public.profiles(neighborhood_id) values($1)", [
    saved,
  ]);
  const body = fs
    .readFileSync(
      "../migrations/0041_current_subdivision_neighborhoods.sql",
      "utf8",
    )
    .replace(/^begin;\s*$/im, "")
    .replace(/^commit;\s*$/im, "");
  await db.query(body);
  const first = (
    await db.query(
      "select id,slug,name from public.neighborhoods order by slug",
    )
  ).rows;
  assert.equal(first.length, 334);
  assert.deepEqual(
    first.filter((row) => before.some((old) => old.slug === row.slug)),
    before,
  );
  await db.query(body);
  assert.deepEqual(
    (
      await db.query(
        "select id,slug,name from public.neighborhoods order by slug",
      )
    ).rows,
    first,
  );
  assert.equal(
    (await db.query("select neighborhood_id from public.profiles")).rows[0]
      .neighborhood_id,
    saved,
  );
  assert.ok(first.some((row) => row.slug === "121-west"));
  const source = JSON.parse(
    fs.readFileSync("public/maps/redmond-current/catalog.json", "utf8"),
  );
  for (const row of source.neighborhoods)
    assert.ok(
      first.some(
        (record) => record.slug === row.slug && record.name === row.name,
      ),
    );
  console.log(
    "PASS: 67 additions, 334 choices, 319 county names represented, all 267 old IDs/names and saved profile preserved; second application unchanged",
  );
} finally {
  await db.query("rollback");
  await db.end();
}
