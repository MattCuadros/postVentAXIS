import type { Ticket, TicketStatus } from "@/types/domain";

export type AgendaKind = "VISITA" | "TRABAJO";

export interface AgendaItem {
  /** Único por ticket y tipo: `${ticketId}:VISITA`. */
  id: string;
  ticket: Ticket;
  kind: AgendaKind;
  date: string;
  time: string | null;
  /** Ya realizado (la visita se registró o el trabajo terminó). */
  done: boolean;
  /** Se puede reagendar arrastrándolo: pendiente y no en el pasado. */
  editable: boolean;
}

/** Duración por defecto de cada tipo en el calendario, en minutos. */
export const AGENDA_DURATION: Record<AgendaKind, number> = { VISITA: 60, TRABAJO: 120 };

const VISIT_PENDING: TicketStatus[] = ["EN_REVISION", "ASIGNADO"];
const WORK_STATUSES: TicketStatus[] = ["PROGRAMADO", "EN_EJECUCION", "EN_RECEPCION", "CERRADO"];

/**
 * Visitas y trabajos de los tickets: la visita agendada mientras está pendiente (y ya realizada
 * después), y el trabajo desde que se programa. `today` es la fecha local YYYY-MM-DD.
 */
export function buildAgenda(tickets: Ticket[], today: string): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const ticket of tickets) {
    if (ticket.visitDate && ticket.status !== "NO_PROCEDE") {
      const pending = VISIT_PENDING.includes(ticket.status);
      items.push({
        id: `${ticket.id}:VISITA`,
        ticket,
        kind: "VISITA",
        date: ticket.visitDate,
        time: ticket.visitTime,
        done: !pending,
        editable: ticket.status === "ASIGNADO" && ticket.visitDate >= today,
      });
    }

    if (ticket.scheduledDate && WORK_STATUSES.includes(ticket.status)) {
      items.push({
        id: `${ticket.id}:TRABAJO`,
        ticket,
        kind: "TRABAJO",
        date: ticket.scheduledDate,
        time: ticket.scheduledTime,
        done: ticket.status === "EN_RECEPCION" || ticket.status === "CERRADO",
        editable: ticket.status === "PROGRAMADO" && ticket.scheduledDate >= today,
      });
    }
  }

  return items;
}

/** Inicio y término en hora local "YYYY-MM-DDTHH:mm:00" (o solo la fecha si no hay hora). */
export function agendaRange(item: Pick<AgendaItem, "date" | "time" | "kind">): { start: string; end?: string } {
  if (!item.time) return { start: item.date };
  const start = new Date(`${item.date}T${item.time}:00`);
  const end = new Date(start.getTime() + AGENDA_DURATION[item.kind] * 60_000);
  return { start: `${item.date}T${item.time}:00`, end: localDateTime(end) };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

/** "YYYY-MM-DD" y "HH:mm" en hora local de un Date (para lo que devuelve el calendario). */
export function splitLocal(date: Date): { date: string; time: string } {
  const [day, time] = localDateTime(date).split("T");
  return { date: day, time: time.slice(0, 5) };
}

interface GoogleEventInput {
  title: string;
  date: string;
  time: string | null;
  durationMinutes: number;
  details: string;
  location: string;
}

/**
 * Enlace "Agregar a Google Calendar" (plantilla de evento, sin OAuth): abre el calendario de la
 * cuenta con la que el encargado tenga sesión, con los datos precargados.
 */
export function googleCalendarUrl({ title, date, time, durationMinutes, details, location }: GoogleEventInput): string {
  const compact = (value: string) => value.replace(/[-:]/g, "");
  let dates: string;

  if (time) {
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    dates = `${compact(localDateTime(start))}/${compact(localDateTime(end))}`;
  } else {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + 1);
    dates = `${compact(date)}/${compact(next.toLocaleDateString("sv-SE"))}`;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
    details,
    location,
    ctz: "America/Santiago",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
