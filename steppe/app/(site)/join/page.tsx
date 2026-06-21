// Join (/join) — rebuilt from the canonical design (_design-source/steppe-join
// .html) on the shared chrome + tokens. Membership hero + the real interest-signup
// form (JoinForm, POSTs to /api/interest), the "what membership is" terms, and the
// joining stations. Static content + a client form island; the LAUNCH_PHASE gate
// and signup flow are unchanged.
import "./join.css";
import { JoinForm } from "./join-form";
import { StrataHorizon } from "../_components/strata-horizon";

export const metadata = {
  title: "Steppe — become a member",
  description:
    "Membership makes you an owner and a voter in a place that belongs to its members — not advertisers or investors. $4/month, flat. Leave your email and we'll tell you when membership opens in Redmond.",
};

export default function JoinPage() {
  return (
    <div className="join">
      <header className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">
              <span className="pip"></span>Membership
            </span>
            <h1>
              Become a member of <em>Steppe.</em>
            </h1>
            <p className="lead">
              Membership makes you an owner and a voter in a place that belongs to
              its members — not to advertisers or investors.
            </p>
            <div className="price">
              <b>$4</b>
              <span>/ month, flat</span>
            </div>
            <div className="price-note">
              No tiers. Hardship waiver if you need it. Cancel any time.
            </div>
          </div>
          <JoinForm />
        </div>
        <StrataHorizon variant="compact" />
      </header>

      <section className="section band-alt">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>What membership is
            </span>
            <h2>One price, no catch.</h2>
          </div>
          <div className="terms">
            <div className="tlist">
              <div className="trow">
                <div className="tn">$4 / mo</div>
                <div>
                  <h3>Flat dues</h3>
                  <p>
                    Billed yearly or by bank transfer. No tiers, no upsells — the
                    same membership for everyone.
                  </p>
                </div>
              </div>
              <div className="trow">
                <div className="tn">Waiver</div>
                <div>
                  <h3>Hardship waiver</h3>
                  <p>
                    Can&rsquo;t swing it right now? Membership is free, no questions
                    asked. Money never decides who belongs.
                  </p>
                </div>
              </div>
              <div className="trow">
                <div className="tn">Optional</div>
                <div>
                  <h3>Give more, if you can</h3>
                  <p>
                    An optional contribution above dues helps cover waivers and the
                    Community Fund. Always voluntary.
                  </p>
                </div>
              </div>
            </div>
            <div className="incl">
              <div className="ik">What it includes</div>
              <ul>
                <li>
                  <span className="c">✓</span>
                  <span>
                    <b>The local exchange</b>{" "}
                    <span>— needs, offers, gatherings, mutual aid</span>
                  </span>
                </li>
                <li>
                  <span className="c">✓</span>
                  <span>
                    <b>Neighborhood groups</b>{" "}
                    <span>— join the ones you choose</span>
                  </span>
                </li>
                <li>
                  <span className="c">✓</span>
                  <span>
                    <b>A secret ballot</b>{" "}
                    <span>— vote on the rules, budget, and direction</span>
                  </span>
                </li>
                <li>
                  <span className="c">✓</span>
                  <span>
                    <b>Your data, yours</b>{" "}
                    <span>— private by default, exportable any time</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>How it works
            </span>
            <h2>From neighbor to member.</h2>
            <p>
              Four steps, start to finish. No anonymous accounts, no bots — just
              the people who live around you.
            </p>
          </div>
          <div className="stations">
            <div className="stn">
              <div className="no">01</div>
              <div>
                <h3>Verify you&rsquo;re local</h3>
                <p>
                  Confirm you live in the Redmond area. We check, then forget the
                  documents — real neighbors, no data hoard.
                </p>
              </div>
            </div>
            <div className="stn">
              <div className="no">02</div>
              <div>
                <h3>
                  Join for <span className="stamp">$4 / month</span>
                </h3>
                <p>
                  That&rsquo;s the whole membership. Pay yearly or by bank transfer,
                  or take the hardship waiver — yours, no questions asked.
                </p>
              </div>
            </div>
            <div className="stn">
              <div className="no">03</div>
              <div>
                <h3>Settle in</h3>
                <p>
                  Post to the exchange, join groups, find help and offer it, and
                  talk with the people who live around you.
                </p>
              </div>
            </div>
            <div className="stn">
              <div className="no">04</div>
              <div>
                <h3>Help steer it</h3>
                <p>
                  Vote on the rules, the budget, and where Steppe goes next. Your
                  ballot is secret, and it counts the same as everyone&rsquo;s.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
