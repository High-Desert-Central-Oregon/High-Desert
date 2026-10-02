# Messaging consent rollout

Approved implementation order, 2026-10-02:

1. **Contact Steppe** — Messages and Help link to a named support contact, with
   explicit account-name/message disclosure before sending. Signed-in members
   awaiting verification can start and reply to this conversation. Only the two
   participants read it; another admin, moderator or support operator gains no
   access. Keep the current inbox, unread dot, safety valves and draft recovery.
2. **Post opt-in** — creation/editing exposes an explicit permission to receive
   messages about that post. An existing post is not automatically opted in.
   Restore the same participant messaging affordance for admins/moderators.
3. **Group messaging and requests** — eligible members can contact one another
   when the group's messaging rules were shown and acknowledged. New rules need
   acknowledgment from existing members. Keep individual group-contact controls
   under You. The first message is a request with Accept, Decline and Block;
   further messages wait for acceptance. Consent gates live in the database.

Stage 1 supersedes the M1 spec's post-only start rule only for Contact Steppe.
It does not implement general profile/roster DMs or the later permission model.
New member contact remains verified and post-scoped elsewhere until those
stages are reviewed, migrated and deployed.

## Stage 1 delivery and privacy

`0042_contact_steppe.sql` adds a private singleton support destination and
pins that participant on a thread. The approved beta account is resolved by
email only during owner migration apply; it must already be an active, verified
admin. Otherwise the app shows an email fallback. No other admin is selected.

`start_support_thread(text)` accepts no recipient or sender input. It checks the
live caller, destination, blocks and body bounds. A prior conversation with the
same admin is reused and explicitly marked as Contact Steppe; its first post
anchor and history are preserved. The requester sees the named recipient and
sharing explanation before starting/continuing, and in the thread itself.

Twenty requester support messages per rolling day is provisional beta config,
enforced at message INSERT with a per-sender transaction lock. Direct REST/RLS
replies cannot bypass it. The support contact's replies have no shared quota.
Turning off or changing the contact freezes sends in old support threads and
does not hand old history to the replacement contact. Participants retain their
own read access. Block/report exceptions for unverified members apply only to
their own support conversation. Support messages use existing account deletion;
authored messages are included in account export. No message content or private
relationship event is added to email, analytics, or the append-only audit log.

## Stage 1 owner release steps

1. Apply migration 0042 in the SQL editor as owner after reviewing local test
   evidence. No matrix or fixture should run against production.
2. Confirm it found the intended verified admin:

   ```sql
   select p.display_name, p.role, p.verified
   from public.steppe_contact_settings c
   join public.profiles p on p.id = c.contact_id;
   ```

   If there is no row, resolve the intended account's standing before setting a
   contact. The app retains email support while no eligible contact is configured.
3. Merge the app PR and verify the canonical commit reaches the deployment.
4. With designated test accounts, submit one clearly labeled support question,
   reply as the contact and inspect the member's inbox/unread indicator. Verify
   another admin cannot read it. This hosted acceptance is separate from local
   database and synthetic component results.

## Stage 2 post permission

`0043_post_messaging_opt_in.sql` adds `posts.allow_messages`, a required boolean
that defaults to false for existing posts and older clients. The create/edit
form has an unchecked native checkbox with bilingual sharing and safety copy.
Editing initializes it from the saved value; returned save errors retain the
draft choice. Only the author can change it. A change stamps `edited_at`.

An eligible verified reader, including an admin/moderator participating as a
member, sees Message neighbor only when the author allows it. Owners see their
current permission and can change it in Edit post. Other readers see a clear
messages-off explanation. Moderation authority grants no conversation access.

`start_thread` enforces consent even for an existing pair: post author, active
board membership, visible post, explicit opt-in, live verified participants and
bidirectional blocks. Missing, unreadable, hidden, wrong-author and opted-out
posts get the same refusal. A row lock serializes this check with a concurrent
opt-out or deletion. Direct thread creation remains unavailable to members.
No new account-level or roster contact path is added.

Turning the option off stops contact through that post. Existing conversations
remain available in Messages and may receive replies under the existing rules;
Block stops both directions. The first post anchor/history and one-thread-per-
pair rule are preserved. Deleting a post clears its anchor while preserving the
private conversation. Contact Steppe, including pending-member support, is
unchanged. Group consent and first-contact requests remain stage 3 work.

### Stage 2 owner release steps

1. Review and apply `0043_post_messaging_opt_in.sql` in the production SQL editor
   as owner **before merging the app change**. It depends on 0039 and 0042.
   Reapplying it preserves explicit author choices. Never run test fixtures or
   the database matrix against production.
2. Read-only checks, before any author opts in:

   ```sql
   select count(*) filter (where allow_messages) as opted_in_posts,
          count(*) filter (where allow_messages is null) as null_permissions
   from public.posts;
   ```

   Both should be zero on first apply. A retry can legitimately have opted-in
   posts. No backfill may automatically opt an author in.
3. Merge the app PR, then confirm the canonical commit reaches production.
4. Using designated test posts/accounts, verify new default off; opt-in/edit/save/
   reload; member and admin participant composer; failed-send draft retention;
   opt-out preventing contact through the post while inbox replies remain open;
   and Block stopping both directions. Remove test posts only with owner approval.

### Local validation

Use the empty loopback database `steppe_pipelines_test` created by
`steppe/tests/fixtures/account-removal-database.mjs`, then apply 0039, 0042 and
0043 locally. The guard prevents using a hosted URL or an existing database.
Run the database suites sequentially because support tests use singleton routing:

```sh
POST_MESSAGING_TEST_DB_URL="$LOCAL_FIXTURE_URL" \
CONTACT_STEPPE_TEST_DB_URL="$LOCAL_FIXTURE_URL" \
npm run test:member-pipelines -- tests/member-pipelines-post-messaging-db.test.ts \
  tests/member-pipelines-contact-db.test.ts --no-file-parallelism
```

The real Post form is mounted by the isolated member-usability browser fixture.
Verify unchecked creation, `?screen=edit&post-messages=on` saved prefill, checkbox
keyboard/label access, returned-error retention and EN/ES mobile wrapping.
These local proofs do not substitute for the hosted owner acceptance above.

This is an engineering implementation record, not a new governing instrument.
