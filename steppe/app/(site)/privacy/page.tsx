// Privacy (/privacy) — rebuilt from the canonical design
// (_design-source/steppe-privacy.html) on the shared chrome + tokens. Plain-
// language document: the six commitments, what we collect and why, your rights,
// and the closing. Static content. The full legal policy is referenced; questions
// route to hello@steppe.community.
import "./privacy.css";
import { StrataHorizon } from "../_components/strata-horizon";

export const metadata = {
  title: "Steppe — privacy",
  description:
    "Privacy at Steppe is the structure, not a setting: a member-owned nonprofit with no ads, no trackers, and no data to sell. What we collect, why, and your rights — in plain language.",
};

export default function PrivacyPage() {
  return (
    <div className="privacy">
      <header className="hero">
        <div className="hero-in">
          <span className="eyebrow">
            <span className="pip"></span>Privacy
          </span>
          <h1>
            Your privacy is the structure, not a <em>setting.</em>
          </h1>
          <p>
            Most platforms bury privacy in a menu you have to find. At Steppe
            it&rsquo;s built into what we are — a member-owned nonprofit with no
            ads, no trackers, and no data to sell. Here&rsquo;s exactly what that
            means, in plain language.
          </p>
          <div className="updated">Last updated — June 2026</div>
        </div>
        <StrataHorizon variant="compact" />
      </header>

      <section className="section band-alt">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>Our commitments
            </span>
            <h2>Six promises we keep.</h2>
          </div>
          <div className="charter">
            <div className="clause">
              <div className="ltr">a.</div>
              <div>
                <h3>We never sell or share your data</h3>
                <p>
                  There&rsquo;s no one to sell it to and no business model that
                  wants it. Steppe is funded by member dues, not by your
                  information.
                </p>
              </div>
            </div>
            <div className="clause">
              <div className="ltr">b.</div>
              <div>
                <h3>No advertising, no ad-tech</h3>
                <p>
                  No third-party trackers, no pixels, no behavioral profiling, no
                  algorithmic feed deciding what you see.
                </p>
              </div>
            </div>
            <div className="clause">
              <div className="ltr">c.</div>
              <div>
                <h3>We verify residency, then forget it</h3>
                <p>
                  We confirm you live in the area, then delete the documents you
                  used to prove it. We don&rsquo;t keep a file on you.
                </p>
              </div>
            </div>
            <div className="clause">
              <div className="ltr">d.</div>
              <div>
                <h3>Your profile is private by default</h3>
                <p>
                  Every field starts hidden. You choose, one at a time, whether
                  it&rsquo;s visible to no one, to members, or to everyone.
                </p>
              </div>
            </div>
            <div className="clause">
              <div className="ltr">e.</div>
              <div>
                <h3>Messages stay inside Steppe</h3>
                <p>
                  Conversations between neighbors aren&rsquo;t read, scanned, or
                  mined. They&rsquo;re yours.
                </p>
              </div>
            </div>
            <div className="clause">
              <div className="ltr">f.</div>
              <div>
                <h3>You can leave with everything</h3>
                <p>
                  Export all of your data any time, and delete your account
                  whenever you want. When you go, we delete our copy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>The record
            </span>
            <h2>What we collect, and why.</h2>
            <p>
              The minimum needed to run a verified, member-owned membership —
              nothing kept &ldquo;just in case.&rdquo;
            </p>
          </div>
          <div className="collect">
            <div className="crow">
              <div className="cn">
                <b>Account basics</b>
                <span className="tag">Required</span>
              </div>
              <div className="cw">
                Your email and username, so you can sign in and neighbors can reach
                you.
              </div>
              <div className="cr">
                <b>While a member</b>deleted on leaving
              </div>
            </div>
            <div className="crow">
              <div className="cn">
                <b>Dues &amp; payment</b>
                <span className="tag">Required</span>
              </div>
              <div className="cw">
                Handled by our payment processor. We see that you&rsquo;ve paid — we
                don&rsquo;t store your card.
              </div>
              <div className="cr">
                <b>Processor</b>not held by us
              </div>
            </div>
            <div className="crow">
              <div className="cn">
                <b>Residency check</b>
                <span className="tag">Once</span>
              </div>
              <div className="cw">
                Proof that you live in the area, reviewed to confirm eligibility,
                then removed.
              </div>
              <div className="cr">
                <b>Deleted</b>after verification
              </div>
            </div>
            <div className="crow">
              <div className="cn">
                <b>What you post</b>
                <span className="tag">You choose</span>
              </div>
              <div className="cw">
                Listings, messages, group activity, and votes you cast — created and
                removed by you.
              </div>
              <div className="cr">
                <b>Until you</b>delete it
              </div>
            </div>
            <div className="crow">
              <div className="cn">
                <b>Minimal logs</b>
                <span className="tag">Security</span>
              </div>
              <div className="cw">
                Basic technical records to keep the service running and safe. No
                tracking profiles.
              </div>
              <div className="cr">
                <b>Short-term</b>then purged
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-alt">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>Your rights
            </span>
            <h2>You&rsquo;re in charge of it.</h2>
          </div>
          <div className="rights">
            <div className="right">
              <div className="ri">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <div>
                <b>See it</b>
                <span>View everything we hold about you.</span>
              </div>
            </div>
            <div className="right">
              <div className="ri">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3v11m0-11l-4 4m4-4l4 4M5 15v4h14v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <b>Export it</b>
                <span>Download your data and take it with you.</span>
              </div>
            </div>
            <div className="right">
              <div className="ri">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 20h4L18 10l-4-4L4 16v4zM14 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <b>Correct it</b>
                <span>Fix anything that&rsquo;s wrong, any time.</span>
              </div>
            </div>
            <div className="right">
              <div className="ri">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <b>Delete it</b>
                <span>Close your account and we erase our copy.</span>
              </div>
            </div>
          </div>
          <div className="closing">
            <p>
              This page is the plain-language version, and it&rsquo;s the one we
              live by. A complete legal privacy policy with the formal detail is
              available too, and questions are always welcome.
            </p>
            <p className="legal">
              Full policy —{" "}
              <a href="https://steppe.community/legal/privacy" target="_blank" rel="noopener noreferrer">
                steppe.community/legal/privacy
              </a>
              <br />
              Questions — <a href="mailto:hello@steppe.community">hello@steppe.community</a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
