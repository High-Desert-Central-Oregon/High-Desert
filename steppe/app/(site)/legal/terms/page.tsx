// /legal/terms — the formal Terms of Membership, rendered from a single markdown
// source of truth (content/legal/terms.md) with react-markdown + remark-gfm.
// Mirrors /legal/privacy exactly (same legal.css, same draft handling); the
// plain-language summaries across the site link here.
//
// Draft handling:
//  - Internal [CONFIRM …] reviewer blockquotes are stripped from the output
//    (kept in the .md). See stripConfirmBlockquotes.
//  - Remaining [BRACKET] placeholders are listed in the build log so they can't
//    ship unnoticed. See PLACEHOLDER_RE.
//  - The page is noindex until the terms are finalized (see metadata.robots).
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { Components } from "react-markdown";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "../privacy/legal.css";

export const metadata: Metadata = {
  title: "Terms of Membership · Steppe",
  description:
    "The formal Steppe Terms of Membership: the two-tier trust & safety model, reactive moderation, the marketplace, and data handling.",
  alternates: { canonical: "/legal/terms" },
  // TODO: remove noindex when terms are final (counsel sign-off + placeholders filled)
  robots: { index: false },
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return toText(
      (node as { props?: { children?: React.ReactNode } }).props?.children,
    );
  }
  return "";
}

// HTML comments are author notes (e.g. the draft banner); never render or scan them.
function stripHtmlComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * Drop reviewer blockquotes addressed to counsel: any contiguous blockquote whose
 * content includes [CONFIRM is removed from the rendered output (it stays in the
 * source .md). Handles multi-line blockquotes.
 */
function stripConfirmBlockquotes(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (/^\s*>/.test(lines[i])) {
      const start = i;
      while (i < lines.length && /^\s*>/.test(lines[i])) i++;
      const block = lines.slice(start, i);
      if (block.some((l) => l.includes("[CONFIRM"))) continue; // drop the block
      out.push(...block);
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join("\n");
}

// Bracketed ALL-CAPS-style placeholders that are NOT markdown link labels (a "["
// not immediately followed by "(" after the "]"), e.g. [EFFECTIVE DATE] but not
// [steppe.community/privacy](…).
const PLACEHOLDER_RE = /\[[A-Z][^\]]*\](?!\()/g;

export default function LegalTermsPage() {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "content/legal/terms.md"),
    "utf8",
  );
  const md = stripConfirmBlockquotes(stripHtmlComments(raw));

  // Build-time guard: surface any remaining bracketed placeholders so a draft
  // can't ship with them unfilled.
  const placeholders = Array.from(new Set(md.match(PLACEHOLDER_RE) ?? []));
  if (placeholders.length > 0) {
    console.warn(
      `\n[legal/terms] ${placeholders.length} unfilled placeholder(s) in content/legal/terms.md — fill before publishing:\n  ${placeholders.join("\n  ")}\n`,
    );
  }

  // Split the title + metadata front matter from the numbered sections so the
  // back-link and table of contents sit between them.
  const splitIdx = md.indexOf("\n## ");
  const front = splitIdx >= 0 ? md.slice(0, splitIdx) : md;
  const body = splitIdx >= 0 ? md.slice(splitIdx) : "";

  const toc = Array.from(body.matchAll(/^##\s+(.+)$/gm)).map((m) => {
    const text = m[1].trim();
    return { text, id: slugify(text) };
  });

  const components: Components = {
    h2: ({ children }) => <h2 id={slugify(toText(children))}>{children}</h2>,
  };

  return (
    <main className="legal">
      <article className="wrap legal-doc">
        <Link className="legal-back" href="/privacy">
          ← Back to the plain-language summary
        </Link>

        <ReactMarkdown remarkPlugins={[remarkGfm]}>{front}</ReactMarkdown>

        {toc.length > 0 && (
          <nav className="legal-toc" aria-label="Contents">
            <div className="toc-h">Contents</div>
            <ul>
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`}>{t.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {body}
        </ReactMarkdown>

        <p className="legal-foot">
          <Link href="/privacy">← Back to the plain-language summary</Link>
        </p>
      </article>
    </main>
  );
}
