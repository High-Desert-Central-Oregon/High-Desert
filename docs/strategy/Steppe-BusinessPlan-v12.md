> **Internal note · 2026-07-09.** Working draft, converted from Word to Markdown. Facts to rely on: the fiscal sponsor is **Ignite Empowerment Foundation**, a Central Oregon 501(c)(3) (EIN 99-3872440), agreement pending signature. Director Weimer is the spouse of the foundation's founder, handled as a disclosed related party (see `docs/governance/`). Weimer's board seat is confirmed. Dues are $4 a month.

**STEPPE**

*A high desert civic commons — digital civic infrastructure, Redmond
first, Central Oregon by design*

**Business Plan — v12**

June 2026 · Living Document · Supersedes v11

***Community-owned, ad-free, and impossible to sell. The structure is
the promise — and the promise is the product.***

Steppe is a community-owned digital platform for the towns of Central
Oregon — verified, ad-free, democratically governed, and built to
outlast any founder or funding cycle. It launches in Redmond and is
capped, by design, at twelve communities. Beyond the platform, Steppe
Connect extends the mission to the access layer beneath it: rural
connectivity, a tribal digital-sovereignty program built on complete
tribal ownership, and partnerships with the region’s colleges and
makerspaces. This plan describes what it is, how it is governed, how it
is funded, and the order in which it is built. Its companion is the
Steppe Governance Charter.

## 00 — Executive Summary

|                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Element**             | **Summary**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **The problem**         | Central Oregon has no shared digital infrastructure its residents own or govern. Every platform serving the region is extractive, unverified, and unaccountable.                                                                                                                                                                                                                                                                                                                                                                               |
| **The solution**        | A verified, ad-free, member-governed platform — launched town by town beginning with Redmond, hard-capped at twelve communities.                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Legal form**          | Oregon public benefit nonprofit corporation, member-governed, formed 2026. Mission entrenched in the articles; no owner, no shares, cannot be sold. 501(c)(3) recognition pursued from the start, exemption retroactive to formation.                                                                                                                                                                                                                                                                                                          |
| **Status (June 2026)**  | Built. Core platform complete: authentication, residency verification, events, governance voting, moderation, accessibility, Spanish localization, mobile, and a full database-level security audit. 35 Redmond neighborhoods seeded.                                                                                                                                                                                                                                                                                                          |
| **Leadership**          | Founder serves as paid Founding Executive Director — the durable, curatorial role that runs the platform — distinct from the board, secured by employment agreement rather than ownership. Founding board of three (Chism, Cobb, Weimer — invitation pending), majority-independent, transitioning to member-elected within 24 months.                                                                                                                                                                                                         |
| **Funding**             | Five diversified streams. Member dues ($4/mo flat, billed annually or by ACH) anchor core operations and always cover them alone. Tax-deductible donations, foundation grants, government programs, and modest earned revenue fund capacity and expansion. No single funder exceeds 30% of revenue; government funding is sequenced last and wrapped in radical transparency.                                                                                                                                                                  |
| **Beyond the platform** | Steppe Connect (2027+): rural connectivity pilots, a Tribal Digital Sovereignty Program built on complete tribal ownership, and college/makerspace partnerships — pursued with established regional partners rather than alone. Anchor relationships: Connect Central Oregon (regional capacity, board pipeline), the Oregon Broadband Equity Coalition (the statewide digital-equity network), OSU-Cascades and COCC, and — on the tribal horizon, at their pace — the Warm Springs Community Action Team. Entirely grant-funded; never dues. |
| **Why it survives**     | Anti-extraction is structural, not aspirational: no advertising, member control, and data ownership are written into the articles and bound by a dissolution clause. There is nothing left to a future conversion vote.                                                                                                                                                                                                                                                                                                                        |
| **Timeline**            | Founder retains aligned academic income through launch and the sustainability-proof phase; full-time transition is gated on a demonstrated ED salary, never assumed. Incorporation + launch gates: 2026. Public Redmond launch: late 2026. Foundation grants: 2027. Government programs: 2028+.                                                                                                                                                                                                                                                |

## 01 — Principles

Steppe is built on a small set of load-bearing principles. They are not
slogans; each one is enforced somewhere concrete — in the articles of
incorporation, in the governance rules, or in the database itself.
Sources for each are credited in §13.

### Anti-extraction by structure

Platforms decay when advertising makes someone other than the member the
customer. Steppe takes no advertising, ever. Members are the only
customer; there is no engagement machine to optimize and no behavioral
data to sell. The refusal is written into the articles of incorporation,
not left to policy that a later decision could quietly reverse.

### Trust is a stock

Community trust accumulates slowly and drains quickly. That asymmetry —
not any single feature — is what makes governance consequential: a
feature can be reversed, a trust collapse cannot. Every design choice is
treated as a deposit to or withdrawal from that stock, and platform
health is read through leading indicators rather than vanity metrics.

### A commons can be governed

Shared resources need neither privatization nor top-down control; a
community can govern them under well-understood design principles —
clear boundaries, collective choice, monitoring, graduated sanctions,
and conflict resolution. Steppe audits its governance against all eight
of these principles and, wherever possible, enforces them in the
database rather than promising them in policy.

### Legibility must serve the governed

Systems that flatten local particularity to make it manageable tend to
fail the people furthest from the center. Verification that cannot
accommodate a PO box, a ranch family, or a Spanish-speaking resident is
not neutral — it is exclusionary. Steppe uses multiple verification
pathways, human review, and verify-then-forget evidence handling, so the
tool preserves practical local knowledge instead of formalizing it away.

### Voice, not silent exit

When speaking up is costly, people leave quietly and the institution
learns nothing. Every governance mechanism — ban-then-appeal, the public
transparency log, community override, the member vote — exists to make
disagreement speak rather than disappear. The rate at which members
leave, measured against the rate at which they appeal, is treated as an
early-warning signal.

### Ownership structure is destiny

