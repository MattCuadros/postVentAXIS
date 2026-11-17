import { cn } from "@/lib/cn";

/** Distintivo de los datos de ejemplo (no suman en las estadísticas). */
export function ExampleBadge({ className }: { className?: string }) {
  return (
    <span
      title="Dato de ejemplo: no suma en las estadísticas"
      className={cn("inline-flex shrink-0 items-center rounded-sm border border-line px-1.5 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-ink-secondary", className)}
    >
      Ejemplo
    </span>
  );
}

/** Casilla para sumar (o no) los datos de ejemplo a un tablero de estadísticas. */
export function ExampleToggle({ checked, onChange, className }: { checked: boolean; onChange: (value: boolean) => void; className?: string }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-ink-secondary", className)}>
      <input type="checkbox" className="h-4 w-4 accent-[#003399]" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      Incluir datos de ejemplo
    </label>
  );
}
