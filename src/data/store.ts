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

export const initialState: DataState = {
  zones: [...zones],
  categories: [...categories],
  users: [...users],
  projects: [...projects],
  units: [...units],
  crews: [...crews],
  tickets: [...tickets],
  statusHistory: [...statusHistory],
};

export type DataAction =
  | { type: "CREATE_TICKET"; ticket: Ticket; historyId: string }
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
  | { type: "CREATE_USER"; user: User };

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

    case "CREATE_PROJECT":
      return { ...state, projects: [...state.projects, action.project] };
    case "CREATE_UNIT":
      return { ...state, units: [...state.units, action.unit] };
    case "CREATE_CREW":
      return { ...state, crews: [...state.crews, action.crew] };
    case "CREATE_USER":
      return { ...state, users: [...state.users, action.user] };
  }
}
