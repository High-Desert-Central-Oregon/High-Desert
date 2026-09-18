// Disposable, empty local Postgres fixture only; never a hosted Supabase project.
import pg from "pg";
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
create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,deleted_at timestamptz,raw_user_meta_data jsonb default '{}');
grant all on auth.users to supabase_auth_admin;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema storage to authenticated,service_role;
grant all on storage.objects to authenticated,service_role;
`);
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  for (const name of [
    "schema.sql",
    "migrations/0017_event_category.sql",
    "migrations/0018_posts.sql",
    "migrations/0019_post_appeals.sql",
    "migrations/0020_calendar_feeds.sql",
    "migrations/0021_reports.sql",
    "migrations/0022_messages.sql",
    "migrations/0023_profile_visibility.sql",
    "migrations/0026_neighborhood_pledges.sql",
    "migrations/0024_invited_emails.sql",
    "migrations/0027_invite_tokens.sql",
    "migrations/0028_view_grants_and_invoker.sql",
    "migrations/0029_search_path_sweep.sql",
    "migrations/0030_view_owner_rights_restore.sql",
    "migrations/0031_join_signup_source.sql",
    "migrations/0033_governance_outcomes.sql",
    "migrations/0034_message_deletion_consistency.sql",
    "migrations/0035_beta_bug_reports.sql",
    "migrations/0036_individual_invitations.sql",
    "migrations/0037_verification_review_workflow.sql",
  ]) {
    await db.query(fs.readFileSync(root + name, "utf8"));
  }
  for (const name of [
    "0016_verification_evidence_bucket.sql",
    "0038_account_removal.sql",
  ])
    await db.query(fs.readFileSync(root + "migrations/" + name, "utf8"));
  console.log("Local account-removal fixture ready");
} finally {
  await db.end();
}
