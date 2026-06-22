// Preview (/preview) — rebuilt from the canonical design
// (_design-source/steppe-preview-v3.html) on the shared chrome + tokens. The
// interactive app facsimile is a state-driven client island (PreviewStage); the
// hero + compact strata are static. The phone screen stays light in both themes.
// Copy is localized from the "preview" catalog.
import { getTranslations } from "next-intl/server";
import "./preview.css";
import { PreviewStage } from "./preview-stage";
import { Hero } from "../_components/hero";

export const metadata = {
  title: "Steppe · a first look",
  description:
    "A first look at Steppe: one calm exchange, the groups you choose, a vote that's yours, and a profile that stays private until you say otherwise.",
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
        <PreviewStage />
      </div>
    </div>
  );
}
