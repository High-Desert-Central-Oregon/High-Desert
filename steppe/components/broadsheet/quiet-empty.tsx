/**
 * The bundle's quiet empty state (inner.html :584-597): a miniature strata
 * horizon — rust sun at the bundle's 322/402 station over sage and basalt
 * ridgelines — with a Besley 20px title and a 13.5px ink-soft sub. Extracted
 * from the Exchange board so every honestly-empty surface (the board,
 * My Calendar) draws the same horizon once.
 */
export function QuietEmpty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-6 pb-10 pt-[14px] text-center">
      <div
        aria-hidden="true"
        className="relative mt-[18px] h-16 w-full overflow-hidden"
      >
        <svg
          viewBox="0 0 64 64"
          className="absolute top-0 h-full w-auto -translate-x-1/2"
          style={{ aspectRatio: "1", left: "calc(100% * 322 / 402)" }}
        >
          <circle cx="32" cy="22" r="14" fill="#A8542C" />
        </svg>
        <svg
          viewBox="0 0 402 64"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path
            d="M0,40 C80,32 150,36 220,33 C300,29 360,35 402,32 L402,64 L0,64 Z"
            fill="#6E8A5B"
          />
          <path
            d="M0,52 C90,46 150,49 230,48 C320,45 372,49 402,48 L402,64 L0,64 Z"
            fill="#34383D"
          />
        </svg>
      </div>
      <p className="mt-4 font-serif text-[20px] font-semibold text-foreground">
        {title}
      </p>
      <p className="mt-[6px] text-[13.5px] leading-[1.5] text-muted-foreground">
        {sub}
      </p>
    </div>
  );
}
