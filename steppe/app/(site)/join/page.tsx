// Join (/join) — from the canonical design (steppe-join.html) on the shared chrome
// + tokens. Membership hero + the real interest-signup form (JoinForm → /api/interest),
// the "what membership is" terms, and the joining stations. Copy is localized from
// the active catalog ("join" namespace). The LAUNCH_PHASE gate and signup flow are
// unchanged.
import { getTranslations } from "next-intl/server";
import "./join.css";
import { JoinForm } from "./join-form";
import { Hero } from "../_components/hero";

export const metadata = {
  title: "Steppe — become a member",
  description:
    "Membership makes you an owner and a voter in a place that belongs to its members — not advertisers or investors. $4/month, flat. Leave your email and we'll tell you when membership opens in Redmond.",
};

export default async function JoinPage() {
  const t = await getTranslations("join");
  return (
    <div className="join">
      <Hero
        size="band"
        eyebrow={t("heroEyebrow")}
        title={t.rich("heroTitle", { em: (c) => <em>{c}</em> })}
        subtitle={t("heroLead")}
        aside={<JoinForm />}
      >
        <div className="price">
          <b>$4</b>
          <span>{t("priceUnit")}</span>
        </div>
        <div className="price-note">{t("priceNote")}</div>
      </Hero>

      <section className="section band-paper">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>{t("membEyebrow")}
            </span>
            <h2>{t("membTitle")}</h2>
          </div>
          <div className="terms">
            <div className="tlist">
              <div className="trow">
                <div className="tn">{t("term1Tag")}</div>
                <div>
                  <h3>{t("term1H")}</h3>
                  <p>{t("term1B")}</p>
                </div>
              </div>
              <div className="trow">
                <div className="tn">{t("term2Tag")}</div>
                <div>
                  <h3>{t("term2H")}</h3>
                  <p>{t("term2B")}</p>
                </div>
              </div>
              <div className="trow">
                <div className="tn">{t("term3Tag")}</div>
                <div>
                  <h3>{t("term3H")}</h3>
                  <p>{t("term3B")}</p>
                </div>
              </div>
            </div>
            <div className="incl">
              <div className="ik">{t("inclTitle")}</div>
              <ul>
                <li>
                  <span className="c">✓</span>
                  <span>
                    <b>{t("incl1b")}</b> <span>{t("incl1s")}</span>
                  </span>
                </li>
                <li>
                  <span className="c">✓</span>
                  <span>
                    <b>{t("incl2b")}</b> <span>{t("incl2s")}</span>
                  </span>
                </li>
                <li>
                  <span className="c">✓</span>
                  <span>
                    <b>{t("incl3b")}</b> <span>{t("incl3s")}</span>
                  </span>
                </li>
                <li>
                  <span className="c">✓</span>
                  <span>
                    <b>{t("incl4b")}</b> <span>{t("incl4s")}</span>
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
              <span className="pip"></span>{t("howEyebrow")}
            </span>
            <h2>{t("howTitle")}</h2>
            <p>{t("howDek")}</p>
          </div>
          <div className="stations">
            <div className="stn">
              <div className="no">01</div>
              <div>
                <h3>{t("step1H")}</h3>
                <p>{t("step1B")}</p>
              </div>
            </div>
            <div className="stn">
              <div className="no">02</div>
              <div>
                <h3>{t.rich("step2H", { stamp: (c) => <span className="stamp">{c}</span> })}</h3>
                <p>{t("step2B")}</p>
              </div>
            </div>
            <div className="stn">
              <div className="no">03</div>
              <div>
                <h3>{t("step3H")}</h3>
                <p>{t("step3B")}</p>
              </div>
            </div>
            <div className="stn">
              <div className="no">04</div>
              <div>
                <h3>{t("step4H")}</h3>
                <p>{t("step4B")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
