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
Version:         Draft v2
Last updated:    August 29, 2026
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
| Residency check | Proof of local address | Intended for one eligibility decision; collection remains closed until deletion and orphan cleanup are verified |
| Member content | Listings, messages, group activity, votes | Provide the service the member requested |
| Safety intake | A report and an excerpt a participant chooses to disclose | Let a human moderator review the report |
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
| Supabase | Authentication, database, and private verification storage | Account and app data needed to provide those services |
| Resend | Service email and contact-form delivery | Recipient email; contact content in transit |
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
| Account basics | While the account is active; intended to be removed or scrubbed on deletion after the deletion/session-revocation gate passes |
| Residency proof | Not collected until delete-after-review and orphan cleanup are verified end to end |
| Messages | Intended to remain participant-only and to remove a person's sent messages on account deletion; both behavior and session revocation must pass the beta gate |
| Safety reports | Until resolved or the reporter deletes their account; a participant-supplied excerpt may remain even if the source conversation is later deleted |
| Consent, closed-ballot, moderation, and audit records | Kept in minimized or anonymized form when deletion would make the governance or accountability record inaccurate |
| Minimal operational logs | Kept only as long as operationally needed; no fixed purge promise is made until it is technically enforced and verified |

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