What an organization can become is set by who is able to own it. A
structure that can be sold will eventually face the temptation to sell,
and “community-owned” is only real if it is legally true. Steppe forms
as a member-governed nonprofit with no owner, its mission entrenched in
the articles and its assets bound by a dissolution clause — the lock
exists on day one, not at a future trigger.

### Convivial tools

Infrastructure should be something its community can understand, use,
repair, and govern — not a black box that restructures the people who
depend on it. The legible codebase, the plain-language Terms, and the
student-intern pipeline are this principle in practice: Steppe is built
to be maintained by the community it serves.

### Design knowledge lives in patterns

The know-how of building well is best held as named, revisable patterns
rather than frozen specification. Steppe’s design language is literally
a pattern library — twenty-five patterns held in clusters, added to
additively and never renumbered — so the practical wisdom of the build
stays legible and editable as the platform grows.

***Institutions simplify what they govern in order to manage it, and
that simplification — aided by technology, incentivized by extraction,
and obscured by metrics — tends to harm the people furthest from power.
Steppe exists to refuse that cycle from the start.***

## 02 — Why a Nonprofit, and Why Now

Steppe is unusual in that its structure is its product. A typical
software venture chooses a legal entity for tax and capital reasons, and
the choice is invisible to users. Steppe sells trust in being
structurally non-extractive: the willingness to verify, to participate,
and to pay a small fee for something offered free elsewhere all rest on
the credibility of “community-owned, no extraction, cannot be sold.” For
this project the entity is not back-office plumbing — it is the value
proposition.

A founder-owned company — even a mission-driven one — can be sold, can
take investment, and answers ultimately to an owner. “Community-owned”
under that structure is a promise, redeemable only at some future
conversion that no document can pin down cleanly. A member-governed
nonprofit removes the gap between claim and reality: there is no owner
to sell it, no shares to dilute, and the mission is entrenched in law
from the first day. The decay path is not merely resisted — it is
removed.

### The Founder’s Place in It

Choosing a nonprofit does not mean the founder gives up a durable,
sustaining role. It means that role is a job rather than ownership. The
founder serves as Founding Executive Director — the person who runs and
curates the platform, holds the keys, sets the culture, and does so on a
real salary under a real employment agreement. That role is secured by
contract and by the board, not by control, and it is designed to last
for the long horizon. Curation, not ownership, is the anchor — and it is
a more honest and more durable anchor, because a contract pays a salary
and control does not.

### Honest Costs

  - IRS timing is uncertain — a full exemption determination typically
    takes several months. The organization may operate and solicit while
    the application is pending, and exemption is retroactive to
    formation, so the launch does not wait on the IRS.

  - Compliance is permanent — an annual federal information return,
    Oregon charitable registration and annual reporting, board minutes,
    and a conflict-of-interest policy. At this scale the burden is a few
    hours a quarter, and the transparency commitment already exceeds
    what is required.

  - No investment capital, ever — already true in spirit; now true in
    law. Steppe does not want growth capital, and the structure makes
    that permanent.

## 03 — Legal Architecture

### The Entity

Steppe incorporates under Oregon nonprofit law as a public benefit
corporation with statutory voting members. This is the load-bearing
choice: Oregon law lets a nonprofit’s members hold real legal power —
electing the board and approving fundamental transactions — so the
community vote system stops being platform policy enforced by goodwill
and becomes corporate law enforced by statute, with the database-level
secret ballot as its instrument.

### Entrenchment — What Goes in the Articles

  - **Purpose clause** — operating community-owned digital civic
    infrastructure for the towns of Central Oregon — advancing digital
    inclusion, civic participation, community education, and charitable
    giving — exclusively for charitable and educational purposes

  - **No-advertising and member-data provisions** — written as
    restrictions on corporate power, not as policy

  - **Dissolution clause** — on dissolution, all assets pass to one or
    more aligned charitable organizations serving Central Oregon — never
    to any private person

  - **Amendment protection** — the articles are amendable only with
    member approval at the supermajorities the bylaws define

### Founder Protections — Bounded and Disclosed

Three distinct, legitimate protections give the founder a secure,
sustaining place through the fragile years without contradicting
community ownership:

  - **The Executive Director role** — a multi-year employment agreement
    with defined severance. The ED is staff, not a board seat, and is
    therefore not subject to member elections — the founder’s livelihood
    and operational control rest on contract, not on winning a vote.

  - **A founder board seat** — held while the founder serves as ED and
    converting to a permanent non-voting advisory seat afterward — a
    guaranteed voice, in perpetuity.

  - **A bounded founder-protection period** — for a bounded founding era
    — sunsetting at the earlier of six years or 3,500 verified members
    sustained four consecutive quarters — a narrow set of changes
    requires the founder’s concurrence alongside the normal member vote:
    amendments to the entrenched commitments; dissolution, merger, or
    sale of substantially all assets; and any lowering of the amendment
    threshold itself. It is a negative-power right — the founder can
    block these specific changes, never initiate them — and it expressly
    excludes dues and compensation. The period then sunsets
    automatically into full member governance.

|              |                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **THE LINE** | These protections are bounded and temporary by design. A founder-led nonprofit with sunsetting protections is normal and defensible; a nonprofit whose founder is permanently unremovable would be a for-profit wearing nonprofit clothes, and would hollow out the community ownership that is the whole point. The protections secure the launch — they do not privatize the mission. |

### 501(c)(3) Pathway

Because the funding strategy projects revenue crossing the
streamlined-application ceiling within a few years, Steppe files the
full federal exemption application rather than the short form — the
honest choice given the growth projection, and one that forces the
charitable-purpose narrative to be written well for every grant that
follows. Operations and the launch proceed while the application is
pending; exemption is retroactive to formation. For any early grant that
requires a determination letter before it is in hand, a fiscal
sponsorship arrangement with a national civic-technology sponsor (a
Model C “grantor” sponsor) is held as a bridge option rather than a
dependency.

### Founder Compensation

