/**
 * Estadísticas del encargado zonal: requerimientos de sus zonas en una ventana móvil (última
 * semana, 2 semanas, mes, 3 meses o todo), con filtros. Funciones puras: la pantalla y el Excel
 * usan exactamente los mismos cálculos.
 */
import type { CountRow } from "@/lib/metrics";
import { isClosed, MAIN_FLOW, STATUS_LABEL } from "@/lib/ticket-status";
import type { Project, Ticket, TicketCategory, TicketStatus, TicketStatusHistory, Unit, WorkCrew } from "@/types/domain";

export type StatsPeriod = "SEMANA" | "DOS_SEMANAS" | "MES" | "TRIMESTRE" | "TODO";

export const STATS_PERIODS: StatsPeriod[] = ["SEMANA", "DOS_SEMANAS", "MES", "TRIMESTRE", "TODO"];

export const STATS_PERIOD_LABEL: Record<StatsPeriod, string> = {
  SEMANA: "Última semana",
  DOS_SEMANAS: "Últimas 2 semanas",
  MES: "Último mes",
  TRIMESTRE: "Últimos 3 meses",
  TODO: "Todo el período",
};

export type StatusGroup = "TODOS" | "ABIERTOS" | "CERRADOS" | "NO_PROCEDE" | "CASOS_ESPECIALES";

export const STATUS_GROUP_LABEL: Record<StatusGroup, string> = {
  TODOS: "Todos",
  ABIERTOS: "Abiertos",
  CERRADOS: "Cerrados conformes",
  NO_PROCEDE: "No procede",
  CASOS_ESPECIALES: "Casos especiales",
};

export interface StatsFilters {
  period: StatsPeriod;
  zoneId: string;
  projectId: string;
  categoryId: string;
  crewId: string;
  status: StatusGroup;
}

export const DEFAULT_FILTERS: StatsFilters = { period: "MES", zoneId: "", projectId: "", categoryId: "", crewId: "", status: "TODOS" };

export interface StatsSources {
  tickets: Ticket[];
  history: TicketStatusHistory[];
  units: Unit[];
  projects: Project[];
  categories: TicketCategory[];
  crews: WorkCrew[];
}

export interface TrendRow {
  id: string;
  label: string;
  ingresados: number;
  cerrados: number;
}

export interface StatsRow {
  ticket: Ticket;
  project: string;
  unit: Unit | undefined;
  category: string;
  reportedCategory: string;
  crew: string;
  closedAt: string | null;
  /** Días entre ingreso y cierre (o hasta hoy si sigue abierto). */
  days: number;
  daysToVisit: number | null;
  ownerRejections: number;
}

export interface ZoneStats {
  start: Date | null;
  end: Date;
  /** Requerimientos ingresados en el período que cumplen los filtros. */
  rows: StatsRow[];
  ingresados: number;
  abiertos: number;
  cerrados: number;
  noProcede: number;
  enRecepcion: number;
  casosEspeciales: number;
  reclasificados: number;
  ownerRejections: number;
  /** Abiertos que llevan más de STALE_DAYS días. */
  atrasados: number;
  /** Cierres conformes ocurridos dentro del período (aunque hayan ingresado antes). */
  cerradosEnPeriodo: number;
  avgDaysToClose: number | null;
  avgDaysToVisit: number | null;
  byStatus: CountRow[];
  byCategory: CountRow[];
  byProject: CountRow[];
  byCrew: CountRow[];
  trend: TrendRow[];
}

export const STALE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Inicio de la ventana móvil (a las 00:00, hora local), incluyendo el día de hoy; null = todo. */
export function statsPeriodStart(period: StatsPeriod, now: Date = new Date()): Date | null {
  const today = startOfDay(now);
  switch (period) {
    case "SEMANA":
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    case "DOS_SEMANAS":
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13);
    case "MES":
      return new Date(today.getFullYear(), today.getMonth() - 1, today.getDate() + 1);
    case "TRIMESTRE":
      return new Date(today.getFullYear(), today.getMonth() - 3, today.getDate() + 1);
    case "TODO":
      return null;
  }
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

function matchesStatus(ticket: Ticket, group: StatusGroup): boolean {
  switch (group) {
    case "TODOS":
      return true;
    case "ABIERTOS":
      return !isClosed(ticket.status);
    case "CERRADOS":
      return ticket.status === "CERRADO";
    case "NO_PROCEDE":
      return ticket.status === "NO_PROCEDE";
    case "CASOS_ESPECIALES":
      return ticket.specialCase !== null;
  }
}

const shortDay = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });
const monthYear = new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit" });
const clean = (text: string) => text.replace(".", "");

/** Tramos del gráfico: por día (1-2 semanas), por semana (1-3 meses) o por mes (todo). */
function buildBuckets(period: StatsPeriod, start: Date, end: Date): { id: string; label: string; from: Date; to: Date }[] {
  const buckets: { id: string; label: string; from: Date; to: Date }[] = [];
  if (period === "SEMANA" || period === "DOS_SEMANAS") {
    for (let day = new Date(start); day <= end; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
      const to = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      buckets.push({ id: day.toISOString(), label: clean(shortDay.format(day)), from: day, to });
    }
  } else if (period === "MES" || period === "TRIMESTRE") {
    for (let week = new Date(start); week <= end; week = new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7)) {
      const to = new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7);
      buckets.push({ id: week.toISOString(), label: clean(shortDay.format(week)), from: week, to });
    }
  } else {
    for (let month = new Date(start.getFullYear(), start.getMonth(), 1); month <= end; month = new Date(month.getFullYear(), month.getMonth() + 1, 1)) {
      const to = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      buckets.push({ id: month.toISOString(), label: clean(monthYear.format(month)), from: month, to });
    }
  }
  return buckets;
}

