<!--
  DRAFT SCAFFOLD — pending legal review.

  This is the single source of truth for /legal/privacy. The page reads this
  file at build, strips [CONFIRM …] reviewer blockquotes, reports remaining
  bracketed review items, and stays noindex until counsel signs off.

  Organizational and data-responsibility facts were updated 2026-08-29 from
  the founder's confirmed operating instructions. They are not represented as
  legal advice or counsel approval.
-->

# Privacy Policy

```
Effective date:  On publication for the founding beta
Version:         Draft v2.1
Last updated:    September 25, 2026
Status:          Draft (pending legal review)
```

Steppe is ad-free civic infrastructure in development for Redmond and Central
Oregon. Steppe has a signed fiscal-sponsorship agreement with Ignite Empowerment
Foundation, a Central Oregon 501(c)(3). Gregory Chism operates the member app and
handles member data. Ignite handles sponsor-routed grants, donations, and other
sponsored responsibilities, but does not routinely handle the membership
database or member subscriptions. A particular contract may be handled by
Gregory Chism or Ignite; the contract will identify its actual party.

This policy explains what the founding beta collects, why, who handles it, and
the choices members have. The plain-language summary is at
[steppe.community/privacy](/privacy).

> [CONFIRM: counsel — identify the legally correct contracting/controller name
> for Gregory Chism's beta operations and the required Ignite project wording.]

## 1. Information We Collect

We collect the minimum needed for the interest list and, once beta accounts are
enabled, a verified local community.

| Category | Examples | Why we collect it |
| --- | --- | --- |
| Beta interest | Email; optional first name and area response; explicit email consent | Send the one beta-readiness notice requested |
| Account basics | Email, display name, language | Sign-in and member-to-member contact |
| Optional Google sign-in | Google account identifier, email, and basic profile information supplied by Google | Authenticate and maintain the chosen sign-in connection |
| Residency check | Proof of local address | Intended for one eligibility decision; collection remains closed until deletion and orphan cleanup are verified |
| Member content | Listings, messages, group activity, votes | Provide the service the member requested |
| Safety intake | A report and an excerpt a participant chooses to disclose | Let a human moderator review the report |
| Technical support | Problem description, optional expected result and reply email; account association when signed in; optional reviewed technical details | Investigate and resolve a reported problem |
| Minimal logs | Basic technical and security records | Keep the service working and safe |

The founding beta is free and does not collect member subscription payments.
Before paid membership begins, this policy and the checkout flow will name the
payment provider and describe the data it receives. Gregory Chism will administer
member subscriptions directly rather than routing them through Ignite.

## 2. How We Use Information

We use information to operate the beta list and member service, verify local
eligibility, provide the exchange, groups, messages, and governance, send service
email, respond to reports, and secure the platform. We do not use member data for
advertising or behavioral profiling, and we do not sell it.

Contact-form messages are delivered through Resend to the Steppe inbox. They are
not stored in the app. Direct messages are readable in the app only by the two
participants; moderators and administrators have no message-reader interface.
Database operators can technically access plaintext stored in the database, but
Steppe policy and ordinary tooling prohibit routine access.

### Optional Google sign-in

You can sign in with email or choose Google. When you choose Google, Google
shares your account identifier, email address, and basic profile information,
such as your name and profile picture when available, with Steppe through
Supabase, our authentication provider. Supabase stores the linked sign-in
identity so Steppe can recognize your account. We use this information to sign
you in and manage the connection to your Steppe account. Your chosen Steppe
display name remains separate from your Google profile.

Steppe requests only basic identity, email, and profile permissions. Google
sign-in does not give Steppe access to your Gmail messages, contacts, calendars,
or Drive files. Google does not share your password with Steppe. We do not sell
Google account information or use it for advertising or behavioral profiling.

You can remove Steppe’s access in your Google Account’s third-party connections
settings. Removing that access does not delete your Steppe account or its stored
data. To request deletion of Steppe account data, contact
hello@steppe.community; the full policy explains retention and deletion limits.
Google’s own privacy policy applies to its handling of the sign-in process.

### Optional bug reports and crash monitoring

The beta's **Report a bug** control sends your description, normalized page name,
language and app release to Steppe. Signed-in reports are linked to your account.
You may add an expected result or reply email. Please leave out passwords, sign-in
codes, residency documents and private messages.

Technical history is off until you turn it on. It remembers at most 100 technical
navigation/action/error events from the previous ten minutes in page-session
memory. You can inspect the history and browser, operating-system, viewport,
language, connectivity and release details before choosing to include them.
Typed field values, message contents, vote choices, screenshots, session replay
and raw exception text are excluded. Your written description may itself contain
personal information. Signing out, changing accounts or leaving the page session
clears the local history.

Separately, Sentry receives anonymous browser session health and sanitized error
records to help us detect crashes. These records exclude member identity,
submitted text, request content, browsing history and session replay. If you
choose to include technical details in a report, up to five recent error
references from that page session can connect the report to its exact Sentry
errors. Designated support operators see matching error type, time, app release
and code locations in the private case. Report descriptions and the optional
activity history stay in Steppe; they are not copied to Sentry.

## 3. Legal Bases for Processing

Where a legal basis is required, Steppe relies on the requested service or
membership agreement, explicit consent for the beta-readiness email and other
optional communications, legal obligations, and the legitimate interest in
operating a secure community service.

> [CONFIRM: counsel — confirm legal bases and jurisdictions for beta.]

## 4. How We Share Information

We do not sell or rent member information. We disclose the minimum needed to
service providers operating under contract, to Ignite when a sponsored
responsibility actually requires it, or when valid legal process requires it.

| Recipient | Purpose | What they receive |
| --- | --- | --- |
| Supabase | Authentication, database, and private verification storage | Account and app data needed to provide those services, including linked Google sign-in identity data |
| Google | Optional sign-in identity provider | The sign-in request, processed under Google’s privacy policy |
| Resend | Service email and contact-form delivery | Recipient email; contact content in transit; bug-report alerts contain only a reference and private review link, not the report description or diagnostics |
| Sentry | Browser crash health and maintenance monitoring | Anonymous session health, sanitized error/code details and maintenance check-in status; no report descriptions or optional activity history |
| Hosting/infrastructure providers | Run and secure the app | Requests and operational data needed to host it |
| Ignite Empowerment Foundation | Administer sponsored funds and responsibilities | Only information needed for the applicable sponsored matter; no routine membership-database access |
| A future payment provider | Process member subscriptions after beta | Payment and transaction data entered with that provider |

The future payment provider will be named before paid membership data is
collected. A contract handled by Ignite or Gregory Chism will identify that party
rather than treating “Steppe” as an unspecified legal entity.

## 5. Retention and Account Deletion

We do not keep member data merely because storage is available.

| Data | Retention |
| --- | --- |
| Beta-interest email | Until the notice is sent or the person asks to be removed |
| Account basics, including linked Google sign-in identity data | While the account is active; intended to be removed or scrubbed on deletion after the deletion/session-revocation gate passes |
| Residency proof | Not collected until delete-after-review and orphan cleanup are verified end to end |
| Messages | Intended to remain participant-only and to remove a person's sent messages on account deletion; both behavior and session revocation must pass the beta gate |
| Safety reports | Until resolved or the reporter deletes their account; a participant-supplied excerpt may remain even if the source conversation is later deleted |
| Consent, closed-ballot, moderation, and audit records | Kept in minimized or anonymized form when deletion would make the governance or accountability record inaccurate |
| Bug reports and private case history | Expire 30 days after submission; ordinary access ends at expiry and the next successful hourly cleanup deletes the stored content. Cleanup failure can delay physical deletion. Account deletion removes linked reports. |
| Minimal operational logs | Kept only as long as operationally needed; no fixed purge promise is made until it is technically enforced and verified |

Support operators must delete downloaded bug-report copies by the report's
30-day expiry, or earlier when handling a valid deletion request. Downloads are
separate copies and must not be placed in shared public folders. Provider recovery
copies are subject to provider retention; deleting a live record does not promise
immediate erasure of every recovery copy. If data is restored, expired reports
and previously requested deletions must be reapplied before ordinary access
resumes. The current Supabase Free plan does not provide project backups; this
does not establish a retention period for provider-internal recovery copies.

Account exports include the member's own unexpired bug reports, excluding private
support notes. Anonymous reports are not retrospectively linked after sign-in.

A valid legal hold may temporarily stop deletion of the specific records covered
by that hold. Steppe will not broaden a hold beyond its lawful scope.

## 6. Your Rights and Choices

The intended beta process lets you ask to see, export, or correct information,
withdraw optional communication consent, and delete your account. Before beta
invitations, Steppe must verify that export coverage is complete, deletion removes
ordinary account data and authored messages, and every surviving session loses
authority. Integrity-required governance, consent, moderation, and audit records
may remain attached only to a scrubbed “Former member” profile where necessary.

## 7. Security

Steppe uses access controls, row-level database rules, least-privilege service
credentials, private verification storage, and human review for consequential
moderation. No system is perfectly secure. Steppe will give notices required by
applicable breach law.

## 8. Children's Privacy

The founding beta is for adults and is not directed to children. A version for
ages 13–17 will not launch without separate safeguards and legal review. Steppe
does not knowingly collect information from a child under 13.

> [CONFIRM: counsel — confirm minimum beta membership age.]

## 9. Changes to This Policy

We will post a revised version with a new effective date and give advance notice
of material changes where required. A material privacy promise will not be
published before the product can actually perform it.

## 10. Contact

Privacy questions and requests go to
[hello@steppe.community](mailto:hello@steppe.community) or by mail to
3566 NW 8th Street, Redmond, OR 97756. Gregory Chism handles member-data
requests. Ignite should be contacted only for a sponsored matter that Ignite
actually administers.
