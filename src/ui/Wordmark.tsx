/**
 * Die Wortmarke.
 *
 * Festlegung des Auftraggebers: nur der Schriftzug, kein Zeichen. Ein echtes
 * Logo folgt später – es wird ausschließlich hier eingesetzt, damit der
 * Austausch an einer einzigen Stelle geschieht.
 */

export function Wordmark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`font-bold ${className}`}
      style={{
        fontFamily: "var(--font-display)",
        fontSize: size === "sm" ? "0.9375rem" : "1.0625rem",
        letterSpacing: "-0.028em",
        color: "var(--ink)",
      }}
    >
      Dock
    </span>
  );
}
