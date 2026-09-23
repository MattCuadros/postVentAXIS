import type { TicketStatus, TicketStatusHistory } from "@/types/domain";
import { MAIN_FLOW, STATUS_LABEL, STATUS_TONE } from "@/lib/ticket-status";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/cn";

interface StatusTimelineProps {
  status: TicketStatus;
  history: TicketStatusHistory[];
  /** Textos alternativos por estado, ej. "Esperando tu conformidad" para el propietario. */
  labels?: Partial<Record<TicketStatus, string>>;
}

/** Línea de tiempo del ticket: muestra el camino completo y marca dónde va. */
export function StatusTimeline({ status, history, labels }: StatusTimelineProps) {
  if (status === "NO_PROCEDE") {
    const last = history.at(-1);
    return (
      <div className="rounded-lg bg-danger/5 p-5">
        <p className="font-semibold text-danger">No procede</p>
        {last?.comment && <p className="mt-1 text-sm text-ink-secondary">{last.comment}</p>}
      </div>
    );
  }

  const currentIndex = MAIN_FLOW.indexOf(status);
  const reachedAt = (s: TicketStatus) => history.findLast((h) => h.to === s)?.createdAt;

  return (
    <ol className="flex flex-col">
      {MAIN_FLOW.map((step, i) => {
        const done = i < currentIndex || status === "CERRADO";
        const current = i === currentIndex && status !== "CERRADO";
        const attention = current && STATUS_TONE[step] === "attention";
        const date = done || current ? reachedAt(step) : undefined;
        const isLast = i === MAIN_FLOW.length - 1;

        return (
          <li key={step} className="relative flex gap-4 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={cn("absolute left-[5px] top-4 h-full w-0.5", done ? "bg-accent" : "bg-line-soft")}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative mt-1 h-3 w-3 shrink-0 rounded-full",
                done && "bg-accent",
                current && (attention ? "bg-brand-orange ring-4 ring-brand-orange/20" : "bg-accent ring-4 ring-accent/20"),
                !done && !current && "border-2 border-line bg-surface",
              )}
            />
            <div className="flex flex-col">
              <span className={cn("text-sm", done || current ? "text-ink" : "text-ink-meta", current && "font-bold")}>
                {labels?.[step] ?? STATUS_LABEL[step]}
                {current && <span className="sr-only"> (estado actual)</span>}
              </span>
              <span className="text-xs text-ink-meta">
                {date ? (current ? `Desde el ${formatLongDate(date)}` : formatLongDate(date)) : done ? "" : "Pendiente"}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
