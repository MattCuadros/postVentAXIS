import { canTransition } from "@/lib/ticket-status";
import {
  categories,
  crews,
  projects,
  statusHistory,
  tickets,
  units,
  users,
  zones,
} from "@/mocks/data";
import type {
  Project,
  Ticket,
  TicketChanges,
  TicketStatus,
  TicketStatusHistory,
  Unit,
  User,
  WorkCrew,
  Zone,
  TicketCategory,
} from "@/types/domain";

export interface DataState {
  zones: Zone[];
  categories: TicketCategory[];
  users: User[];
  projects: Project[];
  units: Unit[];
  crews: WorkCrew[];
  tickets: Ticket[];
  statusHistory: TicketStatusHistory[];
}

/** Fecha YYYY-MM-DD (hora local) a `days` días de hoy. */
function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("sv-SE");
}

/**
 * Agenda de la demo relativa a hoy: la visita del ticket ASIGNADO y el trabajo del PROGRAMADO
 * quedan siempre en los próximos días, para que el calendario del encargado nunca esté vacío.
 */
function withUpcomingAgenda(seedTickets: Ticket[]): Ticket[] {
  return seedTickets.map((ticket) => {
    if (ticket.status === "ASIGNADO") {
      return { ...ticket, visitDate: daysFromToday(2), visitTime: "10:00" };
    }
    if (ticket.status === "PROGRAMADO") {
      return { ...ticket, scheduledDate: daysFromToday(4), scheduledTime: "09:00" };
    }
    return ticket;
  });
}

/** Estado inicial con los datos de ejemplo (copia nueva cada vez: se usa también al restablecer). */
export function createSeedState(): DataState {
  const seed = structuredClone({ zones, categories, users, projects, units, crews, tickets, statusHistory });
  return { ...seed, tickets: withUpcomingAgenda(seed.tickets) };
}

export type DataAction =
  | { type: "CREATE_TICKET"; ticket: Ticket; historyId: string }
  | { type: "MARK_SPECIAL_CASE"; ticketId: string; markedById: string; reason: string; markedAt: string; historyId: string }
  | {
      /** Agenda o reagenda la visita inspectiva sin cambiar el estado (solo mientras está ASIGNADO). */
      type: "SCHEDULE_VISIT";
      ticketId: string;
      visitDate: string;
      visitTime: string | null;
      changedById: string;
      comment: string;
      changedAt: string;
      historyId: string;
    }
  | {
      type: "TRANSITION_TICKET";
      ticketId: string;
      to: TicketStatus;
      changedById: string;
      comment?: string;
      changes?: TicketChanges;
      changedAt: string;
      historyId: string;
    }
  | { type: "CREATE_PROJECT"; project: Project }
  | { type: "CREATE_UNIT"; unit: Unit }
  | { type: "CREATE_CREW"; crew: WorkCrew }
  | { type: "CREATE_USER"; user: User }
  | { type: "UPDATE_USER"; userId: string; changes: Partial<Omit<User, "id">> }
  /** Reemplaza todo el estado (datos leídos del almacenamiento local o restablecidos). */
  | { type: "REPLACE_STATE"; state: DataState };

/** Ticket resultante de una transición; lo usan el reducer y `api.ts` para devolver la entidad resuelta. */
export function applyTransition(ticket: Ticket, to: TicketStatus, changedAt: string, changes: TicketChanges = {}): Ticket {
  const { photos, ...fields } = changes;
  return {
    ...ticket,
    ...fields,
    photos: photos ? [...ticket.photos, ...photos] : ticket.photos,
    status: to,
    updatedAt: changedAt,
  };
}

export function reducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "CREATE_TICKET": {
      const historyEntry: TicketStatusHistory = {
        id: action.historyId,
        ticketId: action.ticket.id,
        from: null,
        to: action.ticket.status,
        changedById: action.ticket.createdById,
        comment: null,
        createdAt: action.ticket.createdAt,
      };

      return {
        ...state,
        tickets: [...state.tickets, action.ticket],
        statusHistory: [...state.statusHistory, historyEntry],
      };
    }

    case "TRANSITION_TICKET": {
      const ticket = state.tickets.find(({ id }) => id === action.ticketId);
      if (ticket === undefined) {
        throw new Error(`Ticket not found: ${action.ticketId}`);
      }

      const changedBy = state.users.find(({ id }) => id === action.changedById);
      if (changedBy === undefined) {
        throw new Error(`User not found: ${action.changedById}`);
      }

      if (!canTransition(ticket.status, action.to, changedBy.role)) {
        throw new Error(`Invalid ticket transition: ${ticket.status} -> ${action.to}`);
      }

      const historyEntry: TicketStatusHistory = {
        id: action.historyId,
        ticketId: ticket.id,
        from: ticket.status,
        to: action.to,
        changedById: action.changedById,
        comment: action.comment ?? null,
        createdAt: action.changedAt,
      };

      return {
        ...state,
        tickets: state.tickets.map((item) =>
          item.id === ticket.id ? applyTransition(item, action.to, action.changedAt, action.changes) : item,
        ),
        statusHistory: [...state.statusHistory, historyEntry],
      };
    }

    case "MARK_SPECIAL_CASE": {
      const ticket = state.tickets.find(({ id }) => id === action.ticketId);
      const user = state.users.find(({ id }) => id === action.markedById);
      if (!ticket || !user || action.reason.trim().length < 10 || user.role === "PROPIETARIO" || ticket.specialCase !== null || !["EN_REVISION", "VISITA_INSPECTIVA"].includes(ticket.status)) {
        throw new Error("Invalid special case action");
      }
      const historyEntry: TicketStatusHistory = {
        id: action.historyId, ticketId: ticket.id, from: ticket.status, to: ticket.status,
        changedById: user.id, comment: `Caso especial: ${action.reason}`, createdAt: action.markedAt,
      };
      return {
        ...state,
        tickets: state.tickets.map((item) => item.id === ticket.id
          ? { ...item, specialCase: { reason: action.reason, markedById: user.id, markedAt: action.markedAt }, updatedAt: action.markedAt }
          : item),
        statusHistory: [...state.statusHistory, historyEntry],
      };
    }

    case "SCHEDULE_VISIT": {
      const ticket = state.tickets.find(({ id }) => id === action.ticketId);
      const user = state.users.find(({ id }) => id === action.changedById);
      if (!ticket || !user || user.role === "PROPIETARIO" || ticket.status !== "ASIGNADO") {
        throw new Error("Invalid schedule visit action");
      }

      const historyEntry: TicketStatusHistory = {
        id: action.historyId,
        ticketId: ticket.id,
        from: ticket.status,
        to: ticket.status,
        changedById: user.id,
        comment: action.comment,
        createdAt: action.changedAt,
      };

      return {
        ...state,
        tickets: state.tickets.map((item) =>
          item.id === ticket.id
            ? { ...item, visitDate: action.visitDate, visitTime: action.visitTime, updatedAt: action.changedAt }
            : item,
        ),
        statusHistory: [...state.statusHistory, historyEntry],
      };
    }

    case "CREATE_PROJECT":
      return { ...state, projects: [...state.projects, action.project] };
    case "CREATE_UNIT":
      return { ...state, units: [...state.units, action.unit] };
    case "CREATE_CREW":
      return { ...state, crews: [...state.crews, action.crew] };
    case "CREATE_USER":
      return { ...state, users: [...state.users, action.user] };
    case "UPDATE_USER":
      return {
        ...state,
        users: state.users.map((user) => (user.id === action.userId ? { ...user, ...action.changes, id: user.id } : user)),
      };
    case "REPLACE_STATE":
      return action.state;
  }
}
