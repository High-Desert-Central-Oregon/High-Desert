import type { ReactNode } from "react";

/**
 * Charter layout primitives. Container is the centered max-width wrap; Section is a
 * vertical band with the hairline top rule and an optional Space Mono eyebrow.
 * Variants: `lead` (first section — no top rule), `feature` (full-bleed Cascade band).
 * These map to the existing .wrap / .section classes, now Charter-themed via tokens.
 */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`wrap ${className}`.trim()}>{children}</div>;
}

type SectionProps = {
  children: ReactNode;
  eyebrow?: ReactNode;
  lead?: boolean;
  feature?: boolean;
  id?: string;
  className?: string;
  "aria-labelledby"?: string;
};

export function Section({
  children,
  eyebrow,
  lead = false,
  feature = false,
  id,
  className = "",
  "aria-labelledby": labelledBy,
}: SectionProps) {
  const cls = ["section", lead && "lead", feature && "band-feature on-dark", className]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={cls} id={id} aria-labelledby={labelledBy}>
      <Container>
        {eyebrow != null && <div className="ml sectag">{eyebrow}</div>}
        {children}
      </Container>
    </section>
  );
}
