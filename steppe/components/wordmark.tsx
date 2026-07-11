import { cn } from "@/lib/utils";

/**
 * The Steppe brand mark, in two forms:
 *
 *  - <Wordmark> — just the name in the display serif (Besley). Compact, for the
 *    app navbar and inline use.
 *  - <Lockup> — the wordmark over the descriptor tagline ("a high desert civic
 *    commons"). Note the descriptor's "high desert" is the lowercase GEOGRAPHIC
 *    phrase (Central Oregon's high desert), not the brand — it's the tagline. For
 *    the landing, auth, and welcome surfaces.
 *
 * Name and descriptor are passed in from the dictionary, so the brand text lives
 * in one place (en.ts/es.ts) and the component stays decoupled from i18n.
 */
export function Wordmark({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span className={cn("font-serif font-semibold tracking-tight", className)}>
      {name}
    </span>
  );
}

export function Lockup({
  name,
  descriptor,
  lang,
  className,
}: {
  name: string;
  descriptor: string;
  lang?: string;
  className?: string;
}) {
  return (
    <span lang={lang} className={cn("flex flex-col leading-tight", className)}>
      <span className="font-serif text-lg font-semibold tracking-tight">
        {name}
      </span>
      <span className="font-sans text-xs text-muted-foreground">
        {descriptor}
      </span>
    </span>
  );
}
