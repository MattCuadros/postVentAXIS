/**
 * Indicadores del administrador de obra: patrones de fallas de sus obras (incluidas las ya
 * entregadas) para prevenir en la obra siguiente. Solo agregados: sin datos personales.
 */
import { periodStart, type CountRow, type Period } from "@/lib/metrics";
import { isClosed } from "@/lib/ticket-status";
import type { Ticket, TicketCategory, TicketStatusHistory, Unit, WorkCrew, WorkCrewType } from "@/types/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CrewPerformance {
  id: string;
  name: string;
  type: WorkCrewType;
  handled: number;
  closed: number;
  /** Días promedio entre ingreso y cierre conforme. */
  avgDaysToClose: number | null;
  /** Veces que el propietario no quedó conforme (volvió a programarse). */
  ownerRejections: number;
}

export interface ProjectInsights {
  total: number;
  open: number;
  closed: number;
  notApplicable: number;
  avgDaysToClose: number | null;
  ownerRejections: number;
  byCategory: CountRow[];
  byTower: CountRow[];
  /** "Torre A · piso 7" / "Casas" con su cantidad, de mayor a menor. */
  byFloor: CountRow[];
  crews: CrewPerformance[];
  byCrewType: Record<WorkCrewType, Omit<CrewPerformance, "id" | "name" | "type">>;
}

interface Sources {
  tickets: Ticket[];
  units: Unit[];
  categories: TicketCategory[];
  crews: WorkCrew[];
  history: TicketStatusHistory[];
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countBy(labels: string[]): CountRow[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ id: label, label, count }))
    .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es", { numeric: true }));
}

/** Tickets de las obras indicadas (por sus unidades) y dentro del período. */
export function ticketsOfProjects(tickets: Ticket[], units: Unit[], projectIds: string[], period: Period): Ticket[] {
  const unitIds = new Set(units.filter((unit) => projectIds.includes(unit.projectId)).map((unit) => unit.id));
  const start = periodStart(period);
  return tickets.filter((ticket) => unitIds.has(ticket.unitId) && (start === null || new Date(ticket.createdAt) >= start));
}

export function computeProjectInsights({ tickets, units, categories, crews, history }: Sources): ProjectInsights {
  const closedAt = (ticket: Ticket) =>
    history.findLast((entry) => entry.ticketId === ticket.id && entry.to === "CERRADO")?.createdAt ?? ticket.updatedAt;
  const daysToClose = (ticket: Ticket) => (new Date(closedAt(ticket)).getTime() - new Date(ticket.createdAt).getTime()) / DAY_MS;
  const rejections = (ticket: Ticket) =>
    history.filter((entry) => entry.ticketId === ticket.id && entry.from === "EN_RECEPCION" && entry.to === "PROGRAMADO").length;
  const closed = tickets.filter((ticket) => ticket.status === "CERRADO");

  const locationOf = (ticket: Ticket) => units.find((unit) => unit.id === ticket.unitId);
  const towerLabel = (unit: Unit | undefined) => (!unit ? "Sin unidad" : unit.type === "CASA" ? "Casas" : `Torre ${unit.tower ?? "—"}`);
  const floorLabel = (unit: Unit | undefined) => {
    if (!unit || unit.type === "CASA") return towerLabel(unit);
    return `${towerLabel(unit)} · piso ${unit.floor ?? "—"}`;
  };

  const crewRows: CrewPerformance[] = crews
    .map((crew) => {
      const handled = tickets.filter((ticket) => ticket.crewId === crew.id);
      const done = handled.filter((ticket) => ticket.status === "CERRADO");
      return {
        id: crew.id,
        name: crew.name,
        type: crew.type,
        handled: handled.length,
        closed: done.length,
        avgDaysToClose: average(done.map(daysToClose)),
        ownerRejections: handled.reduce((sum, ticket) => sum + rejections(ticket), 0),
      };
    })
    .filter((row) => row.handled > 0)
    .toSorted((a, b) => b.handled - a.handled);

  const byCrewType = (["INTERNO", "SUBCONTRATO"] as WorkCrewType[]).reduce(
    (result, type) => {
      const handled = tickets.filter((ticket) => crews.find((crew) => crew.id === ticket.crewId)?.type === type);
      const done = handled.filter((ticket) => ticket.status === "CERRADO");
      result[type] = {
        handled: handled.length,
        closed: done.length,
        avgDaysToClose: average(done.map(daysToClose)),
        ownerRejections: handled.reduce((sum, ticket) => sum + rejections(ticket), 0),
      };
      return result;
    },
    {} as ProjectInsights["byCrewType"],
  );

  return {
    total: tickets.length,
    open: tickets.filter((ticket) => !isClosed(ticket.status)).length,
    closed: closed.length,
    notApplicable: tickets.filter((ticket) => ticket.status === "NO_PROCEDE").length,
    avgDaysToClose: average(closed.map(daysToClose)),
    ownerRejections: tickets.reduce((sum, ticket) => sum + rejections(ticket), 0),
    byCategory: countBy(tickets.map((ticket) => categories.find((item) => item.id === ticket.categoryId)?.name ?? "Sin categoría")),
    byTower: countBy(tickets.map((ticket) => towerLabel(locationOf(ticket)))),
    byFloor: countBy(tickets.map((ticket) => floorLabel(locationOf(ticket)))),
    crews: crewRows,
    byCrewType,
  };
}
