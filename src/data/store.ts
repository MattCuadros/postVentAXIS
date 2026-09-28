import { actorCapacityFor, canManageResponsibles } from "@/lib/unit-access";
import { canTransition, MAIN_FLOW } from "@/lib/ticket-status";
import {
  categories,
  crews,
  projects,
  statusHistory,
  tickets,
  units,
  unitResponsibles,
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
  UnitResponsible,
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
  unitResponsibles: UnitResponsible[];
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
  const seed = structuredClone({ zones, categories, users, projects, units, unitResponsibles, crews, tickets, statusHistory });
  return { ...seed, tickets: withUpcomingAgenda(seed.tickets) };
}

export type DataAction =
  | { type: "CREATE_TICKET"; ticket: Ticket; historyId: string }
  | { type: "MARK_SPECIAL_CASE"; ticketId: string; markedById: string; reason: string; markedAt: string; historyId: string }
  | {
      /**
       * Registro desde un documento cargado (correo, OI, OT, informe): crea o avanza tickets en un
       * solo paso, junto con los propietarios y unidades nuevas que el encargado confirmó. Valida
       * que ningún ticket existente retroceda en el flujo (el documento firmado reemplaza el clic
       * del propietario, por eso no se usa la validación por rol de canTransition).
       */
      type: "IMPORT_DOCUMENT";
      users: User[];
      units: Unit[];
      tickets: Ticket[];
      history: TicketStatusHistory[];
    }
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
  | { type: "UPDATE_UNIT"; unitId: string; changes: Partial<Omit<Unit, "id">> }
  | { type: "CREATE_RESPONSIBLE"; responsible: UnitResponsible; actingUserId: string }
  | {
      type: "UPDATE_RESPONSIBLE";
      responsibleId: string;
      changes: Partial<Pick<UnitResponsible, "relation" | "relationNote" | "canSignConformity">>;
      actingUserId: string;
    }
  | { type: "DELETE_RESPONSIBLE"; responsibleId: string; actingUserId: string }
  | { type: "CREATE_CREW"; crew: WorkCrew }
  | { type: "CREATE_USER"; user: User }
  | { type: "UPDATE_USER"; userId: string; changes: Partial<Omit<User, "id">> }
  /** Reemplaza todo el estado (datos leídos del almacenamiento local o restablecidos). */
  | { type: "REPLACE_STATE"; state: DataState };

/** Ticket resultante de una transición; lo usan el reducer y `api.ts` para devolver la entidad resuelta. */
export function applyTransition(ticket: Ticket, to: TicketStatus, changedAt: string, changes: TicketChanges = {}): Ticket {
  const { media, ...fields } = changes;
  return {
    ...ticket,
    ...fields,
    media: media ? [...ticket.media, ...media] : ticket.media,
    status: to,
    updatedAt: changedAt,
  };
}

export function reducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "CREATE_TICKET": {
      const creator = state.users.find(({ id }) => id === action.ticket.createdById);
      const createdUnit = state.units.find(({ id }) => id === action.ticket.unitId);
      const historyEntry: TicketStatusHistory = {
        id: action.historyId,
        ticketId: action.ticket.id,
        from: null,
        to: action.ticket.status,
        changedById: action.ticket.createdById,
        comment: null,
        actorCapacity: creator && createdUnit ? actorCapacityFor(creator, createdUnit, state.unitResponsibles) : null,
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

      const transitionedUnit = state.units.find(({ id }) => id === ticket.unitId);
      const historyEntry: TicketStatusHistory = {
        id: action.historyId,
        ticketId: ticket.id,
        from: ticket.status,
        to: action.to,
        changedById: action.changedById,
        comment: action.comment ?? null,
        actorCapacity: transitionedUnit ? actorCapacityFor(changedBy, transitionedUnit, state.unitResponsibles) : null,
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
        changedById: user.id, comment: `Caso especial: ${action.reason}`, actorCapacity: null, createdAt: action.markedAt,
      };
      return {
        ...state,
        tickets: state.tickets.map((item) => item.id === ticket.id
          ? { ...item, specialCase: { reason: action.reason, markedById: user.id, markedAt: action.markedAt }, updatedAt: action.markedAt }
          : item),
        statusHistory: [...state.statusHistory, historyEntry],
      };
    }

    case "IMPORT_DOCUMENT": {
      for (const ticket of action.tickets) {
        const existing = state.tickets.find(({ id }) => id === ticket.id);
        if (!existing) continue;
        const backwards = MAIN_FLOW.indexOf(ticket.status) < MAIN_FLOW.indexOf(existing.status);
        if (existing.status === "NO_PROCEDE" || backwards) {
          throw new Error(`Invalid document import for ticket ${ticket.id}`);
        }
      }

      const updated = new Map(action.tickets.map((ticket) => [ticket.id, ticket]));
      const newTickets = action.tickets.filter((ticket) => !state.tickets.some(({ id }) => id === ticket.id));

      // action.units puede traer unidades nuevas y unidades ya existentes que ganaron propietario
      // (ver Tarea 2): se actualizan por id en vez de duplicarlas.
      const updatedUnits = new Map(action.units.map((unit) => [unit.id, unit]));
      const newUnits = action.units.filter((unit) => !state.units.some(({ id }) => id === unit.id));

      return {
        ...state,
        users: [...state.users, ...action.users],
        units: [...state.units.map((unit) => updatedUnits.get(unit.id) ?? unit), ...newUnits],
        tickets: [...state.tickets.map((ticket) => updated.get(ticket.id) ?? ticket), ...newTickets],
        statusHistory: [...state.statusHistory, ...action.history],
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
        actorCapacity: null,
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
    case "UPDATE_UNIT":
      return {
        ...state,
        units: state.units.map((unit) => (unit.id === action.unitId ? { ...unit, ...action.changes, id: unit.id } : unit)),
      };

    case "CREATE_RESPONSIBLE": {
      const actor = state.users.find(({ id }) => id === action.actingUserId);
      const unit = state.units.find(({ id }) => id === action.responsible.unitId);
      if (!actor || !unit || !canManageResponsibles(actor, unit, state.projects)) {
        throw new Error("Not authorized to manage unit responsibles");
      }
      return { ...state, unitResponsibles: [...state.unitResponsibles, action.responsible] };
    }

    case "UPDATE_RESPONSIBLE": {
      const actor = state.users.find(({ id }) => id === action.actingUserId);
      const responsible = state.unitResponsibles.find(({ id }) => id === action.responsibleId);
      const unit = responsible && state.units.find(({ id }) => id === responsible.unitId);
      if (!actor || !responsible || !unit || !canManageResponsibles(actor, unit, state.projects)) {
        throw new Error("Not authorized to manage unit responsibles");
      }
      return {
        ...state,
        unitResponsibles: state.unitResponsibles.map((item) =>
          item.id === action.responsibleId ? { ...item, ...action.changes, id: item.id } : item,
        ),
      };
    }

    case "DELETE_RESPONSIBLE": {
      const actor = state.users.find(({ id }) => id === action.actingUserId);
      const responsible = state.unitResponsibles.find(({ id }) => id === action.responsibleId);
      const unit = responsible && state.units.find(({ id }) => id === responsible.unitId);
      if (!actor || !responsible || !unit || !canManageResponsibles(actor, unit, state.projects)) {
        throw new Error("Not authorized to manage unit responsibles");
      }
      return { ...state, unitResponsibles: state.unitResponsibles.filter((item) => item.id !== action.responsibleId) };
    }

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
