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
    </div>
  );
}
