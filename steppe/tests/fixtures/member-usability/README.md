# Isolated member usability browser fixture

From `steppe/`, run:

```sh
npx vite --config tests/fixtures/member-usability/vite.config.mjs
```

Open `http://127.0.0.1:8771`. This mounts the actual Event, Post, Profile, RSVP, DeletePost and AddToCalendar components with synthetic records. All actions and location responses are local fixtures. No real user, email, provider or database is contacted. It is excluded from the application build.

Use Screen/Language to switch views and Fail saves to exercise errors. Successful writes counts only successful fixture actions. Verify no write before profile Save, saved privacy restoration after failure, RSVP save/cancel/reset, multi-tag edit prefill, draft retention and delete confirmation. Calendar copy/download use the real implementation. The calendar screen shows the last successfully copied clipboard value and can simulate clipboard failure. Check individual field copies, full details, English/Spanish feedback, keyboard access and manual-copy fallback.

Local database proof uses a disposable loopback database named `steppe_pipelines_test`. First run `tests/fixtures/account-removal-database.mjs`, then `tests/fixtures/post-tags-local.mjs`, both with `MEMBER_PIPELINE_TEST_DB_URL` pointing at that empty local database. Both reject non-loopback URLs. Never use a hosted database.

## Provider error recovery

Open `http://127.0.0.1:8771/auth-error-callback#error=server_error&error_code=identity_already_exists&error_description=do-not-display`.
The local redirect reproduces fragment inheritance from an OAuth callback. The
real AuthNotice should show the account-conflict explanation and a fixed link to
Sign-in methods, replace the raw fragment with `issue=identity-linked`, and retain
the explanation after reload. Switch Language to Spanish and check keyboard focus
on the recovery link at mobile width. Use `error=access_denied` instead to check
generic feedback and fragment cleanup. No raw description should appear.
