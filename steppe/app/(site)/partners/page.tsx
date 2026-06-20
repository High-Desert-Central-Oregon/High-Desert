import "./partners.css";

export const metadata = {
  title: "Steppe — for partners & funders",
  description:
    "Community-owned civic infrastructure for Central Oregon — the model, the governance that protects it, and how to help build it.",
};

// Verbatim markup from _design-source/steppe-partners.html (static, no script).
// Styles in ./partners.css. Conservative claims carried as-is (Aspiration is the
// only named fiscal sponsor; no invented names).
const HTML = String.raw`

  <section class="hero">
    <div class="scene" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--sky-high)"/><stop offset="55%" stop-color="var(--sky-mid)"/><stop offset="100%" stop-color="var(--sky-low)"/>
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="#F6E2C0"/><stop offset="100%" stop-color="#F6E2C0" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#E4DCCB" stop-opacity="0"/><stop offset="100%" stop-color="#E7DECC" stop-opacity=".82"/>
          </linearGradient>
          <g id="pine"><path d="M24 2 L31 20 L27 20 L36 38 L31 38 L43 58 L27 58 L27 66 L21 66 L21 58 L5 58 L17 38 L12 38 L21 20 L17 20 Z" fill="var(--juniper)"/></g>
        </defs>
        <rect x="0" y="0" width="1440" height="900" fill="url(#sky)"/>
        <circle class="l-sun" cx="1180" cy="210" r="260" fill="url(#glow)"/>
        <path class="l-far" d="M0 470 L160 410 L300 452 L470 388 L640 452 L820 404 L1010 456 L1200 402 L1380 452 L1440 432 L1440 480 L0 480 Z" fill="#9BA697" opacity=".34"/>
        <g class="l-peaks">
          <path d="M560 474 L700 360 L760 300 L842 384 L900 330 L980 250 L1082 362 L1180 320 L1290 474 Z" fill="#7C8A7E" opacity=".55"/>
          <path d="M946 286 L980 250 L1016 286 L996 298 L980 290 L964 298 Z" fill="var(--snow)" opacity=".85"/>
          <path d="M730 332 L760 300 L792 334 L772 344 L760 338 L746 344 Z" fill="var(--snow)" opacity=".8"/>
        </g>
        <rect x="0" y="356" width="1440" height="150" fill="url(#haze)"/>
        <path class="l-ridge" d="M0 560 C220 548 360 556 560 520 C780 484 1000 502 1240 474 C1330 464 1390 470 1440 466 L1440 900 L0 900 Z" fill="var(--sage)" opacity=".48"/>
        <path class="l-trees" d="M0 650 C240 642 420 650 620 641 C820 632 1000 651 1240 637 C1330 631 1390 641 1440 635 L1440 900 L0 900 Z" fill="var(--juniper)" opacity=".96"/>
        <g class="l-trees">
          <use href="#pine" transform="translate(622,563) scale(1.1)"/><use href="#pine" transform="translate(683,583) scale(.8)"/>
          <use href="#pine" transform="translate(861,550) scale(1.3)"/><use href="#pine" transform="translate(926,580) scale(.85)"/>
          <use href="#pine" transform="translate(1152,560) scale(1.15)"/><use href="#pine" transform="translate(1213,583) scale(.8)"/>
          <use href="#pine" transform="translate(1337,557) scale(1.2)"/><use href="#pine" transform="translate(1394,582) scale(.82)"/>
        </g>
        <path d="M0 700 C360 690 760 712 1120 698 C1280 692 1380 707 1440 698 L1440 716 L0 716 Z" fill="var(--rust)" opacity=".15"/>
        <path d="M0 716 C340 705 720 732 1100 716 C1280 708 1380 726 1440 716 L1440 824 L0 824 Z" fill="var(--bone-deep)"/>
        <path d="M0 824 C400 815 820 838 1200 823 C1320 818 1400 833 1440 826 L1440 900 L0 900 Z" fill="var(--bone)"/>
        <g class="l-contour" fill="none" stroke="var(--juniper-line)" stroke-opacity=".14" stroke-width="1.4">
          <path d="M-80 748 C240 736 560 760 880 748 C1140 738 1360 758 1600 748"/>
          <path d="M-80 800 C260 788 620 812 980 798 C1200 790 1400 808 1600 798"/>
          <path d="M-80 852 C320 840 740 864 1140 850 C1320 844 1460 860 1600 852"/>
        </g>
      </svg>
    </div>
    <div class="lightwash" aria-hidden="true"></div>
    <div class="scrim" aria-hidden="true"></div>

    <div class="topbar">
      <div class="byline">A project led by <a href="#">Greg Chism</a></div>
    </div>

    <div class="heromain">
      <div class="hcopy">
        <p class="eyebrow">For partners &amp; funders</p>
        <h1 class="htitle">Community-owned civic infrastructure for Central Oregon.</h1>
        <p class="hlede">Steppe is a member-governed nonprofit platform for Redmond — verified neighbors, local exchange, and community decisions that can't be sold to anyone. Here is the model, the governance that protects it, and how you can help build it.</p>
        <div class="badges">
          <span class="badge"><span class="d"></span> Oregon Public Benefit Nonprofit</span>
          <span class="badge"><span class="d"></span> 501(c)(3) via fiscal sponsor</span>
          <span class="badge"><span class="d"></span> Member-governed</span>
          <span class="badge"><span class="d"></span> Ad-free, always</span>
        </div>
      </div>
    </div>
  </section>

  <!-- THEORY OF CHANGE -->
  <section class="sec sec--bone">
    <div class="in prose">
      <p class="eyebrow2">The bet</p>
      <h2 class="h2">Why a commons, not a platform.</h2>
      <p>Almost every community platform begins with good intentions and ends the same way — sold, monetized, and slowly turned against the people who made it valuable. That isn't a failure of character. It's a failure of structure: anything built to be owned can be bought, and anything that can be bought eventually answers to its buyer instead of its users.</p>
      <p>Steppe removes the cause. It is an Oregon public benefit nonprofit with no owner and no shares — there is nothing to acquire. The people who use it govern it, and the commitments that protect them — no ads, no surveillance, member-owned data — are written into its founding documents, changeable only by the members themselves.</p>
      <p>Community ownership isn't a feature we added on top. It's the structure that makes every other promise durable — grounded in decades of research on how communities govern shared resources well, over the long run, without selling them off.</p>
    </div>
  </section>

  <!-- FEATURES -->
  <section class="sec sec--soft">
    <div class="in">
      <p class="eyebrow2">What it is</p>
      <h2 class="h2">Everything a local community needs — and nothing it doesn't.</h2>
      <p class="lead">Built for Redmond, designed to grow on members' terms rather than investors'. The platform ships lean; the community decides what comes next.</p>

      <p class="subhead">Live at launch</p>
      <div class="fgrid">
        <div class="fcard"><h3>Verified members</h3><p>Real identity, real neighbors. Verification gates every account and is then held privately — building genuine local trust from day one.</p><span class="ftag">Core</span></div>
        <div class="fcard"><h3>Local exchange</h3><p>Needs, offers, jobs, goods, mutual aid, and events in one feed. Events export to any calendar via open standards. Member data stays on-platform.</p><span class="ftag">Core</span></div>
        <div class="fcard"><h3>Groups</h3><p>Neighborhood clusters, interest groups, and civic working groups — each with its own feed, members, and place in governance.</p><span class="ftag">Core</span></div>
        <div class="fcard"><h3>Member chat</h3><p>Direct and group messaging that stays inside the commons — no third-party messenger, no conversation data handed to anyone.</p><span class="ftag">Core</span></div>
        <div class="fcard"><h3>Member governance</h3><p>Flat-franchise voting at launch — every verified member has an equal voice on dues, policy, and how the surplus is spent.</p><span class="ftag">Core</span></div>
        <div class="fcard"><h3>Dues &amp; billing</h3><p>$4 a month, billed yearly or by bank transfer, with a no-questions hardship waiver. Voluntary contributions above the base go to the Community Fund.</p><span class="ftag">Core</span></div>
      </div>

      <p class="subhead">Member-gated growth — activated only by member vote</p>
      <div class="fgrid">
        <div class="fcard"><h3>Neighbor tier</h3><p>A lighter-verified way for locals who aren't yet members to view and connect — extending reach without opening the core.</p><span class="ftag gate">Member-gated</span></div>
        <div class="fcard"><h3>Tenure-weighted voting</h3><p>An optional 1×–3× weighting earned over time. Off at launch; introduced only if members vote it in — never by founder fiat.</p><span class="ftag gate">Member-gated</span></div>
        <div class="fcard"><h3>Moderation corps</h3><p>Community-chosen moderators with transparent standards and appeals, compensated within a capped budget. No opaque corporate moderation.</p><span class="ftag gate">Member-gated</span></div>
        <div class="fcard"><h3>Commercial marketplace</h3><p>A local marketplace layer for Redmond businesses — admitted only on terms the membership sets, if the membership wants it at all.</p><span class="ftag gate">Member-gated</span></div>
        <div class="fcard"><h3>Community Fund allocation</h3><p>An annual ranked-choice vote directing the year's surplus to the local causes members choose. Built when there's a surplus to direct.</p><span class="ftag gate">Member-gated</span></div>
        <div class="fcard"><h3>SMS &amp; push alerts</h3><p>Opt-in critical alerts over owned, deliverable channels — so the things that matter reach people, with no notification spam by design.</p><span class="ftag gate">Member-gated</span></div>
      </div>
      <p style="margin-top:28px"><a href="/preview" style="color:var(--juniper); font-weight:600; text-decoration:none">See a working preview of the app →</a></p>
    </div>
  </section>

  <!-- GOVERNANCE -->
  <section class="sec sec--bone">
    <div class="in">
      <p class="eyebrow2">Governance</p>
      <h2 class="h2">Built so it can't be captured.</h2>
      <p class="lead">The protections aren't promises in a blog post — they're structure. A small set of commitments is entrenched in the governing documents; everything else is a dial the members can turn.</p>
      <div class="gov2">
        <div class="gpanel dark">
          <h3>Entrenched protections</h3>
          <ul class="glist">
            <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2CBB1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Oregon public benefit nonprofit — no owner, cannot be sold</li>
            <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2CBB1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> No ads, ever — entrenched at a 75% supermajority</li>
            <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2CBB1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Member-owned data — no surveillance, no sale, exportable</li>
            <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2CBB1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Surplus flows to a member-directed Community Fund</li>
            <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2CBB1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Founder authority is bounded and sunsets — no permanent control</li>
          </ul>
        </div>
        <div class="gpanel light">
          <h3>How members govern</h3>
          <ul class="glist">
            <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A65530" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> A member-amendable Schedule of Defaults for everyday rules</li>
            <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A65530" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Equal vote for every member at launch; weighting only by member vote</li>
            <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A65530" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Board recall by a 60% member vote</li>
            <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A65530" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Growth features activate only with member approval</li>
            <li><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A65530" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Hardship waivers — no documentation, no committee, full membership</li>
          </ul>
        </div>
      </div>
      <div class="metrics">
        <div class="metric"><span class="v">15%</span><span class="l">Quorum</span></div>
        <div class="metric"><span class="v">60%</span><span class="l">Policy vote</span></div>
        <div class="metric"><span class="v">75%</span><span class="l">Foundational amendment</span></div>
        <div class="metric"><span class="v">60%</span><span class="l">Board recall</span></div>
      </div>
    </div>
  </section>

  <!-- FUNDING -->
  <section class="sec sec--soft">
    <div class="in">
      <p class="eyebrow2">Sustainability</p>
      <h2 class="h2">Funded so no single backer can capture it.</h2>
      <p class="lead">Five independent streams, none allowed to dominate — the financial version of the same anti-capture logic that shapes the governance.</p>
      <div class="streams">
        <div class="stream"><span class="sn">01</span><h4>Member dues</h4><p>The anchor. $4/month flat — predictable, broad-based, member-aligned.</p></div>
        <div class="stream"><span class="sn">02</span><h4>Donations</h4><p>Tax-deductible gifts from neighbors and supporters who believe in the model.</p></div>
        <div class="stream"><span class="sn">03</span><h4>Foundation grants</h4><p>Mission-aligned philanthropy for launch, capacity, and the program arms.</p></div>
        <div class="stream"><span class="sn">04</span><h4>Earned revenue</h4><p>Optional, member-approved services that never compromise the core.</p></div>
        <div class="stream"><span class="sn">05</span><h4>Government</h4><p>Deliberately last — not before 2028, and only on radically transparent terms.</p></div>
      </div>
      <p class="note">No single funder provides more than 30% of the budget. 501(c)(3) status is in place through our fiscal sponsor, <strong>Aspiration</strong>, so grants and tax-deductible gifts can be received today — before independent exemption is finalized.</p>
    </div>
  </section>

  <!-- HORIZON -->
  <section class="sec sec--juniper">
    <div class="in">
      <p class="eyebrow2">On the horizon</p>
      <h2 class="h2">Where this goes next.</h2>
      <p class="lead">The platform comes first. Two longer-horizon commitments extend the same principle — community-owned infrastructure — beyond the app.</p>
      <div class="prog">
        <div class="pblock">
          <span class="ttl">Steppe Connect</span>
          <span class="when">Program arm · 2027+</span>
          <p>A grant-funded effort to extend reliable connectivity across rural Central Oregon — built and held as community infrastructure, not sold as a subscription. Pursued alongside regional partners working on the same gap.</p>
        </div>
        <div class="pblock">
          <span class="ttl">Digital sovereignty</span>
          <span class="when">A relationship to earn</span>
          <p>A commitment we approach slowly and in a listening posture: supporting Indigenous communities in owning their own digital infrastructure, end to end, on their own terms. This is a partnership to be invited into, not a program to launch — and we treat it that way.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ASK -->
  <section class="sec sec--bone">
    <div class="in">
      <p class="eyebrow2">Partner with us</p>
      <h2 class="h2">Help build the commons.</h2>
      <p class="lead">Steppe is launching with a founding cohort in Redmond. The model is proven on paper and built in code; what it needs now is the support to reach the people it's for.</p>
      <div class="ways">
        <div class="way"><h3>Foundational support</h3><p>Catalytic funding for launch and the first year carries the most weight — and is fully tax-deductible through our fiscal sponsor today.</p></div>
        <div class="way"><h3>Capacity &amp; introductions</h3><p>Board candidates, legal and nonprofit expertise, and introductions across the Central Oregon ecosystem.</p></div>
        <div class="way"><h3>Spread the word</h3><p>Help us reach Redmond residents and the partners who serve them. Reach is the scarcest resource at launch.</p></div>
      </div>
      <a class="cta" href="/join"><span>Start a conversation</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
    </div>
  </section>

`;

export default function PartnersPage() {
  return <div dangerouslySetInnerHTML={{ __html: HTML }} />;
}
