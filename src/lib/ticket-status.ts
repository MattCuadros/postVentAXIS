import type { Role, TicketStatus } from "@/types/domain";

/** Etiquetas visibles para el usuario. */
export const STATUS_LABEL: Record<TicketStatus, string> = {
  INGRESADO: "Ingresado",
  EN_REVISION: "En revisión",
  ASIGNADO: "Equipo asignado",
  VISITA_INSPECTIVA: "Visita inspectiva",
  PROGRAMADO: "Trabajo programado",
  EN_EJECUCION: "En ejecución",
  EN_RECEPCION: "Esperando conformidad",
  CERRADO: "Cerrado",
  NO_PROCEDE: "No procede",
};

/** Etiquetas en segunda persona para la vista del propietario. */
export const OWNER_STATUS_LABEL: Partial<Record<TicketStatus, string>> = {
  EN_RECEPCION: "Esperando tu conformidad",
};

/** Camino principal, usado por la línea de tiempo. */
export const MAIN_FLOW: TicketStatus[] = [
  "INGRESADO",
  "EN_REVISION",
  "ASIGNADO",
  "VISITA_INSPECTIVA",
  "PROGRAMADO",
  "EN_EJECUCION",
  "EN_RECEPCION",
  "CERRADO",
];

export type StatusTone = "neutral" | "active" | "attention" | "success" | "danger";

export const STATUS_TONE: Record<TicketStatus, StatusTone> = {
  INGRESADO: "neutral",
  EN_REVISION: "active",
  ASIGNADO: "active",
  VISITA_INSPECTIVA: "active",
  PROGRAMADO: "active",
  EN_EJECUCION: "active",
  EN_RECEPCION: "attention",
  CERRADO: "success",
  NO_PROCEDE: "danger",
};

export interface Transition {
  to: TicketStatus;
  /** Roles que pueden ejecutarla. ADMIN puede todo lo que puede ENCARGADO. */
  roles: Role[];
  /** Texto del botón que dispara la transición. */
  action: string;
  requiresComment: boolean;
}

const STAFF: Role[] = ["ENCARGADO", "ADMIN"];

export const TRANSITIONS: Record<TicketStatus, Transition[]> = {
  INGRESADO: [{ to: "EN_REVISION", roles: STAFF, action: "Iniciar revisión", requiresComment: false }],
  EN_REVISION: [
    { to: "ASIGNADO", roles: STAFF, action: "Asignar equipo", requiresComment: false },
    { to: "NO_PROCEDE", roles: STAFF, action: "Marcar como no procede", requiresComment: true },
  ],
  ASIGNADO: [{ to: "VISITA_INSPECTIVA", roles: STAFF, action: "Registrar visita", requiresComment: false }],
  VISITA_INSPECTIVA: [
    { to: "PROGRAMADO", roles: STAFF, action: "Programar trabajo", requiresComment: false },
    { to: "NO_PROCEDE", roles: STAFF, action: "Marcar como no procede", requiresComment: true },
  ],
  PROGRAMADO: [{ to: "EN_EJECUCION", roles: STAFF, action: "Iniciar trabajo", requiresComment: false }],
  EN_EJECUCION: [{ to: "EN_RECEPCION", roles: STAFF, action: "Solicitar recepción", requiresComment: false }],
  EN_RECEPCION: [
    { to: "CERRADO", roles: ["PROPIETARIO"], action: "Recibir conforme", requiresComment: false },
    { to: "PROGRAMADO", roles: ["PROPIETARIO"], action: "No estoy conforme", requiresComment: true },
  ],
  CERRADO: [],
  NO_PROCEDE: [],
};

export function availableTransitions(status: TicketStatus, role: Role): Transition[] {
  return TRANSITIONS[status].filter((t) => t.roles.includes(role));
}

export function canTransition(from: TicketStatus, to: TicketStatus, role: Role): boolean {
  return availableTransitions(from, role).some((t) => t.to === to);
}

/** El propietario tiene una acción pendiente sobre el ticket (hoy: dar su conformidad). */
export function requiresOwnerAction(status: TicketStatus): boolean {
  return availableTransitions(status, "PROPIETARIO").length > 0;
}

export function isClosed(status: TicketStatus): boolean {
  return status === "CERRADO" || status === "NO_PROCEDE";
}
