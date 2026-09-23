"use client";

import { useCallback, useMemo } from "react";
import { useDataContext } from "@/data/store-context";
import { delay } from "@/lib/delay";
import { nextFolio } from "@/lib/folio";
import type {
  Project,
  Ticket,
  TicketStatus,
  Unit,
  User,
  WorkCrew,
} from "@/types/domain";

export type CreateTicketInput = Omit<Ticket, "id" | "folio" | "status" | "createdAt" | "updatedAt">;
export type CreateProjectInput = Omit<Project, "id">;
export type CreateUnitInput = Omit<Unit, "id">;
export type CreateCrewInput = Omit<WorkCrew, "id">;
export type CreateUserInput = Omit<User, "id">;

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

  const createTicket = useCallback(async (input: CreateTicketInput): Promise<Ticket> => {
    await simulatedLatency();
    const now = new Date().toISOString();
    const ticket: Ticket = {
      ...input,
      id: crypto.randomUUID(),
      folio: nextFolio(state.tickets),
      status: "INGRESADO",
      createdAt: now,
      updatedAt: now,
    };

    dispatch({ type: "CREATE_TICKET", ticket });
    return ticket;
  }, [dispatch, state.tickets]);

  const transitionTicket = useCallback(async (
    ticketId: string,
    to: TicketStatus,
    changedById: string,
    comment?: string,
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
      changedAt,
      historyId: crypto.randomUUID(),
    });

    return { ...existingTicket, status: to, updatedAt: changedAt };
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
    const project: Project = { ...input, id: crypto.randomUUID() };
    dispatch({ type: "CREATE_PROJECT", project });
    return project;
  }, [dispatch]);

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

  return useMemo(() => ({
    getTickets,
    getTicket,
    createTicket,
    transitionTicket,
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
    getTicket,
    getTickets,
    getUnits,
    getUnitsByOwner,
    getUsers,
    getZones,
    transitionTicket,
  ]);
}
