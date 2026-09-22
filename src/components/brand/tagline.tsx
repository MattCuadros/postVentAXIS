/** Bloque institucional "Construimos cambios" en texto real. */
export function Tagline({ className = "" }: { className?: string }) {
  return (
    <p className={`border-l-4 border-brand-orange pl-3 text-sm font-bold leading-snug text-accent ${className}`}>
      <span className="text-brand-orange">Construimos cambios</span>
      <br />
      que trascienden para el futuro sostenible de nuestra sociedad.
    </p>
  );
}
