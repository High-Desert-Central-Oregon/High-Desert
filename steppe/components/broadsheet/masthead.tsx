/**
 * Broadsheet masthead — the preview bundle's screen-title anatomy
 * (inner.html :459-461; parity audit T7): a Besley display title, a mono
 * UPPERCASE kicker/dateline, and the system's ONLY italic — the Besley voice
 * line. Order is fixed: title → kicker → voice.
 */
export function Masthead({
  title,
  kicker,
  voice,
  lang,
}: {
  title: string;
  kicker?: string;
  voice?: string;
  lang?: string;
}) {
  return (
    <header lang={lang} className="flex flex-col">
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
