import type { Project, Ticket, Unit, Zone } from "@/types/domain";

/** Obtiene el siguiente correlativo legible para un ticket. */
export function nextFolio(existingTickets: Ticket[], units: Unit[], project: Project, zone: Zone): string {
  const projectUnitIds = new Set(units.filter((unit) => unit.projectId === project.id).map((unit) => unit.id));
  const maximum = existingTickets.reduce((currentMaximum, ticket) => {
    if (!projectUnitIds.has(ticket.unitId)) return currentMaximum;
    const match = new RegExp(`^${project.code}-(\\d{4})-${zone.code}$`).exec(ticket.folio);
    const number = match === null ? 0 : Number.parseInt(match[1], 10);

    return Number.isFinite(number) ? Math.max(currentMaximum, number) : currentMaximum;
  }, 0);

  return `${project.code}-${String(maximum + 1).padStart(4, "0")}-${zone.code}`;
}
