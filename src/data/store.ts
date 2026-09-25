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

/** Estado inicial con los datos de ejemplo (copia nueva cada vez: se usa también al restablecer). */
export function createSeedState(): DataState {
  return structuredClone({ zones, categories, users, projects, units, crews, tickets, statusHistory });
}

export type DataAction =
  | { type: "CREATE_TICKET"; ticket: Ticket; historyId: string }
  | { type: "MARK_SPECIAL_CASE"; ticketId: string; markedById: string; reason: string; markedAt: string; historyId: string }
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
