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

## Owner release steps

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

This is an engineering implementation record, not a new governing instrument.
