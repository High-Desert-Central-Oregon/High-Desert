import { Fragment, type ReactNode } from "react";

/**
 * Render a document body (stored as plain text in `documents.body`) as real
 * semantic HTML — headings, lists, paragraphs — without ever using
 * `dangerouslySetInnerHTML`. Everything becomes a text node or a known element,
 * so there is no HTML-injection surface even though the source is trusted.
 *
 * A deliberately tiny markdown subset is supported, enough for plain-language
 * legal text:
 *   `# `  → section heading (h2)
 *   `## ` → sub-heading (h3)
 *   `- `  → bullet list item (consecutive items group into a <ul>)
 *   blank → paragraph break
 *   `**bold**` inline emphasis
 */
export function DocumentBody({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={key} className="my-2 list-disc space-y-1 pl-6">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const key = `b-${index}`;

    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      return;
    }
    flushList(`list-${index}`);

    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={key} className="mt-5 text-base font-semibold text-foreground">
          {renderInline(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={key} className="mt-6 text-lg font-semibold text-foreground">
          {renderInline(line.slice(2))}
        </h2>,
      );
    } else if (line.trim() !== "") {
      blocks.push(
        <p key={key} className="my-2 leading-relaxed">
          {renderInline(line)}
        </p>,
      );
    }
  });

  flushList("list-end");

  return <div className="text-sm text-muted-foreground">{blocks}</div>;
}

/** Parse a minimal `**bold**` inline syntax into text nodes and <strong>. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
