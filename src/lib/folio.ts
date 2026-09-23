import type { Ticket } from "@/types/domain";

/** Obtiene el siguiente correlativo legible para un ticket. */
export function nextFolio(existingTickets: Ticket[]): string {
  const maximum = existingTickets.reduce((currentMaximum, ticket) => {
    const match = /^PV-(\d+)$/.exec(ticket.folio);
    const number = match === null ? 0 : Number.parseInt(match[1], 10);

    return Number.isFinite(number) ? Math.max(currentMaximum, number) : currentMaximum;
  }, 0);

  return `PV-${String(maximum + 1).padStart(6, "0")}`;
}
