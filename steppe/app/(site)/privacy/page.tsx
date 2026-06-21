// Privacy (/privacy) — plain-language document from the canonical design
// (steppe-privacy.html) on the shared chrome + tokens. Copy is localized from the
// active catalog ("privacy" namespace). The formal policy at /legal/privacy stays
// English-only and governs (see the legalGoverns note by the policy link).
import { getTranslations } from "next-intl/server";
import "./privacy.css";
import { StrataHorizon } from "../_components/strata-horizon";

export const metadata = {
  title: "Steppe — privacy",
  description:
    "Privacy at Steppe is the structure, not a setting: a member-owned nonprofit with no ads, no trackers, and no data to sell. What we collect, why, and your rights — in plain language.",
};

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <div className="privacy">
      <header className="hero">
        <div className="hero-in">
          <span className="eyebrow">
            <span className="pip"></span>{t("heroEyebrow")}
          </span>
          <h1>{t.rich("heroTitle", { em: (c) => <em>{c}</em> })}</h1>
          <p>{t("heroLead")}</p>
          <div className="updated">{t("updated")}</div>
        </div>
        <StrataHorizon variant="compact" />
      </header>

      <section className="section band-paper">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>{t("commitEyebrow")}
            </span>
            <h2>{t("commitTitle")}</h2>
          </div>
          <div className="charter">
            <div className="clause">
              <div className="ltr">a.</div>
              <div>
                <h3>{t("cAH")}</h3>
                <p>{t("cAB")}</p>
              </div>
            </div>
            <div className="clause">
              <div className="ltr">b.</div>
              <div>
                <h3>{t("cBH")}</h3>
                <p>{t("cBB")}</p>
              </div>
            </div>
            <div className="clause">
              <div className="ltr">c.</div>
              <div>
                <h3>{t("cCH")}</h3>
                <p>{t("cCB")}</p>
              </div>
            </div>
            <div className="clause">
              <div className="ltr">d.</div>
              <div>
                <h3>{t("cDH")}</h3>
                <p>{t("cDB")}</p>
              </div>
            </div>
            <div className="clause">
              <div className="ltr">e.</div>
              <div>
                <h3>{t("cEH")}</h3>
                <p>{t("cEB")}</p>
              </div>
            </div>
            <div className="clause">
              <div className="ltr">f.</div>
              <div>
                <h3>{t("cFH")}</h3>
                <p>{t("cFB")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>{t("recordEyebrow")}
            </span>
            <h2>{t("recordTitle")}</h2>
            <p>{t("recordDek")}</p>
          </div>
          <div className="collect">
            <div className="crow">
              <div className="cn">
                <b>{t("r1Name")}</b>
                <span className="tag">{t("r1Tag")}</span>
              </div>
              <div className="cw">{t("r1Cw")}</div>
              <div className="cr">
                <b>{t("r1CrB")}</b>{t("r1CrN")}
              </div>
            </div>
            <div className="crow">
              <div className="cn">
                <b>{t("r2Name")}</b>
                <span className="tag">{t("r2Tag")}</span>
              </div>
              <div className="cw">{t("r2Cw")}</div>
              <div className="cr">
                <b>{t("r2CrB")}</b>{t("r2CrN")}
              </div>
            </div>
            <div className="crow">
              <div className="cn">
                <b>{t("r3Name")}</b>
                <span className="tag">{t("r3Tag")}</span>
              </div>
              <div className="cw">{t("r3Cw")}</div>
              <div className="cr">
                <b>{t("r3CrB")}</b>{t("r3CrN")}
              </div>
            </div>
            <div className="crow">
              <div className="cn">
                <b>{t("r4Name")}</b>
                <span className="tag">{t("r4Tag")}</span>
              </div>
              <div className="cw">{t("r4Cw")}</div>
              <div className="cr">
                <b>{t("r4CrB")}</b>{t("r4CrN")}
              </div>
            </div>
            <div className="crow">
              <div className="cn">
                <b>{t("r5Name")}</b>
                <span className="tag">{t("r5Tag")}</span>
              </div>
              <div className="cw">{t("r5Cw")}</div>
              <div className="cr">
                <b>{t("r5CrB")}</b>{t("r5CrN")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-paper">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>{t("rightsEyebrow")}
            </span>
            <h2>{t("rightsTitle")}</h2>
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
                <b>{t("rSeeH")}</b>
                <span>{t("rSeeD")}</span>
              </div>
            </div>
            <div className="right">
              <div className="ri">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3v11m0-11l-4 4m4-4l4 4M5 15v4h14v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <b>{t("rExportH")}</b>
                <span>{t("rExportD")}</span>
              </div>
            </div>
            <div className="right">
              <div className="ri">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 20h4L18 10l-4-4L4 16v4zM14 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <b>{t("rCorrectH")}</b>
                <span>{t("rCorrectD")}</span>
              </div>
            </div>
            <div className="right">
              <div className="ri">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <b>{t("rDeleteH")}</b>
                <span>{t("rDeleteD")}</span>
              </div>
            </div>
          </div>
          <div className="closing">
            <p>{t("closeP")}</p>
            <p className="legal">
              {t("fullPolicy")}{" "}
              <a href="https://steppe.community/legal/privacy" target="_blank" rel="noopener noreferrer">
                steppe.community/legal/privacy
              </a>
              <br />
              {t("questions")} <a href="/contact">{t("contactUs")}</a>
              <br />
              {t("legalGoverns")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
