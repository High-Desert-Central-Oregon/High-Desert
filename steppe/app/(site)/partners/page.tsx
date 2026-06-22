// Partners (/partners) — React from the canonical design (steppe-partners-v2.html)
// on the shared chrome + tokens. Marketing copy is localized from the active
// catalog (messages/*.json, "partners" namespace). Conservative claims carried
// as-is (Aspiration is the only named fiscal sponsor); thresholds/percentages are
// literals.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import "./partners.css";
import { Hero } from "../_components/hero";

export const metadata = {
  title: "Steppe — for partners",
  description:
    "Community-owned civic infrastructure for Redmond, Central Oregon — the model, the structural guarantees that protect it, how it's funded, and how to help build it.",
};

export default async function PartnersPage() {
  const t = await getTranslations("partners");
  const b = { b: (chunks: React.ReactNode) => <b>{chunks}</b> };
  return (
    <div className="partners">
      <Hero
        size="band"
        eyebrow={t("heroEyebrow")}
        title={t.rich("heroTitle", {
          em: (chunks) => <em>{chunks}</em>,
        })}
        subtitle={t("heroLead")}
      >
        <div className="factline">
          <span>{t("fact1")}</span>
          <span>{t("fact2")}</span>
          <span>{t("fact3")}</span>
        </div>
      </Hero>

      {/* THEORY OF CHANGE */}
      <section className="section band-paper">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="pip"></span>{t("theoryEyebrow")}
            </span>
            <h2>{t("theoryTitle")}</h2>
            <p>{t("theoryLead")}</p>
          </div>
          <div className="stations">
            <div className="stn">
              <div className="no">01</div>
              <div>
                <h3>{t("s1H")}</h3>
                <p>{t("s1B")}</p>
              </div>
            </div>
            <div className="stn">
              <div className="no">02</div>
              <div>
                <h3>{t("s2H")}</h3>
                <p>{t("s2B")}</p>
              </div>
            </div>
            <div className="stn">
              <div className="no">03</div>
              <div>
                <h3>{t("s3H")}</h3>
                <p>{t("s3B")}</p>
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
              <span className="pip"></span>{t("guarEyebrow")}
            </span>
            <h2>{t("guarTitle")}</h2>
          </div>
          <div className="panels">
            <div className="panel">
              <div className="pk">{t("p1k")}</div>
              <h3>{t("p1h")}</h3>
              <ul>
                <li><span className="ck">✓</span><span>{t.rich("p1a", b)}</span></li>
                <li><span className="ck">✓</span><span>{t.rich("p1b", b)}</span></li>
                <li><span className="ck">✓</span><span>{t.rich("p1c", b)}</span></li>
              </ul>
            </div>
            <div className="panel">
              <div className="pk">{t("p2k")}</div>
              <h3>{t("p2h")}</h3>
              <ul>
                <li><span className="ck">✓</span><span>{t("p2a")}</span></li>
                <li><span className="ck">✓</span><span>{t("p2b")}</span></li>
                <li><span className="ck">✓</span><span>{t("p2c")}</span></li>
                <li><span className="ck">✓</span><span>{t("p2d")}</span></li>
                <li><span className="ck">✓</span><span>{t("p2e")}</span></li>
              </ul>
            </div>
            <div className="panel">
              <div className="pk">{t("p3k")}</div>
              <h3>{t("p3h")}</h3>
              <ul>
                <li><span className="t">15%</span><span>{t("p3a")}</span></li>
                <li><span className="t">60%</span><span>{t("p3b")}</span></li>
                <li><span className="t">75%</span><span>{t("p3c")}</span></li>
                <li><span className="t">60%</span><span>{t("p3d")}</span></li>
              </ul>
            </div>
            <div className="panel">
              <div className="pk">{t("p4k")}</div>
              <h3>{t("p4h")}</h3>
              <ul>
                <li><span className="ck">✓</span><span>{t.rich("p4a", b)}</span></li>
                <li><span className="ck">✓</span><span>{t.rich("p4b", b)}</span></li>
                <li><span className="ck">✓</span><span>{t("p4c")}</span></li>
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
              <span className="pip"></span>{t("fundEyebrow")}
            </span>
            <h2>{t("fundTitle")}</h2>
            <p>{t("fundLead")}</p>
          </div>
          <div className="fund">
            <div className="frow f-dues">
              <div className="fn">
                <b>{t("duesName")}</b>
                <span className="tag">{t("duesTag")}</span>
              </div>
              <div className="fd">{t("duesDesc")}</div>
              <div className="fw">{t("duesWhen")}</div>
            </div>
            <div className="frow f-grants">
              <div className="fn">
                <b>{t("grantsName")}</b>
                <span className="tag">{t("grantsTag")}</span>
              </div>
              <div className="fd">{t("grantsDesc")}</div>
              <div className="fw">{t("grantsWhen")}</div>
            </div>
            <div className="frow f-don">
              <div className="fn">
                <b>{t("donName")}</b>
                <span className="tag">{t("donTag")}</span>
              </div>
              <div className="fd">{t("donDesc")}</div>
              <div className="fw">{t("donWhen")}</div>
            </div>
            <div className="frow f-earned">
              <div className="fn">
                <b>{t("earnedName")}</b>
                <span className="tag">{t("earnedTag")}</span>
              </div>
              <div className="fd">{t("earnedDesc")}</div>
              <div className="fw">{t("earnedWhen")}</div>
            </div>
            <div className="frow f-gov">
              <div className="fn">
                <b>{t("govName")}</b>
                <span className="tag">{t("govTag")}</span>
              </div>
              <div className="fd">{t("govDesc")}</div>
              <div className="fw">{t("govWhen")}</div>
            </div>
          </div>
          <div className="guard">
            <span>{t("guardLeft")}</span>
            <span className="mixbar">
              <i style={{ width: "28%", background: "var(--dues)" }}></i>
              <i style={{ width: "26%", background: "var(--grants)" }}></i>
              <i style={{ width: "20%", background: "var(--donations)" }}></i>
              <i style={{ width: "16%", background: "var(--earned)" }}></i>
              <i style={{ width: "10%", background: "var(--gov)" }}></i>
            </span>
            <span>{t("guardRight")}</span>
          </div>
        </div>
      </section>

      {/* THE ASK */}
      <section className="section band-bedrock">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow on-dark">
              <span className="pip"></span>{t("askEyebrow")}
            </span>
            <h2>{t("askTitle")}</h2>
          </div>
          <div className="ask-grid">
            <div className="ask">
              <h3>{t("ask1H")}</h3>
              <p>{t("ask1B")}</p>
            </div>
            <div className="ask">
              <h3>{t("ask2H")}</h3>
              <p>{t("ask2B")}</p>
            </div>
            <div className="ask">
              <h3>{t("ask3H")}</h3>
              <p>{t("ask3B")}</p>
            </div>
            <div className="ask">
              <h3>{t("ask4H")}</h3>
              <p>{t("ask4B")}</p>
            </div>
          </div>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/contact">
              {t("getInTouch")}{" "}
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 8h9M8.5 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <span className="contact">hello@steppe.community</span>
          </div>
        </div>
      </section>
    </div>
  );
}
