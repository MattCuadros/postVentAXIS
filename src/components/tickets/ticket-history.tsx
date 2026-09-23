import { formatDateTime } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/ticket-status";
import type { TicketStatusHistory, User } from "@/types/domain";

/**
 * Bitácora del ticket para el equipo Axis: cada cambio con quién, cuándo y su comentario.
 * Es el respaldo ("cada paso queda con tu nombre y la fecha").
 */
export function TicketHistory({ history, users }: { history: TicketStatusHistory[]; users: User[] }) {
  const entries = history.toReversed();

  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => {
        const author = users.find((user) => user.id === entry.changedById);
        const isLast = index === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-4 pb-5 last:pb-0">
            {!isLast && <span aria-hidden className="absolute left-[5px] top-4 h-full w-0.5 bg-line-soft" />}
            <span aria-hidden className={index === 0 ? "relative mt-1 h-3 w-3 shrink-0 rounded-full bg-accent" : "relative mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-accent bg-surface"} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">{STATUS_LABEL[entry.to]}</p>
              <p className="text-xs text-ink-meta">
                {formatDateTime(entry.createdAt)} · {author?.name ?? "Usuario desconocido"}
                {author?.role === "PROPIETARIO" && " (propietario)"}
              </p>
              {entry.comment && (
                <p className="mt-1.5 whitespace-pre-line rounded-md bg-surface-secondary px-3 py-2 text-sm text-ink-secondary">{entry.comment}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