Public from the outset, staged to the platform’s health, and
deliberately below market: $0 as a side project; a $15,000–$25,000
annual stipend at significant part-time; a $95,000 full-time ceiling set
below the founder’s academic salary as a good-faith signal; with an
annual cost-of-living adjustment capped at 3%. In a nonprofit this is
board-approved reasonable compensation — documented with comparables,
approved by disinterested directors, and disclosed in the transparency
report and the public information return.

### The Community Fund

Voluntary contributions sit above the flat dues and are directed by each
member among three buckets: Steppe’s operations, a Member Access Fund
that underwrites the hardship waiver, and the Community Fund. The
Community Fund — together with any surplus dues revenue once the
operator’s compensation is covered — flows entirely to local charities,
with recipients chosen each year by a ranked-choice vote of the
membership and no individual-charity earmarking. Under a charitable
entity this charitable re-granting is a core exempt activity — it
strengthens the exemption case rather than complicating it.

## 04 — Funding Model: Diversity by Design

The nonprofit form opens four funding streams a founder-owned company
could never reach — and introduces one capture risk that the model is
explicitly built to manage.

### Five Streams

|                             |                                                                                                                                                                                                                                                                                                                  |                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Stream**                  | **Composition**                                                                                                                                                                                                                                                                                                  | **Role**                                                                                          |
| **1. Member dues**          | $4/mo flat, verified locals; billed annually or by ACH. 200 members ≈ $9.6K/yr · 500 ≈ $24K · 1,000 ≈ $48K · 3,500 ≈ $168K                                                                                                                                                                                       | The anchor. Core operations run on dues alone — always.                                           |
| **2. Individual donations** | Tax-deductible once recognized (retroactive). Year-end campaign; sustaining donors; the Community Fund as the visible destination                                                                                                                                                                                | Charitable-giving engine; surplus flows back out to local charities                               |
| **3. Foundation grants**    | Central Oregon and rural-Oregon funders — Roundhouse Foundation (Sisters), The Ford Family Foundation, Oregon Community Foundation, the Bend Foundation, Meyer Memorial Trust, The Collins Foundation — plus civic-information funders, a natural fit given the local-journalism gap and the Compass partnership | Capacity and expansion: design and accessibility work, localization upkeep, internships, town \#2 |
| **4. Government programs**  | Oregon Broadband Office; USDA Rural Development community programs; later, federal tribal-broadband programs co-applied with Warm Springs                                                                                                                                                                        | Infrastructure-scale work only; never core operations; sequenced last (see below)                 |
| **5. Earned revenue**       | Visitor event-listing fees; later, replication support for other rural communities adopting the model                                                                                                                                                                                                            | Modest, mission-aligned supplement                                                                |

### Government Money — Taken, but on Steppe’s Terms

Central Oregon is wary of outside money and of government in particular.
The answer is not abstinence — it is transparency so complete that the
community can verify for itself that the money carries no hidden agenda.
Steppe will accept government funding, strategically:

  - Sequenced last — government programs are pursued only after local
    trust is established and the transparency apparatus is proven
    (2028+), never at founding

  - Radically disclosed — every government dollar, every condition
    attached to it, and every reporting obligation it creates is
    published in full in the transparency report; members do not have to
    take on faith that there are no strings, they can read the agreement

  - Never core, never compromising — government money funds
    infrastructure-scale work only, never day-to-day operations, and is
    refused outright if any condition touches the foundational
    commitments

|             |                                                                                                                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POSTURE** | In a government-skeptical community, extreme transparency is a stronger trust mechanism than refusal. Abstinence asks the community to trust a promise; published agreements let them verify the absence of strings. The disclosure is the safeguard. |

### Concentration Rules — Anti-Capture Applied to Philanthropy

Funders shape grantees, incrementally and each request individually
reasonable — the same quiet-capture dynamic the platform is built to
resist, wearing philanthropic clothes. The discipline:

  - Dues fund core operations, always — if every grant vanished
    tomorrow, the platform still runs

  - No single funder exceeds 30% of annual revenue

  - No grant is accepted whose conditions touch the foundational
    commitments — no advertising means no “sponsored content pilots”;
    member-data ownership means no “data-sharing” riders

  - Every grant and its conditions are disclosed in the quarterly
    transparency report

### Funding Sequence & Budget Ladder

|                 |                                   |                                                                                                                                                         |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase**       | **Sources**                       | **Notes**                                                                                                                                               |
| **1 (2026–27)** | Dues + local individual donations | Trust-building. No government money; minimal outside grants. Founder in academic role, ED salary at $0 — academic income subsidizes the fragile years.  |
| **2 (2027–28)** | \+ Foundation grants              | Begins once exemption is recognized. Capacity work and the stipend stage. Still no government money.                                                    |
| **3 (2028+)**   | \+ Government programs            | Infrastructure-scale only, wrapped in radical transparency. Diversified, no source above 30%. Supports town \#2 and the Warm Springs broadband horizon. |

|                    |                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **VIABILITY TEST** | At every rung, core operations are covered by dues alone and everything above core is additive. Grant cycles are slow and grant revenue is lumpy — survivable precisely because nothing essential depends on it, and because aligned academic income carries the founder through the years before the ED salary is real. |

## 05 — Mission, Market & the Redmond-First Strategy

Steppe is digital civic infrastructure — trusted, community-controlled
connective tissue, owned by the people it serves and durable past any
founder or funding cycle. There is nothing remotely like it in Central
Oregon: the local paper has retrenched, the large social platforms are
chaotic or distrusted, and word of mouth — the most trusted channel —
does not scale. Steppe fills that gap the way a co-op or a public
library fills it.

### Why Redmond First

Growth is one town at a time. Saturation in a single community builds
the trust stock, the governance precedents, and the word-of-mouth loop
that a thin regional launch never could. Redmond is the right first
town:

  - **Scale that saturation can reach** — \~36,000 residents; 35
    neighborhoods already seeded as the platform’s geographic unit; 200
    members is roughly 0.5% of town — meaningful density within reach

  - **A community partner** — Redmond Compass has reviewed the Local
    Exchange concept favorably; the marketplace will live on Steppe,
    with naming and partnership structure being confirmed now

  - **The right cultural mix** — trades, agriculture, and working
    families alongside newer arrivals — the cross-layer cohort the
    founding-member constraint is designed to recruit

