import Link from "next/link";
import type { Ticket } from "@/types/domain";
import { AlertIcon } from "@/components/ui/icons";

/**
 * Aviso destacado cuando el propietario debe actuar (dar conformidad).
 * El naranjo se usa solo como fondo suave y borde: es el "requiere tu acción" del manual.
 */
export function OwnerActionCallout({ ticket }: { ticket: Ticket }) {
  return (
    <Link
      href={`/propietario/tickets/${ticket.id}`}
      className="block rounded-lg bg-brand-orange-soft p-4 shadow-card transition duration-150 ease-axis-out hover:shadow-raised active:scale-[0.99]"
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-orange-ink"><AlertIcon className="h-4 w-4" />Te toca a ti</p>
      <p className="mt-1 font-bold text-ink">
        {ticket.folio} · {ticket.room}
      </p>
      <p className="mt-1 text-sm text-ink-secondary">El trabajo terminó. Confirma si quedó conforme.</p>
    </Link>
  );
}
