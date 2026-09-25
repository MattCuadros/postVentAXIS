/**
 * Cómo un documento cargado mueve un requerimiento por el flujo normal: a qué estado llega y con
 * qué historial (fechas del documento, en orden). Puro: no toca el store.
 */
import { formatDateAndTime, formatLongDate } from "@/lib/format";
import { DOCUMENT_LABEL, normalizeText, type DateTimeValue } from "@/lib/document-import/types";
import { MAIN_FLOW } from "@/lib/ticket-status";
import type { DocumentKind, Ticket, TicketStatus } from "@/types/domain";

/** Estados que registra cada tipo de documento, en orden. El último es el estado final. */
export const DOCUMENT_PATH: Record<DocumentKind, TicketStatus[]> = {
  EMAIL: ["INGRESADO"],
  OI: ["INGRESADO", "EN_REVISION"],
  OT: ["INGRESADO", "EN_REVISION", "ASIGNADO", "VISITA_INSPECTIVA", "PROGRAMADO"],
  OI_FIRMADA: ["INGRESADO", "EN_REVISION", "VISITA_INSPECTIVA", "CERRADO"],
  INFORME_AXIS: ["INGRESADO", "EN_REVISION", "VISITA_INSPECTIVA", "PROGRAMADO", "EN_EJECUCION", "EN_RECEPCION", "CERRADO"],
};

export interface ImportRowData {
  kind: DocumentKind;
  documentFolio: string | null;
  externalRefs: string[];
  requestDate: string | null;
  issuedDate: string | null;
  visit: DateTimeValue | null;
  execution: DateTimeValue[];
  repairDate: string | null;
  responsible: string | null;
}

export interface ImportStep {
  to: TicketStatus;
  /** ISO con hora local de mediodía (el documento solo trae la fecha). */
  at: string;
  comment: string;
}

export interface ImportPlan {
  mode: "create" | "advance" | "attach";
  status: TicketStatus;
  steps: ImportStep[];
  visit: DateTimeValue | null;
  scheduled: DateTimeValue | null;
}

/** "AB3C-000096/1" y "ab3c - 000096/1" son la misma referencia. */
export function refKey(value: string): string {
  return normalizeText(value).replace(/\s+/g, "");
}

/** Ticket existente que ya tiene alguna de las referencias del documento. */
export function findTicketByRefs(tickets: Ticket[], refs: string[]): Ticket | undefined {
  const keys = new Set(refs.map(refKey));
  return tickets.find((ticket) => ticket.externalRefs.some((ref) => keys.has(refKey(ref))));
}

function noonIso(date: string): string {
  return new Date(`${date}T12:00:00`).toISOString();
}

function executionSummary(execution: DateTimeValue[]): string {
  if (execution.length === 0) return "";
  const days = execution.map((item) => formatLongDate(item.date)).join(", ");
  const time = execution[0].time ? `, desde las ${execution[0].time}` : "";
  return `Ejecución: ${days}${time}`;
}

function stepComment(status: TicketStatus, row: ImportRowData, source: string): string {
  switch (status) {
    case "EN_REVISION":
      return row.kind === "OI" && row.visit
        ? `${source} · Visita acordada para el ${formatDateAndTime(row.visit.date, row.visit.time)}`
        : source;
    case "ASIGNADO":
      return row.responsible ? `${source} · Responsable: ${row.responsible}` : source;
    case "VISITA_INSPECTIVA":
      return row.kind === "OI_FIRMADA" ? `${source} · Solucionado en visita` : source;
    case "PROGRAMADO":
      return [source, executionSummary(row.execution)].filter(Boolean).join(" · ");
    case "CERRADO":
      return `${source} · Conformidad firmada por el propietario en el documento`;
    default:
      return source;
  }
}

function stepDate(status: TicketStatus, row: ImportRowData, today: string): string {
  const firstExecution = row.execution[0]?.date ?? null;
  const candidates: Record<TicketStatus, (string | null)[]> = {
    INGRESADO: [row.requestDate, row.issuedDate],
    EN_REVISION: [row.issuedDate, row.requestDate],
    ASIGNADO: [row.issuedDate, row.requestDate],
    VISITA_INSPECTIVA: [row.visit?.date ?? null, row.repairDate, row.issuedDate],
    PROGRAMADO: [row.issuedDate, firstExecution],
    EN_EJECUCION: [firstExecution, row.visit?.date ?? null, row.repairDate, row.issuedDate],
    EN_RECEPCION: [row.repairDate, row.issuedDate],
    CERRADO: [row.repairDate, row.issuedDate],
    NO_PROCEDE: [row.issuedDate],
  };
  return candidates[status].find((value): value is string => Boolean(value)) ?? today;
}

/**
 * Plan para un requerimiento del documento. Con `existing`, solo avanza (nunca retrocede); si el
 * documento no aporta un estado posterior, solo se adjunta.
 */
export function planImport(row: ImportRowData, existing: Ticket | undefined, today: string): ImportPlan {
  const source = `Registrado desde ${DOCUMENT_LABEL[row.kind]}${row.documentFolio ? ` ${row.documentFolio}` : ""}`;
  const path = DOCUMENT_PATH[row.kind];
  const current = existing ? MAIN_FLOW.indexOf(existing.status) : -1;
  const closed = existing?.status === "NO_PROCEDE" || existing?.status === "CERRADO";
  const pending = closed ? [] : path.filter((status) => MAIN_FLOW.indexOf(status) > current);

  let previous = "";
  const steps = pending.map((status) => {
    const date = stepDate(status, row, today);
    const ordered = date < previous ? previous : date;
    previous = ordered;
    return { to: status, at: noonIso(ordered), comment: stepComment(status, row, source) };
  });

  const visit = row.visit && (row.kind === "OI" || row.kind === "OI_FIRMADA") ? row.visit : null;
  const scheduled = row.kind === "OT" ? (row.execution[0] ?? null) : null;

  if (!existing) {
    return { mode: "create", status: path[path.length - 1], steps, visit, scheduled };
  }
  if (steps.length === 0) {
    return {
      mode: "attach",
      status: existing.status,
      steps: [{ to: existing.status, at: new Date().toISOString(), comment: `Documento adjuntado: ${DOCUMENT_LABEL[row.kind]}${row.documentFolio ? ` ${row.documentFolio}` : ""}` }],
      visit,
      scheduled,
    };
  }
  return { mode: "advance", status: steps[steps.length - 1].to, steps, visit, scheduled };
}
