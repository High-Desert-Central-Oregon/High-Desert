# Contributing to High Desert

High Desert is community-owned civic infrastructure, not a typical product. The code is
meant to outlast any one of us and to be read and maintained by the community it serves —
including the intern pipeline. So contributions are held to two standards: they must be
**legible** (an intern can read them) and they must **respect the invariants**.

## Read these first

- **`CLAUDE.md`** — the ten non-negotiable invariants (verify-then-forget, server-set vote
  weight, secret ballots, human-in-the-loop, append-only record, no ranking, no ads,
  accessible-by-default, …), the build order, and the explicit **do-not-build** list. A change
  that violates an invariant will not be merged — if a task seems to require one, open an issue
  and flag it rather than working around it.
- **`SPEC.md`** — what each feature is and how it's meant to be built.

## How contributions are licensed (inbound = outbound)

This project is licensed under the **GNU AGPL-3.0-or-later** (see `LICENSE`). By contributing,
you agree your contribution is provided under the **same license**. Everyone — including the
maintainers and High Desert — is bound by the AGPL equally; there is no separate grant that
lets the project take your contribution proprietary. We use the DCO below rather than a
contributor license agreement, on purpose: no rights are assigned to anyone.

## Sign your work — the DCO

The **Developer Certificate of Origin** is a lightweight way to certify you have the right to
submit your code. Add a `Signed-off-by` line to every commit:

    git commit -s -m "Your message"

This appends, using your real name and email:

    Signed-off-by: Jane Builder <jane@example.com>

Run `git config core.hooksPath .githooks` once after cloning, and the tracked
hook signs every commit for you — so a plain `git commit -m` is signed without
remembering `-s`.

By signing off, you certify the statement below.

> **Note on privacy.** Your sign-off (name + email) becomes part of the public git history
> permanently. This is about *contributor* identity and is standard for open source — it is
> entirely separate from the platform's member-data privacy commitments (verify-then-forget, no
> selling data), which still fully apply to the people who *use* High Desert.

### Developer Certificate of Origin 1.1

    Developer Certificate of Origin
    Version 1.1

    Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

    Everyone is permitted to copy and distribute verbatim copies of this
    license document, but changing it is not allowed.


    Developer's Certificate of Origin 1.1

    By making a contribution to this project, I certify that:

    (a) The contribution was created in whole or in part by me and I
        have the right to submit it under the open source license
        indicated in the file; or

    (b) The contribution is based upon previous work that, to the best
        of my knowledge, is covered under an appropriate open source
        license and I have the right under that license to submit that
        work with modifications, whether created in whole or in part
        by me, under the same open source license (unless I am
        permitted to submit under a different license), as indicated
        in the file; or

    (c) The contribution was provided directly to me by some other
        person who certified (a), (b) or (c) and I have not modified
        it.

    (d) I understand and agree that this project and the contribution
        are public and that a record of the contribution (including all
        personal information I submit with it, including my sign-off) is
        maintained indefinitely and may be redistributed consistent with
        this project or the open source license(s) involved.

## Working style

- **RLS-first.** Assume the client is hostile. Access is enforced in the database (see
  `schema.sql`); the UI is convenience, never the gate. Never trust the client for `verified`,
  `role`, or vote `weight`.
- **Contain complexity.** Deep modules, narrow interfaces; pull complexity down so the next
  person doesn't carry it. Design it twice before committing.
- **Accessible by default.** Semantic HTML, keyboard paths, real contrast, captions, and
  English + Spanish strings — from the first screen, not a later pass.
- **Plain language** in everything a member reads.
- **Per-file license header** (below) on new source files.

## Reporting security or privacy issues

Please do **not** open a public issue for a security or privacy vulnerability. Email
`[security contact — fill in]` so it can be fixed before disclosure. Given verify-then-forget
and the member-data commitments, privacy bugs are treated as security bugs.

## Per-file header notice (new source files)

    High Desert — <one-line description of the file>
    Copyright (C) 2026 High Desert
    SPDX-License-Identifier: AGPL-3.0-or-later

    This program is free software: you can redistribute it and/or modify it under
    the terms of the GNU Affero General Public License as published by the Free
    Software Foundation, either version 3 of the License, or (at your option) any
    later version. See the LICENSE file for details.
