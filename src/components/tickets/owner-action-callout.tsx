import Link from "next/link";
import type { Ticket } from "@/types/domain";

/**
 * Aviso destacado cuando el propietario debe actuar (dar conformidad).
 * El naranjo se usa solo como fondo suave y borde: es el "requiere tu acción" del manual.
 */
export function OwnerActionCallout({ ticket }: { ticket: Ticket }) {
  return (
    <Link
      href={`/propietario/tickets/${ticket.id}`}
      className="block rounded-lg border-l-4 border-brand-orange bg-brand-orange-soft p-4 transition-colors hover:bg-brand-orange-soft/70"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-brand-orange-ink">Te toca a ti</p>
      <p className="mt-1 font-bold text-ink">
        {ticket.folio} · {ticket.room}
      </p>
      <p className="mt-1 text-sm text-ink-secondary">El trabajo terminó. Confirma si quedó conforme.</p>
    </Link>
  );
}
