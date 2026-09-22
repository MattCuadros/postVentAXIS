import type { TicketStatus, TicketStatusHistory } from "@/types/domain";
import { MAIN_FLOW, STATUS_LABEL } from "@/lib/ticket-status";
import { cn } from "@/lib/cn";

interface StatusTimelineProps {
  status: TicketStatus;
  history: TicketStatusHistory[];
}

const dateFmt = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });

/** Línea de tiempo del ticket: muestra el camino completo y marca dónde va. */
export function StatusTimeline({ status, history }: StatusTimelineProps) {
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
    <ol className="relative flex flex-col gap-5">
      {MAIN_FLOW.map((step, i) => {
        const done = i < currentIndex || status === "CERRADO";
        const current = i === currentIndex && status !== "CERRADO";
        const date = reachedAt(step);
        return (
          <li key={step} className="flex items-start gap-4">
            <span
              aria-hidden
              className={cn(
                "mt-1 h-3 w-3 shrink-0 rounded-full",
                done && "bg-accent",
                current && "bg-accent ring-4 ring-accent/20",
                !done && !current && "border border-line bg-surface",
              )}
            />
            <div className="flex flex-1 items-baseline justify-between gap-3">
              <span className={cn("text-sm", done || current ? "text-ink" : "text-ink-meta", current && "font-semibold")}>
                {STATUS_LABEL[step]}
              </span>
              {date && <span className="text-xs text-ink-meta">{dateFmt.format(new Date(date))}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
