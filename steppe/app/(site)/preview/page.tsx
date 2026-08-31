// Preview (/preview) — rebuilt from the canonical design
// (_design-source/steppe-preview-v3.html) on the shared chrome + tokens. The live
// interactive app is Steppe's full intended-state facsimile, embedded as an
// iframe by the PreviewEmbed client island (see components/preview-embed.tsx).
// It uses sample content so every planned beta feature remains reviewable without
// authentication. The product story introduces the three core actions before
// handing the visitor the interactive preview.
// The phone screen stays light in both themes. Copy is localized from the existing
// "preview" catalog.
import { getTranslations } from "next-intl/server";
import "./preview.css";
import { PreviewEmbed } from "@/components/preview-embed";
import { Hero } from "../_components/hero";

export const metadata = {
  title: "Steppe · a first look",
  description:
    "Try every planned Steppe beta screen in an interactive walkthrough, including the Exchange, groups, governance, messaging, and profile privacy controls.",
};

export default async function PreviewPage() {
  const t = await getTranslations("preview");
  return (
    <div className="preview">
      <Hero
        size="band"
        eyebrow={t("heroBadge")}
        title={t.rich("heroTitle", { em: (c) => <em>{c}</em> })}
        subtitle={t("heroLead")}
      >
        <div className="note">{t("heroNote")}</div>
      </Hero>

      <div className="wrap">
        <div className="preview-story-layout">
          <section
            className="preview-story"
            aria-label={t("heroBadge")}
          >
            <ol>
              <li className="preview-story-step preview-story-exchange">
                <article>
                  <div className="preview-story-kicker">
                    <span aria-hidden="true">01</span>
                    {t("capExchangeK")}
                  </div>
                  <h2>{t("capExchangeH")}</h2>
                  <p>{t("capExchangeP")}</p>
                </article>
              </li>
              <li className="preview-story-step preview-story-groups">
                <article>
                  <div className="preview-story-kicker">
                    <span aria-hidden="true">02</span>
                    {t("capGroupsK")}
                  </div>
                  <h2>{t("capGroupsH")}</h2>
                  <p>{t("capGroupsP")}</p>
                </article>
              </li>
              <li className="preview-story-step preview-story-govern">
                <article>
                  <div className="preview-story-kicker">
                    <span aria-hidden="true">03</span>
                    {t("capGovernK")}
                  </div>
                  <h2>{t("capGovernH")}</h2>
                  <p>{t("capGovernP")}</p>
                </article>
              </li>
            </ol>
          </section>

          <aside className="preview-demo" aria-label={t("embedTitle")}>
            <div className="preview-demo-head">
              <span className="kick blaze">{t("badge")}</span>
              <p>{t("embedTitle")}</p>
            </div>
            <p className="preview-demo-context">{t("embedNote")}</p>
            <PreviewEmbed />
            <div className="preview-trust">
              <span>{t("capYouK")}</span>
              <h2>{t("capYouH")}</h2>
              <p>{t("capYouP")}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
