"use client";

import { useCallback, useMemo } from "react";
import { applyTransition } from "@/data/store";
import { isSupabaseDataSourceEnabled, loadTicketsFromSupabase, loadUsersFromSupabase, saveTicketToSupabase, saveUserToSupabase } from "@/data/supabase-repository";
import { useDataContext } from "@/data/store-context";
import { delay } from "@/lib/delay";
import { findTicketByRefs, planImport, type ImportPlan, type ImportRowData } from "@/lib/document-import/plan";
import { nextFolio } from "@/lib/folio";
import { todayIso } from "@/lib/format";
import { unitsForUser } from "@/lib/unit-access";
import type {
  DocumentKind,
  Project,
  ResponsibleRelation,
  Ticket,
  TicketChanges,
  TicketStatus,
  TicketStatusHistory,
  Unit,
  UnitResponsible,
  User,
  WorkCrew,
} from "@/types/domain";

export type CreateTicketInput = Omit<Ticket, "id" | "folio" | "status" | "createdAt" | "updatedAt" | "reportedCategoryId" | "specialCase" | "visitTime" | "scheduledTime" | "externalRefs" | "documents">;
export type CreateProjectInput = Omit<Project, "id">;
export type CreateUnitInput = Omit<Unit, "id">;
export type UpdateUnitInput = Partial<Omit<Unit, "id" | "projectId">>;
export type CreateCrewInput = Omit<WorkCrew, "id">;
export type CreateUserInput = Omit<User, "id">;
export type UpdateUserInput = Partial<Omit<User, "id">>;

/** Un requerimiento del documento, ya revisado y confirmado por el encargado. */
export interface ImportRequirementInput {
  row: ImportRowData;
  projectId: string;
  /** Unidad existente; o bien `newUnit` para crearla. */
  unitId: string | null;
  newUnit: Pick<Unit, "type" | "tower" | "floor" | "number" | "deliveryDate"> | null;
  /**
   * Propietario para la unidad nueva, o para una existente que aún no tenga uno: uno ya
   * registrado, o `newOwner` para crearlo. Ambos null si no hay datos de propietario.
   */
  ownerId: string | null;
  newOwner: Pick<User, "name" | "email" | "phone"> | null;
  categoryId: string;
  room: string;
  description: string;
}

export interface ImportDocumentInput {
  kind: DocumentKind;
  documentId: string;
  fileName: string;
  size: number;
  userId: string;
  requirements: ImportRequirementInput[];
}

export interface ImportResult {
  ticket: Ticket;
  mode: ImportPlan["mode"];
}

function simulatedLatency(): Promise<void> {
  return delay(150 + Math.floor(Math.random() * 151));
}

