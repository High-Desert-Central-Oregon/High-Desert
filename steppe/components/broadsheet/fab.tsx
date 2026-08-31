import Link from "next/link";

/**
 * Floating action chip — the bundle's compose FAB (inner.html :600-603):
 * juniper-deep fill (--primary), paper text, mono UPPERCASE label with the ＋
 * glyph, letterpress inset, square. On mobile it floats above the tab bar;
 * from md upward it returns to document flow so the action stays attached to
 * the reading column instead of drifting to the browser corner.
 */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="fixed right-[max(1.25rem,env(safe-area-inset-right,0px))] z-30 flex min-h-11 items-center gap-2 bg-primary py-3 pl-[15px] pr-[18px] font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-letterpress transition-colors [bottom:calc(env(safe-area-inset-bottom,0px)+88px)] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:static md:z-auto md:-mt-3 md:self-end"
    >
      <span aria-hidden="true" className="font-sans text-[17px] leading-none">
        ＋
      </span>
      {label}
    </Link>
  );
}
