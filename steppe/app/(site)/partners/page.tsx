// Partners (/partners) — rebuilt as React from the canonical design
// (_design-source/steppe-partners-v2.html), on the shared chrome + tokens. Text
// hero + compact strata, theory-of-change stations, the four structural-guarantee
// panels, the five-stream funding register + "no single funder over 30%" mix bar,
// and the partner ask + contact CTA. Static content; conservative claims carried
// as-is (Aspiration is the only named fiscal sponsor).
import "./partners.css";
import { StrataHorizon } from "../_components/strata-horizon";

export const metadata = {
  title: "Steppe — for partners",
  description:
    "Community-owned civic infrastructure for Redmond, Central Oregon — the model, the structural guarantees that protect it, how it's funded, and how to help build it.",
};

export default function PartnersPage() {
  return (
    <div className="partners">
      <header className="hero">
        <div className="hero-in">
          <span className="eyebrow">
            <span className="pip"></span>For partners &amp; funders
          </span>
          <h1>
            Civic infrastructure, built so it <em>can&rsquo;t be sold.</em>
          </h1>
          <p>
            Steppe is a member-governed public benefit nonprofit building
            community-owned digital infrastructure for Central Oregon. It carries
            no advertising, confirms that members are local, and is structurally
            protected from acquisition and enshittification.
          </p>
          <div className="factline">
            <span>Oregon public benefit nonprofit</span>
            <span>Fiscal sponsor — Aspiration</span>
            <span>Redmond · Central Oregon</span>
          </div>
        </div>
        <StrataHorizon variant="compact" />
      </header>

      {/* THEORY OF CHANGE */}
      <section className="section band-paper">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>Theory of change
            </span>
            <h2>Community life moved onto platforms that can be sold.</h2>
            <p>
              The places neighbors gather online are owned by companies that
              monetize attention and can be acquired, shut down, or quietly
              degraded whenever it suits the owner. Steppe is built so none of that
              can happen here.
            </p>
          </div>
          <div className="stations">
            <div className="stn">
              <div className="no">01</div>
              <div>
                <h3>The problem</h3>
                <p>
                  Local connection now runs through extractive, ad-driven
                  platforms with no accountability to the people who use them.
                  They sell attention, harvest data, and can be sold out from
                  under a community overnight.
                </p>
              </div>
            </div>
            <div className="stn">
              <div className="no">02</div>
              <div>
                <h3>The approach</h3>
                <p>
                  A member-owned commons: a public benefit nonprofit with no owner
                  and nothing to sell, governed by its residents, with its core
                  promises written into the founding documents where only members
                  can change them.
                </p>
              </div>
            </div>
            <div className="stn">
              <div className="no">03</div>
              <div>
                <h3>What changes</h3>
                <p>
                  Durable local civic infrastructure that belongs to the
                  community itself. Always ad-free, privacy-respecting, and
                  impossible to acquire or enshittify. All towns can adopt the same
                  model and govern it themselves.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STRUCTURAL GUARANTEES */}
      <section className="section band-feature">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-dark">
              <span className="pip"></span>Structural guarantees
            </span>
            <h2>Written into the legal form, where goodwill can&rsquo;t undo them.</h2>
          </div>
          <div className="panels">
            <div className="panel">
              <div className="pk">The form</div>
              <h3>No owner. Nothing to sell.</h3>
              <ul>
                <li>
                  <span className="ck">✓</span>
                  <span>
                    <b>Oregon public benefit nonprofit</b> — no shareholders, no
                    investors, no exit.
                  </span>
                </li>
                <li>
                  <span className="ck">✓</span>
                  <span>
                    <b>Mission &amp; dissolution clause</b> written into the
                    articles of incorporation.
                  </span>
                </li>
                <li>
                  <span className="ck">✓</span>
                  <span>
                    <b>Acquisition is structurally impossible</b> — there is no
                    equity to buy.
                  </span>
                </li>
              </ul>
            </div>
            <div className="panel">
              <div className="pk">The commitments</div>
              <h3>Five promises, entrenched.</h3>
              <ul>
                <li><span className="ck">✓</span><span>No advertising, ever</span></li>
                <li><span className="ck">✓</span><span>Residency verified, then forgotten</span></li>
                <li><span className="ck">✓</span><span>Community-controlled governance</span></li>
                <li><span className="ck">✓</span><span>Member-owned, exportable data</span></li>
                <li><span className="ck">✓</span><span>Decisions are reversible by vote</span></li>
              </ul>
            </div>
            <div className="panel">
              <div className="pk">The thresholds</div>
              <h3>How the members decide.</h3>
              <ul>
                <li><span className="t">15%</span><span>Quorum for any binding vote</span></li>
                <li><span className="t">60%</span><span>To pass a major policy</span></li>
                <li><span className="t">75%</span><span>To amend a foundational rule, with 30-day notice</span></li>
                <li><span className="t">60%</span><span>To recall a board member</span></li>
              </ul>
            </div>
            <div className="panel">
              <div className="pk">The surplus</div>
              <h3>Money flows back to the commons.</h3>
              <ul>
                <li>
                  <span className="ck">✓</span>
                  <span>
                    Any surplus goes to a <b>Community Fund</b>, not to an owner.
                  </span>
                </li>
                <li>
                  <span className="ck">✓</span>
                  <span>
                    Members allocate it yearly by <b>ranked-choice vote</b>.
                  </span>
                </li>
                <li>
                  <span className="ck">✓</span>
                  <span>Compensation is capped and published.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FUNDING */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>Sustainability
            </span>
            <h2>Five streams, no single point of capture.</h2>
            <p>
              Steppe is funded so that no single source can dictate its direction.
              Member dues are the anchor, and no one funder is allowed past a hard
              ceiling.
            </p>
          </div>
          <div className="fund">
            <div className="frow f-dues">
              <div className="fn">
                <b>Member dues</b>
                <span className="tag">The anchor</span>
              </div>
              <div className="fd">
                $4 a month, flat, from verified residents. The base that keeps
                Steppe accountable to members first.
              </div>
              <div className="fw">live at launch</div>
            </div>
            <div className="frow f-grants">
              <div className="fn">
                <b>Foundation grants</b>
                <span className="tag">Programs</span>
              </div>
              <div className="fd">
                Project funding for connectivity and digital-equity work, aligned
                to mission and time-bound.
              </div>
              <div className="fw">2026 onward</div>
            </div>
            <div className="frow f-don">
              <div className="fn">
                <b>Donations</b>
                <span className="tag">Community</span>
              </div>
              <div className="fd">
                Voluntary contributions above base dues, from members and local
                supporters.
              </div>
              <div className="fw">live at launch</div>
            </div>
            <div className="frow f-earned">
              <div className="fn">
                <b>Earned revenue</b>
                <span className="tag">Services</span>
              </div>
              <div className="fd">
                Mission-aligned services, like helping other communities stand up
                their own instances.
              </div>
              <div className="fw">as capacity allows</div>
            </div>
            <div className="frow f-gov">
              <div className="fn">
                <b>Government</b>
                <span className="tag">Last, transparent</span>
              </div>
              <div className="fd">
                Public funds taken last and only with radical transparency, to
                protect independence.
              </div>
              <div className="fw">2028+</div>
            </div>
          </div>
          <div className="guard">
            <span>No single funder over 30%</span>
            <span className="mixbar">
              <i style={{ width: "28%", background: "var(--dues)" }}></i>
              <i style={{ width: "26%", background: "var(--grants)" }}></i>
              <i style={{ width: "20%", background: "var(--donations)" }}></i>
              <i style={{ width: "16%", background: "var(--earned)" }}></i>
              <i style={{ width: "10%", background: "var(--gov)" }}></i>
            </span>
            <span>illustrative target mix</span>
          </div>
        </div>
      </section>

      {/* THE ASK */}
      <section className="section band-bedrock">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-dark">
              <span className="pip"></span>Partner with us
            </span>
            <h2>What we&rsquo;re looking for.</h2>
          </div>
          <div className="ask-grid">
            <div className="ask">
              <h3>Capacity &amp; board pipeline</h3>
              <p>
                Introductions, governance expertise, and connections to people
                who&rsquo;ll help steer a member-led organization.
              </p>
            </div>
            <div className="ask">
              <h3>Grants &amp; foundation partners</h3>
              <p>
                Project funding for rural connectivity and digital-equity programs
                across Central Oregon.
              </p>
            </div>
            <div className="ask">
              <h3>Program partners</h3>
              <p>
                Broadband-equity, education, and economic-development
                organizations building local digital capacity.
              </p>
            </div>
            <div className="ask">
              <h3>Other communities</h3>
              <p>
                Towns that want civic infrastructure of their own and intend to
                govern it themselves.
              </p>
            </div>
          </div>
          <div className="cta-row">
            <a className="btn btn-primary" href="mailto:hello@steppe.community">
              Get in touch{" "}
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 8h9M8.5 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <span className="contact">hello@steppe.community</span>
          </div>
        </div>
      </section>
    </div>
  );
}