export function useDataApi() {
  const { state, dispatch } = useDataContext();

  const getTickets = useCallback(async (): Promise<Ticket[]> => {
    if (isSupabaseDataSourceEnabled()) {
      const remote = await loadTicketsFromSupabase();
      if (remote) return remote;
    }
    await simulatedLatency();
    return state.tickets;
  }, [state.tickets]);

  const getTicket = useCallback(async (id: string): Promise<Ticket | undefined> => {
    if (isSupabaseDataSourceEnabled()) {
      const remote = await loadTicketsFromSupabase();
      if (remote) return remote.find((ticket) => ticket.id === id);
    }
    await simulatedLatency();
    return state.tickets.find((ticket) => ticket.id === id);
  }, [state.tickets]);

  /** Tickets de las unidades donde la persona es titular o responsable. */
  const getTicketsForUser = useCallback(async (userId: string): Promise<Ticket[]> => {
    await simulatedLatency();
    const user = state.users.find((item) => item.id === userId);
    if (!user) return [];
    const unitIds = new Set(unitsForUser(user, state.units, state.unitResponsibles).map((unit) => unit.id));
    return state.tickets
      .filter((ticket) => unitIds.has(ticket.unitId))
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.tickets, state.units, state.users, state.unitResponsibles]);

  /** Tickets de las obras ubicadas en las zonas indicadas (bandeja del encargado). */
  const getTicketsByZones = useCallback(async (zoneIds: string[]): Promise<Ticket[]> => {
    await simulatedLatency();
    const projectIds = new Set(state.projects.filter((project) => zoneIds.includes(project.zoneId)).map((project) => project.id));
    const unitIds = new Set(state.units.filter((unit) => projectIds.has(unit.projectId)).map((unit) => unit.id));
    return state.tickets
      .filter((ticket) => unitIds.has(ticket.unitId))
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.projects, state.tickets, state.units]);

  const getTicketHistory = useCallback(async (ticketId: string): Promise<TicketStatusHistory[]> => {
    await simulatedLatency();
    return state.statusHistory
      .filter((entry) => entry.ticketId === ticketId)
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [state.statusHistory]);

  const getStatusHistory = useCallback(async (): Promise<TicketStatusHistory[]> => {
    await simulatedLatency();
    return state.statusHistory;
  }, [state.statusHistory]);

  const createTicket = useCallback(async (input: CreateTicketInput): Promise<Ticket> => {
    await simulatedLatency();
    const now = new Date().toISOString();
    const unit = state.units.find((item) => item.id === input.unitId);
    const project = state.projects.find((item) => item.id === unit?.projectId);
    const zone = state.zones.find((item) => item.id === project?.zoneId);
    if (!unit || !project || !zone) throw new Error("No encontramos la obra para generar el folio.");
    const ticket: Ticket = {
      ...input,
      id: crypto.randomUUID(),
      folio: nextFolio(state.tickets, state.units, project, zone),
      reportedCategoryId: input.categoryId,
      specialCase: null,
      visitTime: null,
      scheduledTime: null,
      externalRefs: [],
      documents: [],
      status: "INGRESADO",
      createdAt: now,
      updatedAt: now,
    };

    dispatch({ type: "CREATE_TICKET", ticket, historyId: crypto.randomUUID() });
    if (isSupabaseDataSourceEnabled()) {
      await saveTicketToSupabase(ticket);
    }
    return ticket;
  }, [dispatch, state.projects, state.tickets, state.units, state.zones]);

  const markSpecialCase = useCallback(async (ticketId: string, markedById: string, reason: string): Promise<Ticket> => {
    await simulatedLatency();
    const cleanReason = reason.trim();
    if (cleanReason.length < 10) throw new Error("Special case reason is too short");
    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
    const markedAt = new Date().toISOString();
    dispatch({ type: "MARK_SPECIAL_CASE", ticketId, markedById, reason: cleanReason, markedAt, historyId: crypto.randomUUID() });
    return { ...ticket, specialCase: { reason: cleanReason, markedById, markedAt }, updatedAt: markedAt };
  }, [dispatch, state.tickets]);

  /** Agenda o reagenda la visita inspectiva de un ticket EN_REVISION, sin cambiar su estado. */
  const scheduleVisit = useCallback(async (
    ticketId: string,
    changedById: string,
    visitDate: string,
    visitTime: string | null,
    comment: string,
  ): Promise<Ticket> => {
    await simulatedLatency();
    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
    const changedAt = new Date().toISOString();
    dispatch({
      type: "SCHEDULE_VISIT",
      ticketId,
      visitDate,
      visitTime,
      changedById,
      comment,
      changedAt,
      historyId: crypto.randomUUID(),
    });
    return { ...ticket, visitDate, visitTime, updatedAt: changedAt };
  }, [dispatch, state.tickets]);

  const transitionTicket = useCallback(async (
    ticketId: string,
    to: TicketStatus,
    changedById: string,
    comment?: string,
    changes?: TicketChanges,
  ): Promise<Ticket> => {
    await simulatedLatency();
    const existingTicket = state.tickets.find((ticket) => ticket.id === ticketId);
    if (existingTicket === undefined) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    const changedAt = new Date().toISOString();
    dispatch({
      type: "TRANSITION_TICKET",
      ticketId,
      to,
      changedById,
      comment,
      changes,
      changedAt,
      historyId: crypto.randomUUID(),
    });

    return applyTransition(existingTicket, to, changedAt, changes);
  }, [dispatch, state.tickets]);

  /** Registra los requerimientos de un documento cargado (crea o avanza tickets). Un solo dispatch. */
  const importDocument = useCallback(async (input: ImportDocumentInput): Promise<ImportResult[]> => {
    await simulatedLatency();
    const today = todayIso();
    const newUsers: User[] = [];
    // Unidades nuevas y unidades existentes que ganan propietario en esta carga (Tarea 2): se
    // acumulan aquí para que las siguientes filas del mismo documento vean la versión al día.
    const unitsById = new Map<string, Unit>(state.units.map((item) => [item.id, item]));
    const changedUnitIds = new Set<string>();
    const tickets: Ticket[] = [];
    const history: TicketStatusHistory[] = [];
    const results: ImportResult[] = [];
    const document = {
      id: input.documentId,
      kind: input.kind,
      fileName: input.fileName,
      size: input.size,
      uploadedById: input.userId,
      uploadedAt: new Date().toISOString(),
    };

    for (const requirement of input.requirements) {
      const project = state.projects.find((item) => item.id === requirement.projectId);
      const zone = state.zones.find((item) => item.id === project?.zoneId);
      if (!project || !zone) throw new Error("Obra no encontrada");

      // El correo/documento puede traer un propietario existente (ownerId) o datos para crear uno
      // nuevo (newOwner); null si no trae ninguno (la unidad queda, o sigue, sin propietario).
      const resolveOwnerId = (): string | null => {
        if (requirement.ownerId) return requirement.ownerId;
        if (!requirement.newOwner) return null;
        const email = requirement.newOwner.email.toLowerCase();
        const known = [...state.users, ...newUsers].find((user) => user.email.toLowerCase() === email);
        if (known) return known.id;
        const owner: User = { ...requirement.newOwner, id: crypto.randomUUID(), role: "PROPIETARIO", zoneIds: [], projectIds: [], active: true };
        newUsers.push(owner);
        return owner.id;
      };

      let unit = requirement.unitId ? unitsById.get(requirement.unitId) : undefined;
      const wanted = requirement.newUnit;
      if (!unit && wanted) {
        // Varias filas del mismo documento pueden traer la misma unidad nueva: se crea una sola vez.
        unit = [...unitsById.values()].find((item) =>
          item.projectId === project.id &&
          item.type === wanted.type &&
          (item.tower ?? "") === (wanted.tower ?? "") &&
          item.number.toUpperCase() === wanted.number.toUpperCase(),
        );
      }
      if (!unit && wanted) {
        unit = { ...wanted, id: crypto.randomUUID(), projectId: project.id, ownerId: resolveOwnerId() };
        unitsById.set(unit.id, unit);
        changedUnitIds.add(unit.id);
      }
      if (!unit) throw new Error("Unidad no encontrada");

      // Unidad ya existente (o recién creada en esta misma carga) sin propietario: si esta fila
      // trae datos de propietario, se le asigna (Tarea 2.5; el origen de esos datos se amplía en
      // la Tarea 4 con el remitente del correo).
      if (unit.ownerId === null) {
        const ownerId = resolveOwnerId();
        if (ownerId) {
          unit = { ...unit, ownerId };
          unitsById.set(unit.id, unit);
          changedUnitIds.add(unit.id);
        }
      }

      // Tickets vigentes: los del store con los cambios de esta carga, más los creados en ella.
      const allTickets = [
        ...state.tickets.map((ticket) => tickets.find(({ id }) => id === ticket.id) ?? ticket),
        ...tickets.filter((ticket) => !state.tickets.some(({ id }) => id === ticket.id)),
      ];
      const existing = findTicketByRefs(allTickets, requirement.row.externalRefs);
      const plan = planImport(requirement.row, existing, today);
      const lastAt = plan.steps.at(-1)?.at ?? new Date().toISOString();
      const scheduleChanges = {
        ...(plan.visit ? { visitDate: plan.visit.date, visitTime: plan.visit.time } : {}),
        ...(plan.scheduled ? { scheduledDate: plan.scheduled.date, scheduledTime: plan.scheduled.time } : {}),
      };

      let ticket: Ticket;
      if (existing) {
        const refs = [...new Set([...existing.externalRefs, ...requirement.row.externalRefs])];
        ticket = {
          ...existing,
          ...scheduleChanges,
          status: plan.status,
          externalRefs: refs,
          documents: [...existing.documents, document],
          encargadoId: existing.encargadoId ?? input.userId,
          updatedAt: lastAt,
        };
      } else {
        const createdAt = plan.steps[0]?.at ?? new Date().toISOString();
        ticket = {
          id: crypto.randomUUID(),
          folio: nextFolio(allTickets, [...unitsById.values()], project, zone),
          unitId: unit.id,
          categoryId: requirement.categoryId,
          reportedCategoryId: requirement.categoryId,
          room: requirement.room,
          description: requirement.description,
          status: plan.status,
          media: [],
          createdById: input.userId,
          encargadoId: input.userId,
          crewId: null,
          visitDate: null,
          visitTime: null,
          scheduledDate: null,
          scheduledTime: null,
          ...scheduleChanges,
          rejectionReason: null,
          specialCase: null,
          externalRefs: requirement.row.externalRefs,
          documents: [document],
          createdAt,
          updatedAt: lastAt,
        };
      }

      const index = tickets.findIndex(({ id }) => id === ticket.id);
      if (index >= 0) tickets[index] = ticket;
      else tickets.push(ticket);

      let from = existing?.status ?? null;
      for (const step of plan.steps) {
        history.push({
          id: crypto.randomUUID(),
          ticketId: ticket.id,
          from,
          to: step.to,
          changedById: input.userId,
          comment: step.comment,
          actorCapacity: null,
          createdAt: step.at,
        });
        from = step.to;
      }
      results.push({ ticket, mode: plan.mode });
    }

    const units = [...changedUnitIds].map((id) => unitsById.get(id)!);
    dispatch({ type: "IMPORT_DOCUMENT", users: newUsers, units, tickets, history });
    return results;
  }, [dispatch, state.projects, state.tickets, state.units, state.users, state.zones]);

  /** Unidades donde la persona es titular o responsable. */
  const getUnitsForUser = useCallback(async (userId: string): Promise<Unit[]> => {
    await simulatedLatency();
    const user = state.users.find((item) => item.id === userId);
    return user ? unitsForUser(user, state.units, state.unitResponsibles) : [];
  }, [state.units, state.users, state.unitResponsibles]);

  /** Todos los responsables de todas las unidades; se filtra por unidad en quien la use. */
  const getUnitResponsibles = useCallback(async (): Promise<UnitResponsible[]> => {
    await simulatedLatency();
    return state.unitResponsibles;
  }, [state.unitResponsibles]);

  const createResponsible = useCallback(
    async (
      unitId: string,
      input: { userId: string; relation: ResponsibleRelation; relationNote: string | null; canSignConformity: boolean },
      actingUserId: string,
    ): Promise<UnitResponsible> => {
      await simulatedLatency();
      const responsible: UnitResponsible = {
        id: crypto.randomUUID(),
        unitId,
        ...input,
        createdAt: new Date().toISOString(),
        createdById: actingUserId,
      };
      dispatch({ type: "CREATE_RESPONSIBLE", responsible, actingUserId });
      return responsible;
    },
    [dispatch],
  );

  const updateResponsible = useCallback(
    async (
      responsibleId: string,
      changes: Partial<Pick<UnitResponsible, "relation" | "relationNote" | "canSignConformity">>,
      actingUserId: string,
    ): Promise<void> => {
      await simulatedLatency();
      dispatch({ type: "UPDATE_RESPONSIBLE", responsibleId, changes, actingUserId });
    },
    [dispatch],
  );

  const deleteResponsible = useCallback(async (responsibleId: string, actingUserId: string): Promise<void> => {
    await simulatedLatency();
    dispatch({ type: "DELETE_RESPONSIBLE", responsibleId, actingUserId });
  }, [dispatch]);

  const getUnits = useCallback(async (): Promise<Unit[]> => {
    await simulatedLatency();
    return state.units;
  }, [state.units]);

  const getProjects = useCallback(async (): Promise<Project[]> => {
    await simulatedLatency();
    return state.projects;
  }, [state.projects]);

  const getUsers = useCallback(async (): Promise<User[]> => {
    if (isSupabaseDataSourceEnabled()) {
      const remote = await loadUsersFromSupabase();
      if (remote) return remote;
    }
    await simulatedLatency();
    return state.users;
  }, [state.users]);

  const getCrewsByZone = useCallback(async (zoneId: string): Promise<WorkCrew[]> => {
    await simulatedLatency();
    return state.crews.filter((crew) => crew.zoneId === zoneId);
  }, [state.crews]);

  const getCrews = useCallback(async (): Promise<WorkCrew[]> => {
    await simulatedLatency();
    return state.crews;
  }, [state.crews]);

  const getCategories = useCallback(async () => {
    await simulatedLatency();
    return state.categories;
  }, [state.categories]);

  const getZones = useCallback(async () => {
    await simulatedLatency();
    return state.zones;
  }, [state.zones]);

  const createProject = useCallback(async (input: CreateProjectInput): Promise<Project> => {
    await simulatedLatency();
    if (state.projects.some((project) => project.code === input.code)) throw new Error("Project code already exists");
    const project: Project = { ...input, id: crypto.randomUUID() };
    dispatch({ type: "CREATE_PROJECT", project });
    return project;
  }, [dispatch, state.projects]);

  const createUnit = useCallback(async (input: CreateUnitInput): Promise<Unit> => {
    await simulatedLatency();
    const unit: Unit = { ...input, id: crypto.randomUUID() };
    dispatch({ type: "CREATE_UNIT", unit });
    return unit;
  }, [dispatch]);

  const updateUnit = useCallback(async (unitId: string, changes: UpdateUnitInput): Promise<Unit> => {
    await simulatedLatency();
    const existingUnit = state.units.find((unit) => unit.id === unitId);
    if (existingUnit === undefined) {
      throw new Error(`Unit not found: ${unitId}`);
    }

    const unit: Unit = { ...existingUnit, ...changes, id: existingUnit.id };
    dispatch({ type: "UPDATE_UNIT", unitId, changes });
    return unit;
  }, [dispatch, state.units]);

  const createCrew = useCallback(async (input: CreateCrewInput): Promise<WorkCrew> => {
    await simulatedLatency();
    const crew: WorkCrew = { ...input, id: crypto.randomUUID() };
    dispatch({ type: "CREATE_CREW", crew });
    return crew;
  }, [dispatch]);

  const createUser = useCallback(async (input: CreateUserInput): Promise<User> => {
    await simulatedLatency();
    const user: User = { ...input, id: crypto.randomUUID() };
    dispatch({ type: "CREATE_USER", user });
    if (isSupabaseDataSourceEnabled()) {
      await saveUserToSupabase(user);
    }
    return user;
  }, [dispatch]);

  const updateUser = useCallback(async (userId: string, changes: UpdateUserInput): Promise<User> => {
    await simulatedLatency();
    const existingUser = state.users.find((user) => user.id === userId);
    if (existingUser === undefined) {
      throw new Error(`User not found: ${userId}`);
    }

    const user: User = { ...existingUser, ...changes, id: existingUser.id };
    dispatch({ type: "UPDATE_USER", userId, changes });
    if (isSupabaseDataSourceEnabled()) {
      await saveUserToSupabase(user);
    }
    return user;
  }, [dispatch, state.users]);

  return useMemo(() => ({
    getTickets,
    getTicket,
    getTicketsForUser,
    getTicketsByZones,
    getTicketHistory,
    getStatusHistory,
    createTicket,
    transitionTicket,
    markSpecialCase,
    scheduleVisit,
    importDocument,
    getUnitsForUser,
    getUnits,
    getUnitResponsibles,
    createResponsible,
    updateResponsible,
    deleteResponsible,
    getProjects,
    getUsers,
    getCrewsByZone,
    getCrews,
    getCategories,
    getZones,
    createProject,
    createUnit,
    updateUnit,
    createCrew,
    createUser,
    updateUser,
  }), [
    createCrew,
    createProject,
    createTicket,
    createUnit,
    updateUnit,
    createUser,
    getCategories,
    getCrews,
    getCrewsByZone,
    getProjects,
    getStatusHistory,
    getTicket,
    getTicketHistory,
    getTickets,
    getTicketsForUser,
    getTicketsByZones,
    getUnits,
    getUnitsForUser,
    getUnitResponsibles,
    createResponsible,
    updateResponsible,
    deleteResponsible,
    getUsers,
    getZones,
    transitionTicket,
    markSpecialCase,
    scheduleVisit,
    importDocument,
    updateUser,
  ]);
}
