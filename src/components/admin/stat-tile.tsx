import { cn } from "@/lib/cn";

interface StatTileProps {
  label: string;
  value: string;
  /** "action": el indicador pide atención (marca naranja de acento, como en el manual). */
  tone?: "default" | "action";
  onSelect?: () => void;
  selected?: boolean;
}

/** Cifra destacada del tablero: marca superior, valor grande y etiqueta. */
export function StatTile({ label, value, tone = "default", onSelect, selected = false }: StatTileProps) {
  const numericValue = Number(value.replaceAll(",", "."));
  const isZero = Number.isFinite(numericValue) && numericValue === 0;
  const content = <>
      <span aria-hidden className={cn("block h-1 w-12 rounded-pill", tone === "action" ? "bg-brand-orange" : "bg-accent")} />
      <p className="mt-4 text-3xl font-bold tracking-[-0.02em] text-accent">{value}</p>
      <p className="mt-1 text-sm text-ink-secondary">{label}</p>
    </>;
  const style = cn("rounded-lg border bg-surface p-6 shadow-card", onSelect ? "min-h-11 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" : "border-line-soft", selected && "border-2 border-accent bg-accent/5");
  return onSelect && !isZero ? (
    <button type="button" aria-pressed={selected} aria-label={`Ver los ${value} requerimientos: ${label}`} className={style} onClick={onSelect}>{content}</button>
  ) : <div className={style}>{content}</div>;
}
