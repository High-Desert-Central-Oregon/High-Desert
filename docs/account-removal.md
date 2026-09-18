# Administrator account removal

An active administrator can open **People and invitations → Remove an account**,
look up an exact email address, review the account, choose a reason, and type the
email again. The administrator must acknowledge that removal is permanent.
Moderators and support operators cannot use this control. Their accounts, other
administrators, and the caller's own account are protected from this workflow.

Removal immediately disables the old account and deletes its personal app
content, signup details, and invitation records. The app then removes private
verification files through the Storage API and **soft-deletes** the Auth identity.
It never hard-deletes the Auth or profile rows: ballots, consents, proposals,
moderation records, and audit history retain their original UUID references.
Other participants' messages remain. Retained civic content is not rewritten;
its text can still contain details supplied by its author.

If an external service fails, **Unfinished removals → Finish cleanup** resumes the
same account by UUID. Access stays disabled. The old email cannot be invited
again until cleanup is acknowledged. The pending email is erased at completion.
Inviting the address again is a separate action; the resulting account starts
unverified and completes the normal verification flow.

## Release order

1. Run the local tests below and review migration `0038_account_removal.sql`.
2. The owner applies 0038 in Supabase's SQL editor after 0037. The migration does
   not remove any accounts. It adds the workflow and stale-session protections.
3. Merge/deploy the application. `MEMBER_PIPELINES_ENABLED=true` is required.
   The removal link remains hidden if the migration is unavailable.
4. Verify with an explicitly approved disposable account: preview, incorrect
   confirmation, removal, pending cleanup retry if needed, a new invitation,
   fresh signup and normal verification. Confirm old sessions cannot read/write.
   Real Storage/Auth behavior requires this hosted verification; the local
   fixture below simulates those services' acknowledgements.

The rollout changes authenticated access on every currently RLS-enabled public
table, private Storage, and the three deliberate owner-rights views. It preserves
their existing policies and projections. Future tables/views must include the
same active-account boundary. Future definer mutation paths must retain the write
guard. Anonymous public website access is unchanged.

## Local verification

Use a new disposable PostgreSQL 16 container, published on loopback port 55443,
with password `steppe-test-only` and an empty database `steppe_pipelines_test`.
From `steppe/`:

```sh
export MEMBER_PIPELINE_TEST_DB_URL=postgresql://postgres:steppe-test-only@127.0.0.1:55443/steppe_pipelines_test
node tests/fixtures/account-removal-database.mjs
npm run test:member-pipelines
npx tsc --noEmit
```

The fixture refuses non-loopback URLs, other database names, or an existing
application schema. It installs the baseline and migrations, with minimal local
Auth and Storage tables. It does not connect to a hosted Supabase project.

The existing self-service deletion action is separate. This release does not
replace that action's older best-effort Auth cleanup with the administrator job.
