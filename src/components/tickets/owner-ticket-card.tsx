import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatShortDate } from "@/lib/format";
import { OWNER_STATUS_LABEL } from "@/lib/ticket-status";
import type { Ticket } from "@/types/domain";

/** Tarjeta de un requerimiento en el listado del propietario. */
export function OwnerTicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <Link
      href={`/propietario/tickets/${ticket.id}`}
      className="block rounded-lg border border-line-soft bg-surface p-4 shadow-card transition duration-150 ease-axis-out hover:border-accent/40 hover:shadow-raised active:scale-[0.99]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-accent">{ticket.folio}</span>
        <span className="text-xs text-ink-meta">{formatShortDate(ticket.createdAt)}</span>
      </div>
      <p className="mt-1 line-clamp-2 font-bold text-ink">{ticket.description}</p>
      <StatusBadge status={ticket.status} label={OWNER_STATUS_LABEL[ticket.status]} className="mt-3" />
    </Link>
  );
}