|                    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EXPANSION RULE** | New towns join by petition and dual vote — the petitioning community and the existing membership — with a hard cap of twelve. The cap bounds scope, cost, and governance load by design; it is an anti-decay mechanism, not a limitation. Multi-town governance uses a deferred-activation design: the structural principles — subsidiarity scope tiers and dual-majority (both a membership majority and a town majority) for regional decisions — are fixed now, while the numeric dials are ratified once membership reaches two or more qualifying towns. |

### Foundational Commitments

Entrenched in the articles (§03) and changeable only by a 75% member
supermajority with a 30-day deliberation period:

  - No advertising, ever.

  - Resident verification is mandatory for full platform access.

  - The governance model is always community-controlled.

  - Platform data belongs to members, not operators.

  - Every major policy decision is reversible by community vote.

## 06 — Systems & Trust Architecture

Steppe is a system of interlocking parts, not a feature list. Four
systems must hold together; weakening one compromises all.

|                    |                                                                                                         |                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **System**         | **Core Loop**                                                                                           | **If Weak**                                                                                 |
| **Trust**          | Verification → identity → earned weight → permissions → community health → more members worth verifying | Exchange becomes a free-for-all; votes become gameable; the trust stock drains              |
| **Governance**     | Votes → rules evolve → trust in process → participation → better decisions                              | Capture by the most active. A 15% quorum and 1×–3× tenure weighting are the joint guard     |
| **Sustainability** | Dues → costs covered → operator sustained → surplus to charity → capacity grows                         | Founder dependency; financial fragility; mission drift under money pressure                 |
| **Build**          | Minimum trustworthy platform → earned trust → earned right to add complexity                            | Feature creep before trust; the vote-gated marketplace layer is this discipline in practice |

### Feedback Loops

|               |                                                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **REINFORCE** | Quality community → word of mouth → more quality members → better community. Never trade member quality for growth speed — the reason saturation in one town beats thin regional reach. |

|            |                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DANGER** | Bad moderation → frustration → silent exit → remaining members more extreme → worse moderation. Early moderation investment is collapse prevention. |

|             |                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **BALANCE** | Community votes → rules evolve → trust in process → participation — the self-correcting mechanism, and the first real proposal will exercise it. |

### Commons Governance — the Eight Principles, Enforced

The platform’s governance is audited against all eight
commons-governance design principles. Most are now enforced at the data
layer rather than promised in policy:

  - Clear boundaries — residency verification and the verified/visitor
    tiers are held by database access rules, not the interface

  - Rules match local conditions — neighborhood-scoped design (35
    Redmond neighborhoods), Spanish localization, and town-by-town rules
    within the platform framework

  - Collective choice — voting is live, with server-set tenure weight,
    one ballot per member, secret ballots, and a 15% quorum

  - Monitoring — a trigger-driven, unforgeable, append-only audit log;
    quarterly transparency reports; a health dashboard

  - Graduated sanctions — automated flag, then a human moderator’s
    decision, then a three-month ban with one appeal; no silent removal

  - Conflict resolution — appeals run through a separation-of-duties
    path with no direct writes; community override by vote; board review
    for permanence

  - External recognition — secured at formation through nonprofit
    status, rather than deferred to a milestone

  - Nested enterprise — neighborhood, town, platform, and board as
    nested layers; future towns and the Warm Springs fork as nested
    autonomous units

### Voice as Structure

Every governance feature is a voice mechanism, built so disagreement
speaks instead of leaving. Silent exit is invisible and teaches nothing;
structured voice produces learning.

  - Ban-then-appeal — voice after action, never blocked by it

  - Public transparency log — voice into a record no one can edit

  - Community override — voice that outranks moderators

  - Governance votes — collective voice on the rules themselves

|                       |                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **LEADING INDICATOR** | Exit rate measured against appeal rate. High exit with low appeal means voice is failing and people are leaving without speaking — the earliest warning the trust stock is draining. |

### Governance You Can Check

Steppe’s differentiator is not that it claims trustworthy governance —
it is that the claims are enforced at the data layer and verifiable by
audit, and now by public legal documents as well. Governance you can
check beats governance you must believe.

  - **Unforgeable audit log** — audit writes happen in database
    triggers; the client-callable path was found in audit and revoked.
    The log cannot be skipped or forged — by anyone, including the
    operator.

  - **Secret ballot, end to end** — ballots carry no read access and
    results exist only in a post-close view; no ballot choice ever
    touches the audit log

  - **Verify-then-forget** — the moment a verification decision is
    recorded, a trigger nulls the evidence pointer; the platform
    structurally cannot hoard identity documents

  - **Frozen what must not move** — proposal window, kind, and author
    are trigger-frozen; verified status, role, and tenure cannot be
    self-edited

  - **Checkable in public** — articles, bylaws, the information return,
    and state filings are all public documents — the legal structure can
    be verified the same way the code can

## 07 — Product: What Exists Today

The core platform is complete, in a version-controlled repository. What
ships today: authentication with a plain-language Terms gate; residency
verification with human review and verify-then-forget handling; the
event primitive, neighborhood-scoped; governance proposals and voting
with server-set tenure weight, one ballot per member, secret ballots,
and results revealed only after close; automated flagging with
volunteer-final, appealable, separation-of-duties moderation; and
shipped accessibility, Spanish, mobile, and plain-language passes. A
full database-level security audit closed five gaps and is captured in a
dry-run runbook with synthetic accounts and an invariant-coverage
matrix.

|                         |                                                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PENDING BEFORE BETA** | Brand palette implementation and a full contrast pass · Spanish native-speaker review (currently draft) · legal review of the Terms (bundled with formation counsel) · Compass partnership naming · execution of the dry-run against the invariant matrix. |

