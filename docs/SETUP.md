# Setup

How to stand up Steppe from scratch — the Supabase backend and a local app. Repeatable
for a fresh environment (and for another community standing up their own instance).

**Prerequisites:** Node.js and git installed, plus a free [Supabase](https://supabase.com)
account. The repo's `schema.sql`, `CLAUDE.md`, and `SPEC.md` are referenced throughout.

> The database **is** the enforcement layer. Most of the guarantees (access control,
> vote weight, verify-then-forget) live in `schema.sql` as RLS and triggers — the steps below
> just stand that up and connect an app to it.

---

## 1. Create the Supabase project

1. Sign in at supabase.com and create a **New project**.
2. Set a strong **database password** and save it somewhere safe (you'll need it for direct
   Postgres connections).
3. Choose the region closest to Central Oregon (a **US West** region).
4. Wait ~2 minutes for provisioning.

## 2. Run the schema

1. **SQL Editor → New query.**
2. Paste the entire contents of `schema.sql` and **Run**.
3. Run it **once** on a fresh project — the script is not idempotent, so re-running errors on
   objects that already exist. (To start over: pause/restart isn't enough — drop the objects or
   create a new project.)
4. Confirm in **Table Editor** that the tables exist and show RLS enabled (a lock icon).

## 3. Storage: the verification-evidence bucket + policies

1. **Storage → New bucket.** Name it exactly `verification-evidence` and set it **Private**
   (not public). Create.
2. Add two access policies. Easiest is to paste them into the **SQL Editor** (storage policies
   are just RLS on `storage.objects`) — they're also in the notes at the bottom of `schema.sql`:

   ```sql
   -- Members can upload only into a folder named after their own user id.
   create policy "evidence upload (own folder)" on storage.objects
     for insert to authenticated
     with check (
       bucket_id = 'verification-evidence'
       and (storage.foldername(name))[1] = auth.uid()::text
     );

   -- Only moderators/admins can read evidence. Members never read files — their own included.
   create policy "evidence read (moderators)" on storage.objects
     for select to authenticated
     using (
       bucket_id = 'verification-evidence'
       and public.is_moderator()
     );
   ```

   If you'd rather use the dashboard UI (**Storage → Policies → New policy**): make two separate
   policies — one **INSERT** (target role `authenticated`, the `with check` body above) and one
   **SELECT** (target role `authenticated`, the `using` body above). Don't leave target roles on
   "all (public) roles," and don't combine both operations into one policy (their rules differ).
3. **No UPDATE or DELETE policy is needed.** The evidence file is removed server-side by an edge
   function when `decide_verification()` runs (the secret key bypasses RLS). The DB drops the
   pointer; the function drops the file — the "forget" half of verify-then-forget. See
   *What's stubbed* below.

## 4. API keys + environment

Supabase's current key system (since mid-2025) uses **publishable** keys (`sb_publishable_…`,
safe to expose) and **secret** keys (`sb_secret_…`, server-only). The legacy `anon` /
`service_role` JWT keys still work but are slated for removal in late 2026 — use the new keys.

1. Open the project's **Connect** dialog (or **Settings → API Keys**). If there's no publishable
   key yet, click **Create new API keys**.
2. Copy `.env.example` to `.env.local` and fill in the **project URL** and **publishable key**:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. The **secret key** (`sb_secret_…`) is server-only — never prefix it with `NEXT_PUBLIC_` (that
   inlines it into the client bundle) and never expose it to the browser. It powers the
   service-role admin client, used for exactly two privileged tasks: deleting verification
   evidence on a decision, and scrubbing the auth identity on account deletion.

`.env.local` is gitignored; never commit real keys.

## 5. Auth (magic link)

1. **Authentication → Providers:** Email is enabled by default, which covers magic links.
2. **Authentication → URL Configuration:** set **Site URL** to `http://localhost:3000` for local
   dev (add your production URL later) so magic-link redirects resolve.
3. The built-in email sender works for the founding cohort but is rate-limited — wire up a real
   SMTP provider (e.g. Resend) before launch.

## 6. Make yourself an admin

1. Sign in once through the app, or add a user via **Authentication → Users → Add user**, so the
   signup trigger creates your `profiles` row.
2. Copy your user id from the Users list, then in the **SQL Editor**:

   ```sql
   update profiles set role = 'admin' where id = '<your-auth-user-id>';
   ```

## 7. Verify the seed

In **Table Editor**, confirm:
- `neighborhoods` has its 35 Redmond rows.
- `documents` has the Terms and Privacy placeholder rows.
- Tables show RLS enabled.

That's a working backend.

---

## Running the app

With `.env.local` in place:

```bash
npm install
npm run dev      # http://localhost:3000
```

**Building with Claude Code:** run `claude` in the repo root — it reads `CLAUDE.md` (invariants +
build order) and `SPEC.md` (per-feature plan).

The current Supabase client path for the Next.js App Router is `@supabase/supabase-js` +
`@supabase/ssr` (the older `auth-helpers` package is deprecated): a browser client for Client
Components, a server client for Server Components / Server Actions / Route Handlers, and
middleware to refresh sessions. In server code, verify the user with `supabase.auth.getUser()`
so the token is checked against the auth server rather than trusting the session — which matches
the never-trust-the-client invariant. For a working scaffold to adapt, `npx create-next-app -e
with-supabase` wires up `@supabase/ssr` (swap its password block for magic link).

## Setup still needed

The two former code stubs are now implemented; what remains is environment setup
(see `schema.sql` notes and `CLAUDE.md`):
- **Evidence file deletion** — *implemented in-app.* On a verification decision, the
  `decideVerification` server action deletes the Storage object via the service-role client
  *before* it commits (delete-before-commit, so a failure can't orphan a file), and the DB nulls
  the `evidence_path` pointer. Setup: create the private `verification-evidence` bucket + its
  policies (schema NOTES) and set the secret key.
- **Scheduled proposal closing** — *implemented* as `close_due_proposals()` + a pg_cron schedule
  (`migrations/0010_scheduled_close.sql`). Setup: enable the `pg_cron` extension and run the
  `cron.schedule(...)` call. A moderator can still record a close manually (idempotent).
- **Transactional email** — production SMTP for magic links and notices (still to wire).

---

*Part of the Steppe documentation, licensed CC BY-SA 4.0 (see `docs/LICENSE`).*
