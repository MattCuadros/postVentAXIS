"use client";

import { useCallback, useMemo } from "react";
import { applyTransition } from "@/data/store";
import { useDataContext } from "@/data/store-context";
import { delay } from "@/lib/delay";
import { nextFolio } from "@/lib/folio";
import type {
  Project,
  Ticket,
  TicketChanges,
  TicketStatus,
  TicketStatusHistory,
  Unit,
  User,
  WorkCrew,
} from "@/types/domain";

export type CreateTicketInput = Omit<Ticket, "id" | "folio" | "status" | "createdAt" | "updatedAt" | "reportedCategoryId" | "specialCase">;
export type CreateProjectInput = Omit<Project, "id">;
export type CreateUnitInput = Omit<Unit, "id">;
export type CreateCrewInput = Omit<WorkCrew, "id">;
export type CreateUserInput = Omit<User, "id">;
export type UpdateUserInput = Partial<Omit<User, "id">>;

function simulatedLatency(): Promise<void> {
  return delay(150 + Math.floor(Math.random() * 151));
}

export function useDataApi() {
  const { state, dispatch } = useDataContext();

  const getTickets = useCallback(async (): Promise<Ticket[]> => {
    await simulatedLatency();
    return state.tickets;
  }, [state.tickets]);

  const getTicket = useCallback(async (id: string): Promise<Ticket | undefined> => {
    await simulatedLatency();
    return state.tickets.find((ticket) => ticket.id === id);
  }, [state.tickets]);

  const getTicketsByOwner = useCallback(async (ownerId: string): Promise<Ticket[]> => {
    await simulatedLatency();
    const unitIds = new Set(state.units.filter((unit) => unit.ownerId === ownerId).map((unit) => unit.id));
    return state.tickets
      .filter((ticket) => unitIds.has(ticket.unitId))
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.tickets, state.units]);

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
      status: "INGRESADO",
      createdAt: now,
      updatedAt: now,
    };

    dispatch({ type: "CREATE_TICKET", ticket, historyId: crypto.randomUUID() });
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

  const getUnitsByOwner = useCallback(async (ownerId: string): Promise<Unit[]> => {
    await simulatedLatency();
    return state.units.filter((unit) => unit.ownerId === ownerId);
  }, [state.units]);

  const getUnits = useCallback(async (): Promise<Unit[]> => {
    await simulatedLatency();
    return state.units;
  }, [state.units]);

  const getProjects = useCallback(async (): Promise<Project[]> => {
    await simulatedLatency();
    return state.projects;
  }, [state.projects]);

  const getUsers = useCallback(async (): Promise<User[]> => {
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
    return user;
  }, [dispatch, state.users]);

  return useMemo(() => ({
    getTickets,
    getTicket,
    getTicketsByOwner,
    getTicketsByZones,
    getTicketHistory,
    getStatusHistory,
    createTicket,
    transitionTicket,
    markSpecialCase,
    getUnitsByOwner,
    getUnits,
    getProjects,
    getUsers,
    getCrewsByZone,
    getCrews,
    getCategories,
    getZones,
    createProject,
    createUnit,
    createCrew,
    createUser,
    updateUser,
  }), [
    createCrew,
    createProject,
    createTicket,
    createUnit,
    createUser,
    getCategories,
    getCrews,
    getCrewsByZone,
    getProjects,
    getStatusHistory,
    getTicket,
    getTicketHistory,
    getTickets,
    getTicketsByOwner,
    getTicketsByZones,
    getUnits,
    getUnitsByOwner,
    getUsers,
    getZones,
    transitionTicket,
    markSpecialCase,
    updateUser,
  ]);
}