### Access Tiers

|                       |                                  |                                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tier**              | **Who**                          | **Access**                                                                                                                                                                                                                                                      |
| Visitor (Free)        | Non-residents, vendors, visitors | Public events and curated local information. No posting, voting, or exchange.                                                                                                                                                                                   |
| Resident ($4/mo flat) | Verified locals                  | Full platform: posting, voting, events, Local Exchange, governance. Price cannot rise without a member vote. A no-documentation hardship waiver, funded from the Member Access Fund, keeps full membership available to anyone for whom the dues are a barrier. |

### Design Invariants

  - Chronological-first, always — no algorithmic ranking, no featured
    placement, no engagement optimization; discovery features are opt-in

  - Viewpoint-neutral content policy — all real community events are
    listed regardless of political or religious content; groups are
    judged on whether their normal function requires Terms violations,
    never on ideology

  - Verified members only for participation; neighborhood-scoped by
    default

  - No platform fees or cuts on any exchange between members

  - Trust signals are mutual, completed-exchange acknowledgments tied to
    real listings — never ratings, scores, or leaderboards

### The Local Exchange

Scoped with Redmond Compass and committed in two layers that share one
listing primitive (an offer or ask with a category, built the way the
event primitive was — one model, not parallel systems):

  - **Committed, post-beta** — a non-monetary needs exchange —
    neighborhood-scoped offers and asks, mutual-aid flavored — and
    trade-for-trade barter among tradespeople. No money, almost no
    extraction surface.

  - **Later, community-voted** — a commercial marketplace as an added
    layer, gated behind a governance vote and not built until the
    membership approves it — an ideal candidate for the cohort’s first
    real proposal.

## 08 — Governance & Leadership

Full normative detail lives in the Governance Charter (companion
document). The plan-level summary:

### Leadership: the Founding Executive Director

  - The founder serves as paid Founding ED under a multi-year employment
    agreement with defined severance — the durable, curatorial role that
    runs the platform day to day: product, operations, culture

  - The ED is staff, not a board seat, and is not subject to member
    elections; the role is secured by contract and board oversight, the
    founder’s anchor and livelihood for the long horizon

  - Compensation follows the staged, below-market framework (§03), set
    by disinterested directors and disclosed publicly

### The Board

  - **Founding board (named)** — three directors at incorporation: Greg
    Chism (founder), Holli Cobb (Redmond community member; founder,
    Redmond Compass), and Brandon Weimer (owner, Herringbone Books,
    Redmond — invitation pending). Two of three are Redmond community
    anchors; seats remain open and are added as the organization grows

  - **Independence** — director relationships are disclosed and managed
    under the conflict-of-interest policy. The register discloses a
    market-rate engagement between a founder-owned entity (Three Canyon
    Consulting) and a director's organization (Redmond Compass), and a
    family relationship between a director (Weimer) and the fiscal
    sponsor's founder (COI Register 001 and 002). Because no current
    director is free of every relationship, a fourth fully independent
    director is planned; compensation and interested-person decisions are
    approved by disinterested directors against documented comparables

  - **Conflict handling** — Cobb recuses from any Steppe matter involving
    Redmond Compass or the founder's entities; the founder recuses from
    his own compensation and from Redmond Compass matters; Weimer recuses
    from the Steppe–Ignite Empowerment Foundation sponsorship. Ordinary
    platform membership is never a conflict

  - **Transition** — the bylaws mandate member-elected seats within 24
    months of launch, moving to a full 7–11 seat structure with both
    community-elected and board-invited pathways, each member-approved

  - **Founder seat** — the founder holds a board seat while serving as
    ED, converting to a permanent non-voting advisory seat afterward

### Founder-Protection Period

For a bounded founding era — sunsetting at the earlier of six years or
3,500 verified members sustained four consecutive quarters — a narrow
set of changes requires the founder’s concurrence alongside the normal
member vote: amendments to the entrenched commitments; dissolution,
merger, or sale of substantially all assets; and any lowering of the
amendment threshold itself. It is a negative-power right — the founder
may block these specific changes, never initiate them — and it expressly
excludes dues and compensation, which remain Members’ decisions alone.
The period sunsets automatically into full member governance. It is
distinct from the founder board seat and the ED employment, and it is
bounded and disclosed by design.

### Board Development

Open seats are filled deliberately, recruiting for governance judgment
and community roots over prestige, and keeping a majority of directors
independent of the founder. Candidates are sourced through the region’s
nonprofit infrastructure — Connect Central Oregon and its network for
regional governance experience (which also adds a second
founder-independent director), the Latino Community Association for the
community the Spanish-language commitment must serve, the Oregon
Broadband Equity Coalition for digital-equity and broadband expertise,
and regional finance leaders for audit and funder confidence.
Member-elected seats follow within 24 months.

### The Community Vote

  - **Quorum** — 15% of eligible voters

  - **Tenure weighting** — 1× to 3× by membership duration — prevents
    capture by the newest and loudest while preserving every member’s
    voice

  - **Secret ballots** — enforced in the database; results visible only
    after a proposal closes

|                                                           |                                          |
| --------------------------------------------------------- | ---------------------------------------- |
| **Decision Type**                                         | **Threshold**                            |
| Minor policy                                              | Simple majority of quorum                |
| Major policy (incl. price changes, the marketplace layer) | 60% supermajority of quorum              |
| Foundational commitments                                  | 75% supermajority + 30-day deliberation  |
| New town addition                                         | Petition + dual vote; hard cap of twelve |
| Annual charity selection                                  | Ranked-choice vote                       |
| Board recall                                              | 60% supermajority                        |

