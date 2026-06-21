// Landing (/) — rebuilt as React from the canonical design
// (_design-source/steppe-landing-v5.html), on the shared chrome + tokens. Hero
// (StrataHorizon + phone preview), promises as charter clauses, the exchange as a
// register on the juniper feature band, governance + rotating seal, and the
// bedrock CTA. Nav + footer come from the (site) layout; reveal-on-scroll is the
// reduced-motion- and no-JS-safe <Reveal /> island.
import Link from "next/link";
import "./landing.css";
import { StrataHorizon } from "./_components/strata-horizon";
import { SealMark } from "./_components/seal-mark";
import { Reveal } from "./_components/reveal";
import { WindField } from "./_components/wind-field";

export const metadata = {
  title: "Steppe — a high desert civic commons",
  description:
    "Steppe is verified, ad-free, member-owned civic infrastructure for the people of Redmond, Oregon. No ads. No tracking. Your data stays yours.",
};

const ArrowRight = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3 8h9M8.5 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function LandingPage() {
  return (
    <>
      <Reveal />

      <header className="hero">
        <WindField />
        <svg
          className="hero-contour"
          viewBox="0 0 600 500"
          fill="none"
          aria-hidden="true"
        >
          <g stroke="currentColor" strokeWidth="1.2" opacity=".55" fill="none">
            <path d="M-20 180 Q150 120 300 170 T620 150" />
            <path d="M-20 220 Q150 165 300 210 T620 192" />
            <path d="M-20 262 Q150 212 300 252 T620 236" />
            <path d="M-20 306 Q150 260 300 296 T620 282" />
            <path d="M-20 352 Q150 310 300 342 T620 330" />
            <path d="M-20 400 Q150 360 300 390 T620 380" />
          </g>
        </svg>

        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1C5 1 3 3.2 3 6c0 3.6 5 9 5 9s5-5.4 5-9c0-2.8-2-5-5-5z" stroke="#A8542C" strokeWidth="1.3" />
                <circle cx="8" cy="6" r="1.7" fill="#A8542C" />
              </svg>{" "}
              44.27°N&nbsp; 121.17°W — Redmond, Oregon
            </span>
            <h1>
              A place that <span className="em">belongs</span> to the people in it.
            </h1>
            <p className="lead">
              Steppe is civic infrastructure for the people of Central Oregon,
              owned by the members who use it. It carries no ads and no tracking,
              and no investor can ever buy it out. What you share here stays yours.
            </p>
            <div className="hero-cta">
              <Link className="btn btn-primary" href="/join">
                Sign in or join <ArrowRight />
              </Link>
              <Link className="btn btn-ghost" href="/preview">
                See the preview
              </Link>
            </div>
            <div className="trustline">
              <span>Verified residents</span>
              <span>No advertising</span>
              <span>Member-owned</span>
            </div>
          </div>

          <div className="phone-stage">
            <div className="phone">
              <div className="screen">
                <div className="scr-status">
                  <span>9:41</span>
                  <span className="dots">
                    <i className="on"></i>
                    <i className="on"></i>
                    <i></i>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 9, marginLeft: 3 }}>▮</span>
                  </span>
                </div>
                <div className="scr-top">
                  <SealMark size={24} clipId="seal-phone" />
                  <span className="nm">Steppe</span>
                  <span className="loc-pill">
                    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 1C5 1 3 3.2 3 6c0 3.6 5 9 5 9s5-5.4 5-9c0-2.8-2-5-5-5z" stroke="#36563D" strokeWidth="1.6" />
                    </svg>
                    Redmond
                  </span>
                </div>
                <div className="scr-feed">
                  <div className="fcard">
                    <span className="chip offer">Offer</span>
                    <div className="fh">Free tomato starts — 40+ plants</div>
                    <p>Grew too many Early Girls this spring. Free to a good home.</p>
                    <div className="fmeta">
                      <span className="av" style={{ background: "#9CAD8B" }}>MK</span>
                      Martha K.<span className="t">2h</span>
                    </div>
                  </div>
                  <div className="fcard">
                    <span className="chip need">Need</span>
                    <div className="fh">Electrician who knows older homes</div>
                    <p>Panel upgrade on a 1970s house — licensed &amp; insured.</p>
                    <div className="fmeta">
                      <span className="av" style={{ background: "#A8542C" }}>JR</span>
                      James R.<span className="t">5h</span>
                    </div>
                  </div>
                  <div className="fcard">
                    <span className="chip gather">Gathering</span>
                    <div className="fh">Member meeting — July 12</div>
                    <p>Community Fund proposals &amp; new-member welcome.</p>
                    <div className="fmeta">
                      <span className="av" style={{ background: "#36563D" }}>St</span>
                      Steppe<span className="t">calendar</span>
                    </div>
                  </div>
                </div>
                <div className="scr-tab">
                  <div className="tab active">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 6h18M3 12h18M3 18h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    Exchange
                  </div>
                  <div className="tab">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="8" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="16" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M3.5 19c0-2.8 2-4.5 4.5-4.5S12.5 16.2 12.5 19M11.5 19c0-2.8 2-4.5 4.5-4.5s4.5 1.7 4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Groups
                  </div>
                  <div className="tab">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="4" y="9" width="16" height="11" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 9V5m-3 9h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    Govern
                  </div>
                  <div className="tab">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="8.5" r="3.4" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M5.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    You
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <StrataHorizon variant="hero" />
      </header>

      <section className="section band-alt">
        <div className="wrap">
          <div className="section-head rv">
            <span className="eyebrow">
              <span className="pip"></span>What we promise
            </span>
            <h2>Written down, and hard to undo.</h2>
            <p className="dek">
              Four commitments, written into the founding documents. They can only
              change if members vote to change them.
            </p>
          </div>
          <div className="charter">
            <div className="clause rv">
              <div className="ltr">a.</div>
              <div>
                <h3>No advertising, ever</h3>
                <p>No ads, now or later. Nobody pays to put a message in front of you, and nothing about you is sold to anyone, ever.</p>
              </div>
              <span className="mark">Entrenched</span>
            </div>
            <div className="clause rv">
              <div className="ltr">b.</div>
              <div>
                <h3>Verify residency, then forget it</h3>
                <p>We confirm you live in Central Oregon, then instantly delete what you sent. We will never keep a file on you.</p>
              </div>
              <span className="mark">Entrenched</span>
            </div>
            <div className="clause rv">
              <div className="ltr">c.</div>
              <div>
                <h3>Members govern, by secret ballot</h3>
                <p>Members decide the rules and the budget together, by secret ballot. Your vote counts exactly as much as anyone else&rsquo;s.</p>
              </div>
              <span className="mark">Entrenched</span>
            </div>
            <div className="clause rv">
              <div className="ltr">d.</div>
              <div>
                <h3>Your data leaves with you</h3>
                <p>Export everything and take it with you whenever you want. Nothing here is built to keep you from leaving.</p>
              </div>
              <span className="mark">Entrenched</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-paper">
        <div className="wrap">
          <div className="section-head rv">
            <span className="eyebrow">
              <span className="pip"></span>Joining
            </span>
            <h2>From neighbor to member.</h2>
            <p className="dek">
              Four steps, start to finish. No anonymous handles and no bots.
              Everyone here is a real neighbor.
            </p>
          </div>
          <div className="stations">
            <div className="station rv">
              <div className="no">01</div>
              <div>
                <h3>Verify you&rsquo;re local</h3>
                <p>Confirm you live in the Central Oregon. We check once, then instantly delete what you sent. Real neighbors only.</p>
              </div>
            </div>
            <div className="station rv">
              <div className="no">02</div>
              <div>
                <h3>
                  Join for <span className="stamp">$4 / month</span>
                </h3>
                <p>That&rsquo;s the whole membership. Pay once a year or by bank transfer. And if money&rsquo;s tight right now, the hardship waiver is yours, no questions asked.</p>
              </div>
            </div>
            <div className="station rv">
              <div className="no">03</div>
              <div>
                <h3>Settle in</h3>
                <p>Join groups, post to the local exchange, ask for a hand and lend one, and get to know the people who actually live around you.</p>
              </div>
            </div>
            <div className="station rv">
              <div className="no">04</div>
              <div>
                <h3>Help steer it</h3>
                <p>Help decide the budget, the rules, and where Steppe goes next. Your ballot is secret, and it counts the same as anyone&rsquo;s.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-feature on-dark">
        <div className="wrap">
          <div className="section-head rv">
            <span className="eyebrow on-dark">
              <span className="pip"></span>What neighbors share
            </span>
            <h2>One local exchange.</h2>
            <p className="dek">
              Someone needs a hand. Someone has tomatoes to give away.
              Someone&rsquo;s calling a meeting. It all lands in one plain feed,
              newest first within your chosen categories, with no algorithm.
            </p>
          </div>
          <div className="register">
            <div className="lx-row cat-offer rv">
              <div className="lx-main">
                <div className="lx-cat">
                  <span className="dot"></span>Offer
                </div>
                <div className="lx-ttl">Free tomato starts — 40+ plants</div>
                <div className="lx-desc">Grew too many Early Girls this spring. Free to anyone who&rsquo;ll plant them. Pickup near downtown.</div>
              </div>
              <div className="lx-who">
                <div className="av2">MK</div>
                <div className="lx-meta">Martha K.<span>2h ago</span></div>
              </div>
            </div>
            <div className="lx-row cat-need rv">
              <div className="lx-main">
                <div className="lx-cat">
                  <span className="dot"></span>Need
                </div>
                <div className="lx-ttl">Electrician who knows older homes</div>
                <div className="lx-desc">Panel upgrade on a 1970s house. Looking for someone licensed and insured who&rsquo;s worked on older Redmond homes.</div>
              </div>
              <div className="lx-who">
                <div className="av2">JR</div>
                <div className="lx-meta">James R.<span>5h ago</span></div>
              </div>
            </div>
            <div className="lx-row cat-gather rv">
              <div className="lx-main">
                <div className="lx-cat">
                  <span className="dot"></span>Gathering
                </div>
                <div className="lx-ttl">Member meeting — July 12</div>
                <div className="lx-desc">Monthly open meeting: Community Fund proposals, governance Q&amp;A, new-member welcome.</div>
              </div>
              <div className="lx-who">
                <div className="av2">St</div>
                <div className="lx-meta">Steppe<span>adds to calendar</span></div>
              </div>
            </div>
            <div className="lx-row cat-aid rv">
              <div className="lx-main">
                <div className="lx-cat">
                  <span className="dot"></span>Mutual aid
                </div>
                <div className="lx-ttl">Rides to medical appointments</div>
                <div className="lx-desc">Can offer two rides a week for neighbors needing transportation to Bend. Flexible on timing.</div>
              </div>
              <div className="lx-who">
                <div className="av2">DL</div>
                <div className="lx-meta">Dana L.<span>3h ago</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-base">
        <div className="wrap gov">
          <div className="copy rv">
            <span className="eyebrow">
              <span className="pip"></span>Governed by its members
            </span>
            <h2>Built so it can&rsquo;t be sold out from under you.</h2>
            <p>
              Steppe is an Oregon public benefit nonprofit. There&rsquo;s no owner,
              no investors, and nothing for anyone to buy. The members run it, and
              the promises on this page are written into its founding documents.
              Only the members can change them.
            </p>
          </div>
          <div className="seal-wrap rv">
            <svg width="220" height="220" viewBox="0 0 220 220" fill="none" aria-label="Steppe community seal">
              <circle cx="110" cy="110" r="106" fill="#FBF7EE" stroke="#36563D" strokeWidth="2" />
              <circle cx="110" cy="110" r="96" fill="none" stroke="#A8542C" strokeWidth="1" strokeDasharray="2 5" />
              <g className="seal-spin" style={{ transformOrigin: "110px 110px" }}>
                <path id="sealpath" d="M110 24 a86 86 0 1 1 0 172 a86 86 0 1 1 0 -172" fill="none" />
                <text fontFamily="DM Mono, monospace" fontSize="11" letterSpacing="2.6" fill="#36563D">
                  <textPath href="#sealpath" startOffset="0%">
                    STEPPE · REDMOND, OREGON · EST. 2026 · MEMBER-GOVERNED ·{" "}
                  </textPath>
                </text>
              </g>
              <clipPath id="sealdisc">
                <circle cx="110" cy="112" r="58" />
              </clipPath>
              <g clipPath="url(#sealdisc)">
                <rect x="48" y="120" width="124" height="60" fill="#34383D" />
                <rect x="48" y="108" width="124" height="14" fill="#36563D" />
                <path d="M48 110 Q82 96 110 106 T172 102 V122 H48Z" fill="#9CAD8B" />
                <path d="M48 124 Q90 114 132 122 T172 120 V140 H48Z" fill="#2B4733" />
                <circle cx="140" cy="100" r="13" fill="#A8542C" />
              </g>
              <circle cx="110" cy="112" r="58" fill="none" stroke="#36563D" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </section>

      <section className="section band-bedrock on-dark">
        <div className="wrap cta-final rv">
          <span className="eyebrow on-dark" style={{ justifyContent: "center" }}>
            <span className="pip"></span>Your seat is open
          </span>
          <h2>Pull up a chair.</h2>
          <p>Join your neighbors in a place that belongs to all of you.</p>
          <Link className="btn btn-primary" href="/join">
            Sign in or join <ArrowRight />
          </Link>
        </div>
      </section>
    </>
  );
}
