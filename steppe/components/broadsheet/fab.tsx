import Link from "next/link";

/**
 * Floating action chip — the bundle's compose FAB (inner.html :600-603):
 * juniper-deep fill (--primary), paper text, mono UPPERCASE label with the ＋
 * glyph, letterpress inset, square. Fixed bottom-right; on mobile it clears
 * the tab bar (the bundle's --fab-clear), on md+ it sits at the corner.
 */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="fixed right-5 z-30 flex items-center gap-2 bg-primary py-[13px] pl-[15px] pr-[18px] font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-letterpress transition-colors [bottom:calc(env(safe-area-inset-bottom,0px)+88px)] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:bottom-6"
    >
      <span aria-hidden="true" className="font-sans text-[17px] leading-none">
        ＋
      </span>
      {label}
    </Link>
  );
}