### Moderation & Due Process

  - Automation may flag; only a human moderator may decide. Moderators
    serve staggered one-year renewable terms — three at minimum —
    supported by a modest honorarium of $50–100 each per month, capped
    at 8% of operating expenses

  - Graduated consequences end at a three-month ban with one appeal; no
    permanent ban without board review

  - Separation of duties — the deciding moderator cannot hear the appeal

  - No silent removal; hard deletion is creator-only; moderation actions
    are append-only and visible

  - Quarterly public transparency report; sustained complaints trigger a
    community-override vote

## 09 — Timeline

Sequenced by dependency from where the project stands in mid-2026. The
build is done; what remains before beta is verification, review, and
people. The founder’s career risk is managed by sequencing, not by
entitlement — aligned academic income carries the fragile years, and the
full-time leap waits for a demonstrated salary.

### 2026 — Formation, Gates, Launch

  - Confirm Weimer’s acceptance (formation-blocking — Oregon requires
    three directors); file articles of incorporation with the
    entrenchment and member-governance provisions; obtain an EIN

  - Engage one Oregon nonprofit attorney for articles, bylaws, dues
    framing, and the Terms review already pending; first board meeting
    adopts bylaws, conflict-of-interest and compensation policies;
    register for charitable solicitation

  - Close the pre-beta gates: dry-run execution, Compass naming, Spanish
    native-speaker review, brand palette and contrast pass

  - Recruit the founding cohort (\~50, Redmond, no more than 20%
    remote-professional) and at least three moderators (the standing
    minimum); run a 60-day closed beta and dogfood the first real
    governance proposal

  - Public Redmond launch in late 2026, by word of mouth through the
    cohort and Compass; first transparency report within 30 days

  - Founder remains in an aligned academic role throughout; ED salary at
    $0 — academic income subsidizes this phase

  - Partnership outreach begins: Connect Central Oregon (board candidate
    + regional introductions), secure a national Model C fiscal sponsor
    as the determination-period bridge, join the Oregon Broadband Equity
    Coalition, and the OSU-Cascades Innovation Co-Lab and EDCO — the
    three relationships that set up everything downstream

### 2027 — Deepen, Fund, Widen

  - Saturate Redmond: 100 paid members by early 2027, 200 (\~0.5% of
    town) by mid-year; ship the Local Exchange post-beta

  - Once exemption is recognized, submit first foundation grant requests
    (Roundhouse, Ford Family, OCF) for capacity; stipend stage may
    begin; first annual ranked-choice charity vote opens the Community
    Fund

  - First member-elected board seats; open the petition process for town
    \#2; full-year transparency report

  - Still no government money — trust-building phase continues

  - H2: open MOU conversations with COCC (Center for Business/Industry,
    CIS chair), OSU-Cascades, DIYcave, and the Deschutes Public Library
    — internship alignment, makerspace access, and the
    community-partner role in the regional data-literacy bridge

  - Begin the Warm Springs Community Action Team relationship —
    listening only — and the Latino Community Association relationship
    ahead of any Madras-area work; deepen the broadband coalition and
    Link Oregon for Connect

### 2028+ — Capacity, Government Money, Expansion

  - Pursue government programs (Oregon Broadband, USDA) for
    infrastructure-scale work only, wrapped in radical transparency —
    every dollar and condition published

  - Internship cohort (Tech, Community, Data tracks) and first
    scholarships, grant-funded — placements aligned with COCC and
    OSU-Cascades work-based-learning programs; town \#2 onboarding by
    dual vote; diversified revenue with no source above 30%

  - First Connect rural-access pilot: one partner town, library or
    community-center access points with makerspace-built device kits —
    grant-funded end to end under the transparency posture

  - Founder transitions to full-time ED only when the ED salary is
    demonstrably sustainable from dues and diversified revenue — the
    leap is sequenced on evidence, never assumed

### 2029+ — Warm Springs

  - Questions before proposals: formal tribal-council engagement only
    from organizational stability; co-design with tribal members as
    design leads; grant co-application; full IP and operational handoff.
    The sequence cannot be compressed.

## 10 — Risk Register

|                                             |                              |                                                                                                                                                                                                                                           |
| ------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Risk**                                    | **Exposure**                 | **Mitigation**                                                                                                                                                                                                                            |
| **Founder career risk / full-time leap**    | High if rushed               | Staged sequencing: aligned academic income through launch and the sustainability-proof phase; full-time only on a demonstrated ED salary; multi-year employment agreement with defined severance. The leap is gated on evidence, not hope |
| **Founder dependency**                      | Low–Medium                   | ED role + founder seat + bounded protection period carry the early years; entrenched articles and member governance mean the entity outlives its founder by construction; the protection period sunsets so dependency ends by design      |
| **Government money / local-trust friction** | Medium in a skeptical region | Sequenced last, after trust is established; radical transparency — every dollar, condition, and obligation published; never core operations; refused if any condition touches the foundational commitments                                |
| **Grant capture / mission drift**           | Medium, rising with success  | Dues fund core; 30% funder cap; no conditions touching foundational commitments; full disclosure                                                                                                                                          |
| **IRS determination delay**                 | Medium                       | Full application with a well-built narrative; operations proceed lawfully while pending; retroactivity protects donors; fiscal sponsorship held as a bridge for early grants                                                              |
| **Board conflicts / IRS independence**      | Low, managed                 | Majority-independent board; conflict policy at meeting one; Cobb recuses on Compass, Weimer pre-commits the same; member elections within 24 months. Weimer’s acceptance is formation-blocking, with a cohort-pool fallback               |
| **Wrong founding-cohort culture**           | High if not deliberate       | ≤20% remote-professional constraint; recruitment across community layers; the cohort is treated as a governance decision                                                                                                                  |
| **Early moderation scandal**                | Medium                       | Redmond-calibrated policy; three trained moderators pre-launch; transparency log from day one; first-month incidents handled personally                                                                                                   |
| **Governance capture**                      | Medium without design        | 15% quorum and 1×–3× tenure weighting jointly; secret ballots; frozen proposal fields                                                                                                                                                     |
| **Silent exit (voice failure)**             | Medium                       | Track exit rate against appeal rate; act on divergence immediately                                                                                                                                                                        |
| **Verification excludes rural residents**   | High without design          | Multiple pathways; human review; PO box accommodation; Spanish flow; verify-then-forget                                                                                                                                                   |
| **Churn before sustainability**             | Medium                       | Saturation concentrates word of mouth; lean cost floor; staged salary keeps burn near zero; academic income de-risks the early years                                                                                                      |

