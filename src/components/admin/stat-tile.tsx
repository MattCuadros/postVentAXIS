import { cn } from "@/lib/cn";

interface StatTileProps {
  label: string;
  value: string;
  /** "action": el indicador pide atención (marca naranja de acento, como en el manual). */
  tone?: "default" | "action";
}

/** Cifra destacada del tablero: marca superior, valor grande y etiqueta. */
export function StatTile({ label, value, tone = "default" }: StatTileProps) {
  return (
    <div className="rounded-lg border border-line-soft bg-surface p-6 shadow-card">
      <span aria-hidden className={cn("block h-1 w-12 rounded-pill", tone === "action" ? "bg-brand-orange" : "bg-accent")} />
      <p className="mt-4 text-3xl font-bold tracking-[-0.02em] text-accent">{value}</p>
      <p className="mt-1 text-sm text-ink-secondary">{label}</p>
    </div>
  );
}
