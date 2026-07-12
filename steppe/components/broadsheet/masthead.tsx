import { cn } from "@/lib/utils";

/**
 * Broadsheet masthead — the preview bundle's screen-title anatomy
 * (inner.html :459-461; parity audit T7): a Besley display title, a mono
 * UPPERCASE kicker/dateline, and the system's ONLY italic — the Besley voice
 * line. Order is fixed: title → kicker → voice.
 *
 * The masthead sits on the bundle's tinted BONE ground (navStyle :1865:
 * background var(--bone), hairline bottom rule) — a band distinct from the
 * paper sheet, bleeding to the column edges. `flush` pulls the band up to
 * meet the shell header so the two read as one bone zone. Every tab root
 * opens with a flush masthead — including Govern, whose segments-on-top
 * bundle exception was overridden by the founder (2026-07-12; see the tokens
 * reference notes + parity audit).
 */
export function Masthead({
  title,
  kicker,
  voice,
  lang,
  flush,
}: {
  title: string;
  kicker?: string;
  voice?: string;
  lang?: string;
  /** Bleed up to the shell header (bone-on-bone, one continuous zone). */
  flush?: boolean;
}) {
  return (
    <header
      lang={lang}
      className={cn(
        "-mx-[var(--pad-screen)] flex flex-col border-b bg-muted px-[var(--pad-screen)] pb-5 pt-4",
        flush && "-mt-[var(--pad-screen)]",
      )}
    >
      <h1 className="font-serif text-[clamp(32px,6vw,40px)] font-semibold leading-none tracking-[-0.01em] text-foreground">
        {title}
      </h1>
      {kicker && (
        <p className="mt-[9px] font-mono text-[10px] font-semibold uppercase leading-[1.45] tracking-[0.12em] text-muted-foreground">
          {kicker}
        </p>
      )}
      {voice && (
        <p className="mt-[6px] max-w-[346px] font-serif text-[12.5px] italic leading-[1.34] text-muted-foreground [text-wrap:pretty]">
          {voice}
        </p>
      )}
    </header>
  );
}
