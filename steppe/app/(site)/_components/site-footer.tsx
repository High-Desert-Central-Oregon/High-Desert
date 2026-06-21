import Link from "next/link";
import { SealMark } from "./seal-mark";

/**
 * Shared marketing footer (v5 design). Seal + wordmark, the nonprofit/contact
 * meta block, the Explore links, and the founder credit linking out to
 * gregtchism.com.
 */
export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer-in">
        <div>
          <Link className="brand" href="/">
            <SealMark size={28} clipId="seal-foot" />
            Steppe
          </Link>
          <p className="footer-meta" style={{ marginTop: 16 }}>
            An Oregon public benefit nonprofit
            <br />
            Redmond, Oregon · EST. 2026
            <br />
            <a href="mailto:hello@steppe.community">hello@steppe.community</a>
          </p>
        </div>
        <div className="footer-links">
          <span className="head">Explore</span>
          <Link href="/preview">Preview</Link>
          <Link href="/partners">For partners</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
        <div className="footer-meta" style={{ alignSelf: "flex-end" }}>
          Led by{" "}
          <a
            href="https://gregtchism.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Greg Chism
          </a>
        </div>
      </div>
    </footer>
  );
}
