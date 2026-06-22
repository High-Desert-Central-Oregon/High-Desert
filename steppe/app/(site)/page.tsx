// Home (/) — the Charter design system. A full-bleed generative-landscape hero
// (golden) under a Charter scrim with light overlay copy, then static mission
// content (added below in Part 4). No app data or fabricated metrics — there is no
// app yet. Copy is localized from the "landing" namespace; the wordmark stays "Steppe".
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import "./charter.css";
import { GenerativeLandscape } from "./_components/generative-landscape";

export const metadata = {
  title: "Steppe — a town that owns its own commons",
  description:
    "Redmond's member-owned civic platform. No ads, no owner, never for sale — and governed by the people who use it.",
};

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
    </>
  );
}
