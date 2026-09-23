import type { CountRow } from "@/lib/metrics";

/**
 * Barras horizontales por categoría (una serie, un tono), con el valor al final.
 * La pista usa el azul suave: se lee como la misma escala.
 */
export function CategoryBars({ data }: { data: CountRow[] }) {
  const max = Math.max(1, ...data.map((row) => row.count));

  return (
    <ul className="flex flex-col gap-4">
      {data.map((row) => (
        <li key={row.id} title={`${row.label}: ${row.count}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink">{row.label}</span>
            <span className="font-bold tabular-nums text-ink">{row.count}</span>
          </div>
          <div aria-hidden className="mt-1.5 h-2 w-full rounded-pill bg-accent-soft">
            <div className="h-full rounded-pill bg-accent" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
