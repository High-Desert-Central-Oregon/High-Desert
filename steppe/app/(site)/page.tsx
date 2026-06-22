// Home (/) — the "Broadsheet × Plate" landing, from
// _design-source/steppe-align-broadsheet-mix.html. A masthead-led broadsheet: the
// hero standfirst + the generative landscape band (the living masthead), then the
// Charter, How it works, the local Exchange, and the sign-panel CTA (Parts 4–5).
// Marketing presentation only; copy is localized from the "landing" namespace.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import "./broadsheet.css";
import { GenerativeScene } from "./_components/generative-scene";

export const metadata = {
  title: "Steppe — a place that belongs to the people in it",
  description:
    "Steppe is civic infrastructure for Central Oregon, owned by the members who use it. Member dues pay for it, so it works for members instead of advertisers.",
};

export default async function HomePage() {
  const t = await getTranslations("landing");
  return (
    <div className="broadsheet">
      <section className="hero" aria-labelledby="hero-h">
        <div className="wrap">
          <p className="kick blaze">{t("bsKicker")}</p>
          <h1 id="hero-h">{t.rich("heroTitle", { em: (c) => <em>{c}</em> })}</h1>
          <div className="lede">
            <p className="stand drop-cap">
              {t("bsStand")}
              <span className="actions">
                <Link className="btn-rust" href="/join">
                  {t("bsCtaMember")}
                </Link>
                <Link className="btn-link" href="/preview">
                  {t("heroPreview")}
                </Link>
              </span>
            </p>
            <div className="aside">
              <p className="kick blaze">{t("bsBriefLabel")}</p>
              {t("bsBrief")}
            </div>
          </div>
        </div>
        {/* The living masthead: the existing generative landscape (interactive — tap
            for a new plate; static frame under reduced motion / no-WebGL). Its own
            weather readout is off here; the credit is the only overlay. */}
        <div className="herostrata">
          <GenerativeScene readout={false} />
          <span className="credit">
            {t("bsCredit1")}
            <br />
            {t("bsCredit2")}
          </span>
        </div>
      </section>

      {/* The Charter — ruled articles, no cards (replaces the old promise grid). */}
      <section className="band" id="charter" aria-labelledby="charter-h">
        <div className="wrap">
          <div className="sec-kicker">
            <h2 id="charter-h">{t("bsCharterH")}</h2>
            <span className="line"></span>
          </div>
          <div className="articles">
            {(["1", "2", "3", "4"] as const).map((n) => (
              <article className="art" key={n}>
                <p className="kick blaze">{t(`bsArt${n}K`)}</p>
                <h3>{t(`bsArt${n}H`)}</h3>
                <p>{t(`bsArt${n}B`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — the joining steps, re-treated as a broadsheet ruled list. */}
      <section className="band" aria-labelledby="how-h">
        <div className="wrap">
          <div className="sec-kicker">
            <h2 id="how-h">{t("bsHowH")}</h2>
            <span className="line"></span>
          </div>
          <div className="steps">
            {([1, 2, 3, 4] as const).map((n) => (
              <div className="step" key={n}>
                <div className="no">{`0${n}`}</div>
                <div>
                  <h3>
                    {t.rich(`step${n}H`, {
                      stamp: (c) => <span className="stamp">{c}</span>,
                    })}
                  </h3>
                  <p>{t(`step${n}B`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* One local exchange — classifieds. Illustrative sample postings for the
          marketing page (not live data); bylines use the corrected mono. */}
      <section className="band classifieds" id="exchange" aria-labelledby="exch-h">
        <div className="wrap">
          <div className="sec-kicker">
            <h2 id="exch-h">{t("bsExchH")}</h2>
            <span className="line"></span>
          </div>
          <p className="kick cl-sub">{t("bsExchSub")}</p>
          <div className="cl-list">
            <div className="cl">
              <span className="cat">
                <i style={{ background: "var(--sage-deep)" }}></i>
                {t("bsCatOffer")}
              </span>
              <span className="item">Free tomato starts, 40+ plants</span>
              <span className="loc">M.R. · SW Redmond · 2h</span>
            </div>
            <div className="cl">
              <span className="cat">
                <i style={{ background: "var(--rust)" }}></i>
                {t("bsCatNeed")}
              </span>
              <span className="item">Electrician who knows older homes</span>
              <span className="loc">J.T. · Dry Canyon · 5h</span>
            </div>
            <div className="cl">
              <span className="cat">
                <i style={{ background: "var(--ochre)" }}></i>
                {t("bsCatGather")}
              </span>
              <span className="item">Member meeting, July</span>
              <span className="loc">Community hall · Jul 18</span>
            </div>
            <div className="cl">
              <span className="cat">
                <i style={{ background: "var(--range)" }}></i>
                {t("bsCatAid")}
              </span>
              <span className="item">Rides to medical appointments</span>
              <span className="loc">all neighborhoods · ongoing</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — the juniper sign panel (enamel keyline). */}
      <section className="band cta" aria-labelledby="cta-h">
        <div className="wrap">
          <div className="signpanel">
            <p className="kick blaze">{t("bsCtaKick")}</p>
            <h2 id="cta-h">{t("bsCtaH")}</h2>
            <p>{t("bsCtaP")}</p>
            <Link className="btn-rust" href="/join">
              {t("bsCtaMember")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
