// Landing (/) — React from the canonical design (steppe-landing-v5.html) on the
// shared chrome + tokens. Marketing copy is localized from the active catalog
// (messages/*.json, "landing" namespace). The phone-mock in the hero is a
// decorative facsimile and intentionally stays English.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import "./landing.css";
import { Hero } from "./_components/hero";
import { SealMark } from "./_components/seal-mark";
import { Reveal } from "./_components/reveal";

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

export default async function LandingPage() {
  const t = await getTranslations("landing");
  // Hero scenery is server-selected (default the approved classic scene); a non-prod
  // ?scene=generative|classic dev hook can override it client-side (HeroBandScene).
  const bandScene = process.env.HERO_SCENE === "generative" ? "generative" : "classic";
  return (
    <>
      <Reveal />

      <Hero
        size="tall"
        bandScene={bandScene}
        pip={false}
        eyebrow={
          <>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1C5 1 3 3.2 3 6c0 3.6 5 9 5 9s5-5.4 5-9c0-2.8-2-5-5-5z" stroke="#A8542C" strokeWidth="1.3" />
              <circle cx="8" cy="6" r="1.7" fill="#A8542C" />
            </svg>{" "}
            {t("heroLocation")}
          </>
        }
        title={t.rich("heroTitle", {
          em: (chunks) => <span className="em">{chunks}</span>,
        })}
        subtitle={t("heroLead")}
        cta={
          <>
            <Link className="btn btn-primary" href="/join">
              {t("heroJoin")} <ArrowRight />
            </Link>
            <Link className="btn btn-ghost" href="/preview">
              {t("heroPreview")}
            </Link>
          </>
        }
        aside={
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
        }
      >
        <div className="trustline">
          <span>{t("trust1")}</span>
          <span>{t("trust2")}</span>
          <span>{t("trust3")}</span>
        </div>
      </Hero>

      <section className="section band-alt">
        <div className="wrap">
          <div className="section-head rv">
            <span className="eyebrow">
              <span className="pip"></span>{t("promiseEyebrow")}
            </span>
            <h2>{t("promiseTitle")}</h2>
            <p className="dek">{t("promiseDek")}</p>
          </div>
          <div className="charter">
            <div className="clause rv">
              <div className="ltr">a.</div>
              <div>
                <h3>{t("clauseAH")}</h3>
                <p>{t("clauseAB")}</p>
              </div>
              <span className="mark">{t("clauseMark")}</span>
            </div>
            <div className="clause rv">
              <div className="ltr">b.</div>
              <div>
                <h3>{t("clauseBH")}</h3>
                <p>{t("clauseBB")}</p>
              </div>
              <span className="mark">{t("clauseMark")}</span>
            </div>
            <div className="clause rv">
              <div className="ltr">c.</div>
              <div>
                <h3>{t("clauseCH")}</h3>
                <p>{t("clauseCB")}</p>
              </div>
              <span className="mark">{t("clauseMark")}</span>
            </div>
            <div className="clause rv">
              <div className="ltr">d.</div>
              <div>
                <h3>{t("clauseDH")}</h3>
                <p>{t("clauseDB")}</p>
              </div>
              <span className="mark">{t("clauseMark")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-paper">
        <div className="wrap">
          <div className="section-head rv">
            <span className="eyebrow">
              <span className="pip"></span>{t("joinEyebrow")}
            </span>
            <h2>{t("joinTitle")}</h2>
            <p className="dek">{t("joinDek")}</p>
          </div>
          <div className="stations">
            <div className="station rv">
              <div className="no">01</div>
              <div>
                <h3>{t("step1H")}</h3>
                <p>{t("step1B")}</p>
              </div>
            </div>
            <div className="station rv">
              <div className="no">02</div>
              <div>
                <h3>
                  {t.rich("step2H", {
                    stamp: (chunks) => <span className="stamp">{chunks}</span>,
                  })}
                </h3>
                <p>{t("step2B")}</p>
              </div>
            </div>
            <div className="station rv">
              <div className="no">03</div>
              <div>
                <h3>{t("step3H")}</h3>
                <p>{t("step3B")}</p>
              </div>
            </div>
            <div className="station rv">
              <div className="no">04</div>
              <div>
                <h3>{t("step4H")}</h3>
                <p>{t("step4B")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-feature on-dark">
        <div className="wrap">
          <div className="section-head rv">
            <span className="eyebrow on-dark">
              <span className="pip"></span>{t("exchEyebrow")}
            </span>
            <h2>{t("exchTitle")}</h2>
            <p className="dek">{t("exchDek")}</p>
          </div>
          <div className="register">
            <div className="lx-row cat-offer rv">
              <div className="lx-main">
                <div className="lx-cat">
                  <span className="dot"></span>{t("rowOfferCat")}
                </div>
                <div className="lx-ttl">{t("rowOfferTtl")}</div>
                <div className="lx-desc">{t("rowOfferDesc")}</div>
              </div>
              <div className="lx-who">
                <div className="av2">MK</div>
                <div className="lx-meta">Martha K.<span>{t("rowOfferMeta")}</span></div>
              </div>
            </div>
            <div className="lx-row cat-need rv">
              <div className="lx-main">
                <div className="lx-cat">
                  <span className="dot"></span>{t("rowNeedCat")}
                </div>
                <div className="lx-ttl">{t("rowNeedTtl")}</div>
                <div className="lx-desc">{t("rowNeedDesc")}</div>
              </div>
              <div className="lx-who">
                <div className="av2">JR</div>
                <div className="lx-meta">James R.<span>{t("rowNeedMeta")}</span></div>
              </div>
            </div>
            <div className="lx-row cat-gather rv">
              <div className="lx-main">
                <div className="lx-cat">
                  <span className="dot"></span>{t("rowGatherCat")}
                </div>
                <div className="lx-ttl">{t("rowGatherTtl")}</div>
                <div className="lx-desc">{t("rowGatherDesc")}</div>
              </div>
              <div className="lx-who">
                <div className="av2">St</div>
                <div className="lx-meta">Steppe<span>{t("rowGatherMeta")}</span></div>
              </div>
            </div>
            <div className="lx-row cat-aid rv">
              <div className="lx-main">
                <div className="lx-cat">
                  <span className="dot"></span>{t("rowAidCat")}
                </div>
                <div className="lx-ttl">{t("rowAidTtl")}</div>
                <div className="lx-desc">{t("rowAidDesc")}</div>
              </div>
              <div className="lx-who">
                <div className="av2">DL</div>
                <div className="lx-meta">Dana L.<span>{t("rowAidMeta")}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-base">
        <div className="wrap gov">
          <div className="copy rv">
            <span className="eyebrow">
              <span className="pip"></span>{t("govEyebrow")}
            </span>
            <h2>{t("govTitle")}</h2>
            <p>{t("govBody")}</p>
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
            <span className="pip"></span>{t("bedrockEyebrow")}
          </span>
          <h2>{t("bedrockTitle")}</h2>
          <p>{t("bedrockBody")}</p>
          <Link className="btn btn-primary" href="/join">
            {t("bedrockCta")} <ArrowRight />
          </Link>
        </div>
      </section>
    </>
  );
}
