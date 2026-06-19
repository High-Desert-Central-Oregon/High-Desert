// Trivial placeholder for the public marketing landing — confirms the (site)
// route group resolves at "/" and that the layout's brand fonts + tokens load.
// The faithful landing/partners/preview ports land in a later run.
export const metadata = {
  title: "Steppe — a high desert civic commons",
};

export default function LandingPlaceholder() {
  return (
    <main
      style={{
        padding: "clamp(48px, 10vw, 120px) clamp(20px, 5vw, 64px)",
        maxWidth: "760px",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-fraunces)",
          fontWeight: 500,
          fontSize: "clamp(2.2rem, 6vw, 3.6rem)",
          letterSpacing: "-0.012em",
          color: "var(--basalt)",
        }}
      >
        Steppe
      </h1>
      <p
        style={{
          fontFamily: "var(--font-public-sans)",
          color: "var(--basalt-soft)",
          marginTop: "16px",
          maxWidth: "34em",
          fontSize: "1.05rem",
        }}
      >
        Public marketing site — scaffold placeholder. The landing, partners, and
        preview pages are ported in a later run.
      </p>
    </main>
  );
}
