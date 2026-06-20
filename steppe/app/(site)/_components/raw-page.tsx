"use client";

import { useEffect } from "react";

/**
 * Renders an approved marketing page from its ORIGINAL, verbatim HTML markup and
 * runs its ORIGINAL vanilla <script> as-is — no rewrite into React. The markup is
 * injected (so every class, data-attr, inline handler, and SVG is preserved
 * exactly); the script is appended as a real <script> element so it executes in
 * global scope, exactly as in the standalone design file (the landing toggle and
 * the preview's inline onclick handlers both rely on that). Server-rendered for
 * the static HTML; the script only adds interactivity on the client.
 */
export function RawPage({ html, script }: { html: string; script?: string }) {
  useEffect(() => {
    if (!script) return;
    const el = document.createElement("script");
    el.textContent = script;
    document.body.appendChild(el);
    return () => {
      el.remove();
    };
  }, [script]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
