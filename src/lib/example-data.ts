import { projects, tickets, users } from "@/mocks/data";
import type { Ticket, Unit } from "@/types/domain";

/**
 * Datos de ejemplo: todo lo que viene de la semilla (`src/mocks/data.ts`). Se muestran con el
 * distintivo "Ejemplo" y no suman en indicadores ni estadísticas, que cuentan solo casos reales.
 */
const EXAMPLE_PROJECT_IDS = new Set(projects.map((project) => project.id));
const EXAMPLE_USER_IDS = new Set(users.map((user) => user.id));
const EXAMPLE_TICKET_IDS = new Set(tickets.map((ticket) => ticket.id));

export function isExampleProject(projectId: string): boolean {
  return EXAMPLE_PROJECT_IDS.has(projectId);
}

export function isExampleUser(userId: string): boolean {
  return EXAMPLE_USER_IDS.has(userId);
}

/** Un requerimiento es de ejemplo si viene de la semilla o pertenece a una obra de ejemplo. */
export function isExampleTicket(ticket: Ticket, units: Unit[]): boolean {
  if (EXAMPLE_TICKET_IDS.has(ticket.id)) return true;
  const unit = units.find((item) => item.id === ticket.unitId);
  return unit !== undefined && EXAMPLE_PROJECT_IDS.has(unit.projectId);
}

/** Requerimientos que cuentan en las estadísticas: los reales, salvo que se pida incluir los de ejemplo. */
export function ticketsForStats(all: Ticket[], units: Unit[], includeExamples: boolean): Ticket[] {
  return includeExamples ? all : all.filter((ticket) => !isExampleTicket(ticket, units));
}
