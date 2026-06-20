// Shared marketing header for the public (site) route group. Rendered once by
// the (site) layout above {children}, so every public page gets the same brand +
// nav. Plain anchors (full navigation, no client JS); styling lives in
// site-base.css, scoped under .site-root. Keyboard-focusable via the shared
// .site-root :focus-visible ring.
export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="site-header-inner" aria-label="Site">
        <a className="sh-brand" href="/">
          Steppe
        </a>
        <div className="sh-links">
          <a className="sh-link" href="/preview">
            Preview
          </a>
          <a className="sh-link" href="/partners">
            For partners
          </a>
          <a className="sh-join" href="/join">
            Join
          </a>
        </div>
      </nav>
    </header>
  );
}
