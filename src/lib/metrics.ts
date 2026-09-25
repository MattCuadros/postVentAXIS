import { isClosed } from "@/lib/ticket-status";
import type { Project, Ticket, TicketCategory, TicketStatusHistory, Unit, Zone } from "@/types/domain";

export type Period = "MES" | "TRIMESTRE" | "TODO";

export const PERIOD_LABEL: Record<Period, string> = {
  MES: "Este mes",
  TRIMESTRE: "Últimos 3 meses",
  TODO: "Todo el período",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Inicio del período (hora local); null = sin límite. */
export function periodStart(period: Period, now: Date = new Date()): Date | null {
  if (period === "MES") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "TRIMESTRE") return new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return null;
}

export interface CountRow {
  id: string;
  label: string;
  count: number;
}

export interface Indicators {
  /** Ingresados dentro del período. */
  created: number;
  /** Abiertos hoy (no depende del período). */
  open: number;
  /** Esperando conformidad hoy. */
  awaitingOwner: number;
  specialCases: number;
  /** Promedio de días entre ingreso y cierre conforme, para los cerrados en el período. null si no hay. */
  avgDaysToClose: number | null;
  byZone: CountRow[];
  byCategory: CountRow[];
}

interface Sources {
  tickets: Ticket[];
  history: TicketStatusHistory[];
  units: Unit[];
  projects: Project[];
  zones: Zone[];
  categories: TicketCategory[];
}

export function computeIndicators(period: Period, sources: Sources, now: Date = new Date()): Indicators {
  const { tickets, history, units, projects, zones, categories } = sources;
  const start = periodStart(period, now);
  const inPeriod = (iso: string) => start === null || new Date(iso) >= start;

  const created = tickets.filter((ticket) => inPeriod(ticket.createdAt));

  const closeDays = tickets.flatMap((ticket) => {
    if (ticket.status !== "CERRADO") return [];
    const closedAt = history.findLast((entry) => entry.ticketId === ticket.id && entry.to === "CERRADO")?.createdAt ?? ticket.updatedAt;
    if (!inPeriod(closedAt)) return [];
    return [(new Date(closedAt).getTime() - new Date(ticket.createdAt).getTime()) / DAY_MS];
  });

  const zoneOfTicket = (ticket: Ticket) => {
    const unit = units.find((item) => item.id === ticket.unitId);
    return projects.find((item) => item.id === unit?.projectId)?.zoneId;
  };

  const byZone = zones.map((zone) => ({
    id: zone.id,
    label: zone.name,
    count: created.filter((ticket) => zoneOfTicket(ticket) === zone.id).length,
  }));

  const byCategory = categories
    .map((category) => ({
      id: category.id,
      label: category.name,
      count: created.filter((ticket) => ticket.categoryId === category.id).length,
    }))
    .filter((row) => row.count > 0)
    .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));

  return {
    created: created.length,
    open: tickets.filter((ticket) => !isClosed(ticket.status)).length,
    awaitingOwner: tickets.filter((ticket) => ticket.status === "EN_RECEPCION").length,
    specialCases: tickets.filter((ticket) => ticket.specialCase !== null).length,
    avgDaysToClose: closeDays.length === 0 ? null : closeDays.reduce((sum, days) => sum + days, 0) / closeDays.length,
    byZone,
    byCategory,
  };
}
