// Shared marketing footer for the public (site) route group. Rendered once by
// the (site) layout below {children}. Plain anchors; styling in site-base.css,
// scoped under .site-root. The founder credit and contact link out (new tab,
// noopener); internal links use the same set the header offers plus Privacy.
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="sf-org">
          Steppe — an Oregon public benefit nonprofit · Redmond, Oregon
        </p>
        <nav className="sf-links" aria-label="Footer">
          <a className="sf-link" href="/preview">
            Preview
          </a>
          <a className="sf-link" href="/partners">
            For partners
          </a>
          <a className="sf-link" href="/privacy">
            Privacy
          </a>
          <a className="sf-link" href="mailto:hello@steppe.community">
            hello@steppe.community
          </a>
        </nav>
        <p className="sf-credit">
          Led by{" "}
          <a
            href="https://gregtchism.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Greg Chism
          </a>
        </p>
      </div>
    </footer>
  );
}