## 11 — People, Partnerships & Steppe Connect

### Regional Partnership Foundation

Steppe does not build the ambitious work alone — it joins the coalitions
and borrows the regional credibility that already exist, and it shares
funding willingly. For connectivity, the bridge program, and the tribal
horizon, the right partner is not a convenience but the eligibility
itself. Three relationships anchor the rest:

  - **Connect Central Oregon** — a regional capacity-building nonprofit
    whose pillars — volunteerism, mentoring, innovation, partnerships —
    fill exactly the gaps a small founding team cannot. Its volunteer
    network spans 250+ regional organizations across all four Central
    Oregon counties and Warm Springs. The keystone relationship: a
    likely source of a board member and warm introductions to nearly
    everyone else — its role is capacity and connections; it does not
    itself run a fiscal-sponsorship program

  - **Oregon Broadband Equity Coalition** — an OSU Extension–led
    statewide coalition of community groups, Tribal Nations, internet
    providers, and government — free and open to join. Membership embeds
    Steppe in the network where rural and tribal connectivity work is
    coordinated and funded; it is the single highest-leverage move for
    the Connect program

  - **Economic Development for Central Oregon** — the region’s
    economic-development backbone and the bridge to Business Oregon,
    employer internship hosts, and the
    connectivity-as-economic-development framing that opens
    infrastructure funding

|                             |                                                                                                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FUNDING-SHARING POSTURE** | Steppe is glad to be a subawardee, co-applicant, or deployment partner rather than always the lead. For the ambitious work, shared funding through an established partner is faster and more credible than going alone — and stated openly, it makes Steppe the kind of partner these organizations want. |

### Internships & Scholarships

Three paid internship tracks — Tech, Community, and Data — above Oregon
minimum wage, with a public end-of-summer showcase and a pipeline to
part-time roles. The legible-codebase commitment exists partly for this:
the platform is built to be maintained by the community’s own students.
Three scholarships support the mission — a Community Builder award, a
Rural Digital Access award, and a Trades & Technical award. Each becomes
grant-fundable under charitable status, and each is itself a charitable
activity that strengthens the exemption.

### College & Makerspace Partnerships (2027+)

Central Oregon holds unusually deep fabrication and technical-education
capacity for a rural region, and much of it sits in Steppe’s launch
town: COCC’s 26,000-square-foot Manufacturing & Applied Technology
Center and 34,000-square-foot Redmond Technology Education Center — with
apprenticeship programs and a mobile classroom that already reaches
Madras, Prineville, and La Pine — are in Redmond. OSU-Cascades operates
a full-capability makerspace and prototyping studio in Bend; DIYcave
adds a 9,000-square-foot community shop; and the Deschutes Public
Library runs free makerspaces in Redmond and Bend. Steppe’s role in this
ecosystem is the community anchor, formalized by MOU:

  - **Internship pipeline alignment** — Steppe’s paid internship tracks
    connect to COCC’s CIS internship course and apprenticeship programs
    and to OSU-Cascades’ trained-student client-project model — students
    earn credit and pay maintaining real civic infrastructure their own
    community owns

  - **Community partner for the regional data-literacy bridge** — area
    institutions are developing a mastery-based, offline-capable
    data-literacy pathway pairing community-college and university
    programs with makerspace fabrication. That work is college-led and
    federally funded through institutional channels; Steppe participates
    as the community partner — deployment sites, internship placements,
    letters of collaboration, and possibly a modest community-partner
    subaward — never as the lead applicant

  - **Community access-device builds** — makerspace-fabricated kits —
    single-board computers in student-designed enclosures — deployed as
    library and community-center access points for the Connect program:
    hardware the community made, in shells its students designed,
    running infrastructure its members own

  - **Shared-commons governance** — access tiers, tool certification,
    and cross-institution rules are a commons-governance problem
    Steppe’s charter already knows how to think about; the MOUs apply
    the same design principles

  - **Who to approach** — the colleges are entered through their
    outward-facing units, not cold department emails: at OSU-Cascades,
    the Innovation Co-Lab (an incubator for nonprofits with a student
    software consultancy), then the Makerspace and Computer Science
    program; at COCC, the Center for Business, Industry & Professional
    Development for MOUs, the CIS department chair for the
    credit-bearing internship course, and the Redmond Manufacturing &
    Applied Technology Center — whose mobile tool shop already reaches
    Madras, Prineville, and La Pine — for fabrication and rural
    device-build events

### Steppe Connect — Rural Digital Access

A platform is only as public as the connection beneath it, and Central
Oregon’s rural towns sit on the wrong side of that line. Connect is the
program arm that extends Steppe from software into access — entirely
grant-funded by rule, never dues:

  - **Offline-first by design** — the platform already ships as an
    offline-capable application — rural and intermittent connections are
    a first-class design constraint, not an afterthought

  - **Community connectivity pilots (2028+)** — public access points at
    libraries, community centers, and fairgrounds in partner towns,
    built with makerspace-fabricated hardware and deployed with local
    partners — including the region’s cooperatives, the natural allies
    for rural last-mile work

  - **Deployment-scale projects** — pursued under the government-funding
    posture (sequenced, infrastructure-only, radically disclosed) with
    deployment-shaped partners — rural utility cooperatives, the Oregon
    Broadband Office, and USDA community-connectivity programs

  - **Named partners** — the Oregon Broadband Equity Coalition (the
    network to join first); Link Oregon, a nonprofit already serving
    Oregon’s tribal, education, and nonprofit sectors with network
    services, met through the coalition; Central Electric Cooperative,
    the Redmond-based member-owned cooperative and the philosophically
    aligned last-mile ally; and Free Geek, the statewide nonprofit
    device refurbisher and digital-navigator model for sourcing
    affordable access-point hardware

