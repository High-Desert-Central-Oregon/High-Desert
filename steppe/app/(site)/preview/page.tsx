// Preview (/preview) — rebuilt from the canonical design
// (_design-source/steppe-preview-v3.html) on the shared chrome + tokens. The
// interactive app facsimile is a state-driven client island (PreviewStage); the
// hero + compact strata are static. The phone screen stays light in both themes.
// Copy is localized from the "preview" catalog.
import { getTranslations } from "next-intl/server";
import "./preview.css";
import { PreviewStage } from "./preview-stage";
import { StrataHorizon } from "../_components/strata-horizon";

export const metadata = {
  title: "Steppe — a first look",
  description:
    "A first look at Steppe: one calm exchange, the groups you choose, a vote that's yours, and a profile that stays private until you say otherwise.",
};

export default async function PreviewPage() {
  const t = await getTranslations("preview");
  return (
    <div className="preview">
      <header className="hero">
        <div className="hero-in">
          <span className="badge">
            <span className="dot"></span>{t("heroBadge")}
          </span>
          <h1>{t.rich("heroTitle", { em: (c) => <em>{c}</em> })}</h1>
          <p>{t("heroLead")}</p>
          <div className="note">{t("heroNote")}</div>
        </div>
      </header>

      <div className="wrap">
        <PreviewStage />
      </div>

      <StrataHorizon variant="compact" />
    </div>
  );
}
