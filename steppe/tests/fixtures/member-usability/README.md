# Isolated member usability browser fixture

From `steppe/`, run:

```sh
npx vite --config tests/fixtures/member-usability/vite.config.mjs
```

Open `http://127.0.0.1:8771`. This mounts the actual Event, Post, Profile, RSVP, DeletePost and AddToCalendar components with synthetic records. All actions and location responses are local fixtures. No real user, email, provider or database is contacted. It is excluded from the application build.

Use Screen/Language to switch views and Fail saves to exercise errors. Successful writes counts only successful fixture actions. Verify no write before profile Save, saved privacy restoration after failure, RSVP save/cancel/reset, multi-tag edit prefill, draft retention and delete confirmation. Calendar copy/download use the real implementation. The calendar screen shows the last successfully copied clipboard value and can simulate clipboard failure. Check individual field copies, full details, English/Spanish feedback, keyboard access and manual-copy fallback.

Local database proof uses a disposable loopback database named `steppe_pipelines_test`. First run `tests/fixtures/account-removal-database.mjs`, then `tests/fixtures/post-tags-local.mjs`, both with `MEMBER_PIPELINE_TEST_DB_URL` pointing at that empty local database. Both reject non-loopback URLs. Never use a hosted database.
