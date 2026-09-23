import type { Ticket, Unit } from "@/types/domain";
import { isClosed } from "@/lib/ticket-status";

const shortDate = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long" });
const dateTime = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const DAY_MS = 24 * 60 * 60 * 1000;

/** Las fechas sin hora ("2026-09-25") se leen a mediodía para no correrse de día por zona horaria. */
function toDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

/** "20 sept" */
export function formatShortDate(iso: string): string {
  return shortDate.format(toDate(iso)).replace(".", "");
}

/** "14 de agosto" */
export function formatLongDate(iso: string): string {
  return longDate.format(toDate(iso));
}

/** "14 ago, 09:30" */
export function formatDateTime(iso: string): string {
  return dateTime.format(toDate(iso)).replace(".", "");
}

/** Fecha de hoy en formato YYYY-MM-DD (hora local), para inputs `type="date"`. */
export function todayIso(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/** Días que el ticket lleva (o llevó, si está cerrado) abierto. */
export function daysOpen(ticket: Ticket, now: Date = new Date()): number {
  const end = isClosed(ticket.status) ? new Date(ticket.updatedAt) : now;
  return Math.max(0, Math.floor((end.getTime() - new Date(ticket.createdAt).getTime()) / DAY_MS));
}

/** "Torre A 704" para departamentos, "Casa 12" para casas. */
export function unitLabel(unit: Unit): string {
  if (unit.type === "CASA") return `Casa ${unit.number}`;
  return unit.tower === null ? `Depto. ${unit.number}` : `Torre ${unit.tower} ${unit.number}`;
}
