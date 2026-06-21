// Preview (/preview) — rebuilt from the canonical design
// (_design-source/steppe-preview-v3.html) on the shared chrome + tokens. The
// interactive app facsimile is a state-driven client island (PreviewStage); the
// hero + compact strata are static. The phone screen stays light in both themes.
import "./preview.css";
import { PreviewStage } from "./preview-stage";
import { StrataHorizon } from "../_components/strata-horizon";

export const metadata = {
  title: "Steppe — a first look",
  description:
    "A first look at Steppe: one calm exchange, the groups you choose, a vote that's yours, and a profile that stays private until you say otherwise.",
};

export default function PreviewPage() {
  return (
    <div className="preview">
      <header className="hero">
        <div className="hero-in">
          <span className="badge">
            <span className="dot"></span>A preview — not the finished product
          </span>
          <h1>
            A first look at <em>Steppe.</em>
          </h1>
          <p>
            This is where we begin: one calm exchange, the groups you choose, a
            vote that&rsquo;s yours, and a profile that stays private until you say
            otherwise.
          </p>
          <div className="note">
            Everything here is the shape of the first version. Members decide what
            it becomes from here — by vote.
          </div>
        </div>
      </header>

      <div className="wrap">
        <PreviewStage />
      </div>

      <StrataHorizon variant="compact" />
    </div>
  );
}
