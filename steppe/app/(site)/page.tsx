// Home (/) — the Charter design system. A full-bleed generative-landscape hero
// (golden) under a Charter scrim with light overlay copy, then static mission
// content (added below in Part 4). No app data or fabricated metrics — there is no
// app yet. Copy is localized from the "landing" namespace; the wordmark stays "Steppe".
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import "./charter.css";
import { GenerativeLandscape } from "./_components/generative-landscape";
import { Section } from "./_components/section";

export const metadata = {
  title: "Steppe — a town that owns its own commons",
  description:
    "Redmond's member-owned civic platform. No ads, no owner, never for sale — and governed by the people who use it.",
};

// The six commitments — data-driven so adding/editing one is a single array entry.
// Title + gloss are i18n keys (the "landing" namespace, en + es).
const COMMITMENTS = [
  { n: "01", title: "c1t", gloss: "c1d" },
  { n: "02", title: "c2t", gloss: "c2d" },
  { n: "03", title: "c3t", gloss: "c3d" },
  { n: "04", title: "c4t", gloss: "c4d" },
  { n: "05", title: "c5t", gloss: "c5d" },
  { n: "06", title: "c6t", gloss: "c6d" },
] as const;

export default async function HomePage() {
  const t = await getTranslations("landing");
  return (
    <>
      <header className="charter-hero">
        {/* Generative landscape (golden), pinned regardless of time of day. Renders a
            static fallback for SSR / first paint / no-WebGL / reduced motion. */}
        <GenerativeLandscape time="golden" className="gl-golden" />
        <div className="charter-hero-scrim" aria-hidden="true" />
        <div className="charter-hero-overlay hero-overlay">
          <div className="wrap">
            <div className="charter-wm">Steppe</div>
            <h1>{t("chTitle")}</h1>
            <p>{t("chLead")}</p>
            <div className="charter-cta">
              <Link className="btn btn-primary" href="/join">
                {t("chCtaMember")}
              </Link>
              <a className="btn btn-ghost" href="#commitments">
                {t("chCtaCharter")}
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* What Steppe stands for — the six commitments (no app data, no metrics). */}
      <Section lead eyebrow={t("standEyebrow")} id="commitments" aria-labelledby="commitments-h">
        <h2 id="commitments-h" className="stand-lead">
          {t("standLead")}
        </h2>
        <div className="creed">
          {COMMITMENTS.map((c) => (
            <div className="c" key={c.n}>
              <div className="cn">{c.n}</div>
              <div className="ct">{t(c.title)}</div>
              <div className="cd">{t(c.gloss)}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Built so it can't be taken from you — the structural guarantee (commitments,
          not figures). Full-bleed Cascade band. */}
      <section className="guarantee" aria-labelledby="guarantee-h">
        <div className="wrap">
          <h2 id="guarantee-h">{t("guaranteeTitle")}</h2>
          <p>{t.rich("guaranteeBody", { b: (c) => <b>{c}</b> })}</p>
        </div>
      </section>

      {/* Closing membership CTA — honest prelaunch framing (an interest list). */}
      <Section className="home-cta" aria-labelledby="home-cta-h">
        <h2 id="home-cta-h">{t("homeCtaTitle")}</h2>
        <p>{t("homeCtaBody")}</p>
        <Link className="btn btn-primary" href="/join">
          {t("homeCtaBtn")}
        </Link>
      </Section>
    </>
  );
}