export function computeZoneStats(filters: StatsFilters, sources: StatsSources, now: Date = new Date()): ZoneStats {
  const { tickets, history, units, projects, categories, crews } = sources;
  const start = statsPeriodStart(filters.period, now);
  const inWindow = (iso: string) => start === null || new Date(iso) >= start;

  const unitOf = (ticket: Ticket) => units.find((unit) => unit.id === ticket.unitId);
  const projectOf = (ticket: Ticket) => projects.find((project) => project.id === unitOf(ticket)?.projectId);
  const historyOf = (ticket: Ticket) => history.filter((entry) => entry.ticketId === ticket.id);
  const closedAtOf = (ticket: Ticket) =>
    ticket.status === "CERRADO" ? (historyOf(ticket).findLast((entry) => entry.to === "CERRADO")?.createdAt ?? ticket.updatedAt) : null;

  // Todo lo que cumple los filtros salvo el período (sirve para contar cierres dentro de la ventana).
  const scoped = tickets.filter((ticket) => {
    const project = projectOf(ticket);
    return (
      (!filters.zoneId || project?.zoneId === filters.zoneId) &&
      (!filters.projectId || project?.id === filters.projectId) &&
      (!filters.categoryId || ticket.categoryId === filters.categoryId) &&
      (!filters.crewId || ticket.crewId === filters.crewId) &&
      matchesStatus(ticket, filters.status)
    );
  });
  const created = scoped.filter((ticket) => inWindow(ticket.createdAt));

  const rows: StatsRow[] = created
    .map((ticket) => {
      const entries = historyOf(ticket);
      const closedAt = closedAtOf(ticket);
      const end = closedAt ?? (isClosed(ticket.status) ? ticket.updatedAt : now.toISOString());
      const visit = entries.find((entry) => entry.to === "VISITA_INSPECTIVA");
      return {
        ticket,
        project: projectOf(ticket)?.name ?? "—",
        unit: unitOf(ticket),
        category: categories.find((item) => item.id === ticket.categoryId)?.name ?? "Sin categoría",
        reportedCategory: categories.find((item) => item.id === ticket.reportedCategoryId)?.name ?? "Sin categoría",
        crew: crews.find((item) => item.id === ticket.crewId)?.name ?? "Sin asignar",
        closedAt,
        days: Math.max(0, (new Date(end).getTime() - new Date(ticket.createdAt).getTime()) / DAY_MS),
        daysToVisit: visit ? Math.max(0, (new Date(visit.createdAt).getTime() - new Date(ticket.createdAt).getTime()) / DAY_MS) : null,
        ownerRejections: entries.filter((entry) => entry.from === "EN_RECEPCION" && entry.to === "PROGRAMADO").length,
      };
    })
    .toSorted((a, b) => b.ticket.createdAt.localeCompare(a.ticket.createdAt));

  const closedRows = rows.filter((row) => row.closedAt !== null);
  const statusOrder: TicketStatus[] = [...MAIN_FLOW, "NO_PROCEDE"];
  const byStatus = statusOrder
    .map((status) => ({ id: status, label: STATUS_LABEL[status], count: rows.filter((row) => row.ticket.status === status).length }))
    .filter((row) => row.count > 0);

  const firstTicket = tickets.reduce<string | null>((min, ticket) => (min === null || ticket.createdAt < min ? ticket.createdAt : min), null);
  const trendStart = start ?? startOfDay(firstTicket ? new Date(firstTicket) : now);
  const trend = buildBuckets(filters.period, trendStart, now).map((bucket) => {
    const within = (iso: string | null) => iso !== null && new Date(iso) >= bucket.from && new Date(iso) < bucket.to;
    return {
      id: bucket.id,
      label: bucket.label,
      ingresados: scoped.filter((ticket) => within(ticket.createdAt)).length,
      cerrados: scoped.filter((ticket) => within(closedAtOf(ticket))).length,
    };
  });

  return {
    start,
    end: now,
    rows,
    ingresados: rows.length,
    abiertos: rows.filter((row) => !isClosed(row.ticket.status)).length,
    cerrados: closedRows.length,
    noProcede: rows.filter((row) => row.ticket.status === "NO_PROCEDE").length,
    enRecepcion: rows.filter((row) => row.ticket.status === "EN_RECEPCION").length,
    casosEspeciales: rows.filter((row) => row.ticket.specialCase !== null).length,
    reclasificados: rows.filter((row) => row.ticket.categoryId !== row.ticket.reportedCategoryId).length,
    ownerRejections: rows.reduce((sum, row) => sum + row.ownerRejections, 0),
    atrasados: rows.filter((row) => !isClosed(row.ticket.status) && row.days > STALE_DAYS).length,
    cerradosEnPeriodo: scoped.filter((ticket) => {
      const closedAt = closedAtOf(ticket);
      return closedAt !== null && inWindow(closedAt);
    }).length,
    avgDaysToClose: average(closedRows.map((row) => row.days)),
    avgDaysToVisit: average(rows.flatMap((row) => (row.daysToVisit === null ? [] : [row.daysToVisit]))),
    byStatus,
    byCategory: countBy(rows.map((row) => row.category)),
    byProject: countBy(rows.map((row) => row.project)),
    byCrew: countBy(rows.map((row) => row.crew)),
    trend,
  };
}