### The Tribal Digital Sovereignty Program

The long-horizon commitment, now stated precisely: complete tribal
ownership. Not managed services, not a white label, not a partnership
where the assets stay with Steppe — ownership of all four layers,
deeded:

  - **The platform** — a tribally-owned fork of the codebase, with full
    intellectual-property transfer

  - **The infrastructure** — network assets and equipment built to boost
    internet access on tribal lands, owned by the Tribes outright

  - **The data** — held under tribal data sovereignty from the first
    byte — no copy retained

  - **The governance** — the fork governed entirely by the tribal
    community, under whatever model it chooses; Steppe’s role is
    temporary technical partner with a written exit

The honest first step is relationship, not outreach with a plan. It
begins through the Warm Springs Community Action Team — a
tribal-member-led nonprofit on the reservation already doing
information-technology and manufacturing workforce development, with
grant capacity on staff — and through the Tribal Nation members of the
broadband coalition. Steppe listens for years before it proposes
anything, and any platform or infrastructure conversation is the
community’s to raise, on its timeline.

|                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SEQUENCE — UNCHANGED** | Questions before proposals. Formal engagement with the Confederated Tribes of Warm Springs’ council precedes any design, any grant application, and any commitment — and begins only from Steppe’s own organizational stability (2029 horizon). Funding runs through tribal-eligible channels co-applied with the Tribes as lead — state broadband set-asides and federal rural-connectivity programs — and never touches Steppe’s operating budget. This page exists for the board and funders; the Tribes hear questions first, not plans. |

### Town-by-Town Expansion

Expansion remains by petition and dual vote under the twelve-community
cap. The Connect program does not change the cap or the sequence —
access work can precede or follow a town’s membership, but platform
expansion is always the community’s own vote.

## 12 — Open Questions

### Resolved

  - Legal form: member-governed nonprofit from formation · No conversion
    event · Founder anchor: paid Founding ED + founder seat + bounded
    protection period (sunset at the earlier of six years or 3,500
    members sustained four quarters; negative-power concurrence over
    only entrenched-commitment amendments, dissolution/merger/asset
    sales, and lowering the amendment threshold) · Dues: flat $4/mo,
    billed annually or by ACH, with a no-documentation hardship waiver
    and three member-directed contribution buckets (sliding scale
    retired) · Moderator honoraria: $50–100/mo, capped at 8% of
    operating expenses, three-moderator minimum, staggered terms ·
    Compensation ceiling: $95,000 fixed-dollar, 3% COLA · Fiscal-sponsor
    bridge: a national Model C civic-technology sponsor · Multi-town
    governance: deferred-activation provision · Government money:
    accepted, sequenced last, radically transparent · Founding board:
    Chism, Cobb, Weimer

### Needing a Decision

  - Weimer’s acceptance — formation-blocking; cohort-pool fallback if he
    declines

  - Counsel selection — one Oregon nonprofit attorney for articles,
    bylaws, dues framing, and Terms

  - Exchange name with Redmond Compass · petition threshold for new
    towns

### Needing Work

  - Spanish native-speaker review · legal sign-off on Terms · brand
    palette + contrast pass · dry-run execution · youth account linkage
    and age-out design · emergency-alert delivery architecture · archive
    curation policy (with Warm Springs consultation)

  - Connect program — verify OSU-Cascades makerspace external-access
    policy and COCC partnership pathway; identify the rural cooperative
    deployment partner (Central Electric Cooperative the first call);
    confirm electronics-bench capacity for device builds (a documented
    gap across all regional makerspaces, and itself a fundable equipment
    ask); decide whether Steppe should ever serve as a Crook County
    grant-routing partner once Prineville is in petition range

  - Partnerships — confirm the current OSU-Cascades Innovation Co-Lab
    director (recent leadership transition); verify the broadband
    coalition’s nonprofit-formation status, which may change how Steppe
    engages it

## 13 — Sources & Influences

Steppe’s principles draw on a body of work in systems thinking, commons
governance, political economy, and design. The ideas are credited here
so the body of the plan can read in Steppe’s own voice while the
intellectual debts remain clear.

|                                    |                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------- |
| **Principle**                      | **Drawn from**                                                             |
| Anti-extraction by structure       | Cory Doctorow, on platform decay (“enshittification”)                      |
| Trust is a stock                   | Donella Meadows, Thinking in Systems                                       |
| A commons can be governed          | Elinor Ostrom, Governing the Commons (the eight design principles)         |
| Legibility must serve the governed | James C. Scott, Seeing Like a State (and the mētis / epistēmē distinction) |
| Voice, not silent exit             | Albert O. Hirschman, Exit, Voice, and Loyalty                              |
| Ownership structure is destiny     | Mehrsa Baradaran, on ownership and capture (The Quiet Coup)                |
| Convivial tools                    | Ivan Illich, Tools for Conviviality                                        |
| Design knowledge lives in patterns | Christopher Alexander, A Pattern Language                                  |

## 14 — Governance Charter v2: What Changed

The charter is updated in lockstep with this plan. The material changes
from v1:

  - **The board exists from day one** — retitled from “Board
    (Post-Conversion).” Adds the named founding board, the independence
    and conflict provisions, and the mandated transition to
    member-elected seats within 24 months

  - **The Executive Director role** — added as a defined section — the
    founder’s salaried, contracted, curatorial role, distinct from the
    board

  - **The Founder-Protection Period** — added — a bounded, sunsetting
    protection for the founding era

  - **The Community Fund** — replaces the conversion machinery; the
    giving waterfall and annual ranked-choice selection are retained,
    the conversion trigger deleted

  - **Government funding** — a transparency clause added — government
    money is permitted, sequenced, and subject to full public disclosure
    of every condition

STEPPE · Digital Civic Infrastructure · Business Plan v12 · June 2026 ·
Living Document
