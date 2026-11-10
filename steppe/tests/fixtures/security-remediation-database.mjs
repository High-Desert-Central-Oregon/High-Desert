// Disposable, empty local Postgres fixture only; never a hosted Supabase project.
import pg from "pg";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const connectionString = process.env.MEMBER_PIPELINE_TEST_DB_URL;
const url = new URL(connectionString ?? "invalid:");
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
  url.pathname !== "/steppe_pipelines_test"
)
  throw new Error("Isolated loopback steppe_pipelines_test database required");
const db = new pg.Client({ connectionString });
await db.connect();
try {
  if (
    (await db.query("select to_regclass('public.profiles') existing")).rows[0]
      .existing
  )
    throw new Error(
      "Fixture needs an empty database; no existing records will be erased",
    );
  await db.query(`do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
 if not exists(select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login password 'steppe-test-only'; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
grant usage on schema auth,public to anon,authenticated,service_role,supabase_auth_admin;
create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,deleted_at timestamptz,raw_user_meta_data jsonb default '{}',instance_id uuid,aud text,role text,encrypted_password text,raw_app_meta_data jsonb default '{}',created_at timestamptz,updated_at timestamptz,confirmation_token text,recovery_token text,email_change_token_new text,email_change text);
grant all on auth.users to supabase_auth_admin;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz not null default now(),unique(bucket_id,name));
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema storage to authenticated,service_role;
grant all on storage.objects to authenticated,service_role;
`);
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  // Hosted defaults grant these roles EXECUTE directly, independently of PUBLIC.
  await db.query(`alter default privileges in schema public
    grant execute on functions to anon,authenticated,service_role;`);
  await db.query(fs.readFileSync(root + "schema.sql", "utf8"));
  // Observed hosted votes ACLs: broad direct grants survive the base schema,
  // except TRUNCATE, which the append-only boundary already revokes.
  // Target this table only; do not invent hosted defaults for unrelated tables.
  await db.query(`grant all privileges on public.votes to anon,authenticated,service_role;
    revoke truncate on public.votes from anon,authenticated,service_role;`);
  await db.query(`create schema extensions;
create function extensions.gen_random_bytes(integer) returns bytea language sql volatile as $$ select public.gen_random_bytes($1) $$;`);
  for (const name of fs.readdirSync(root + "migrations").sort()) {
    if (name.startsWith("0050_")) {
      const uid = randomUUID();
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        uid,
        `${uid}@example.test`,
      ]);
      const event = (
        await db.query(
          "insert into events(group_id,creator_id,title,starts_at) select id,$1,'Legacy future action fixture',now() from groups where slug='everyone' returning id",
          [uid],
        )
      ).rows[0].id;
      await db.query(
        "insert into moderation_actions(actor_id,target_type,target_id,action,reason,created_at) values($1,'event',$2,'remove','Security fixture legacy future action','2099-01-01')",
        [uid, event],
      );
    }
    if (/^\d+_.*\.sql$/.test(name) && Number(name.split("_")[0]) > 15)
      await db.query(fs.readFileSync(root + "migrations/" + name, "utf8"));
  }
  console.log("Local security-remediation fixture ready");
} finally {
  await db.end();
}
