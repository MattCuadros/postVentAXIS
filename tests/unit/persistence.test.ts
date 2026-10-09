import { describe, expect, it } from "vitest";
import { loadState } from "@/data/persistence";
import { createSeedState } from "@/data/store";

function stored(version: number, state: unknown): string {
  return JSON.stringify({ version, savedAt: "2026-09-25T00:00:00Z", state });
}

describe("loadState", () => {
  it("migra un estado v6 guardado antes de los responsables por unidad", () => {
    const { unitResponsibles: _omitted, ...legacy } = createSeedState();
    void _omitted;
    const legacyState = {
      ...legacy,
      statusHistory: legacy.statusHistory.map((entry) => {
        const old: Partial<typeof entry> = { ...entry };
        delete old.actorCapacity;
        return old;
      }),
    };

    const state = loadState(stored(6, legacyState));

    expect(state?.unitResponsibles).toEqual([]);
    expect(state?.statusHistory.every((entry) => entry.actorCapacity === null)).toBe(true);
    expect(state?.units).toHaveLength(legacy.units.length);
  });

  it("conserva los responsables de un estado v7", () => {
    const seed = createSeedState();
    const restored = loadState(stored(7, seed));
    expect(restored?.unitResponsibles).toEqual(seed.unitResponsibles);
    expect(restored?.tickets.every((ticket) => ticket.status !== "ASIGNADO" || seed.statusHistory.some((entry) => entry.ticketId === ticket.id && entry.to === "VISITA_INSPECTIVA"))).toBe(true);
  });

  it("migra a revisión los asignados sin visita y conserva cuadrilla e historial", () => {
    const seed = createSeedState();
    const ticket = { ...seed.tickets[0], status: "ASIGNADO" as const, crewId: "crew-1" };
    const history = seed.statusHistory.filter((entry) => entry.ticketId !== ticket.id);
    const state = { ...seed, tickets: [ticket, ...seed.tickets.slice(1)], statusHistory: history };

    const restored = loadState(stored(7, state));
    expect(restored?.tickets[0]).toMatchObject({ status: "EN_REVISION", crewId: "crew-1" });
    expect(restored?.statusHistory).toEqual(history);
  });

  it("mantiene asignado un ticket con visita registrada", () => {
    const seed = createSeedState();
    const ticket = { ...seed.tickets[0], status: "ASIGNADO" as const };
    const history = [...seed.statusHistory, {
      id: "visit-migration", ticketId: ticket.id, from: "EN_REVISION" as const, to: "VISITA_INSPECTIVA" as const,
      changedById: "u-enc-centro", comment: "Visita registrada", actorCapacity: null, createdAt: ticket.updatedAt,
    }];
    const restored = loadState(stored(7, { ...seed, tickets: [ticket, ...seed.tickets.slice(1)], statusHistory: history }));
    expect(restored?.tickets[0].status).toBe("ASIGNADO");
  });

  it("migra v8 a v9 según las unidades, incluidos proyectos vacíos", () => {
    const seed = createSeedState();
    const { projects, units, ...rest } = seed;
    const oldProjects = projects.map((project) => {
      const legacy = { ...project } as Partial<typeof project>;
      delete legacy.type;
      return legacy;
    });
    const legacyProjects = oldProjects.map((project) => ({ ...project }));
    const legacyUnits = units.filter((unit) => unit.projectId === "p-altobulnes").map((unit) => ({ ...unit }));
    legacyProjects.push({ ...oldProjects[0], id: "p-empty" });
    const state = loadState(stored(8, { ...rest, projects: legacyProjects, units: legacyUnits }));
    expect(state?.projects.find((project) => project.id === "p-altobulnes")?.type).toBe("HABITACIONAL_EXTENSION");
    expect(state?.projects.find((project) => project.id === "p-empty")?.type).toBe("HABITACIONAL_ALTURA");
  });

  it("migra a habitacional altura cuando hay departamentos", () => {
    const seed = createSeedState();
    const state = loadState(stored(8, {
      ...seed,
      projects: seed.projects.map((project) => {
        const old = { ...project } as Partial<typeof project>;
        delete old.type;
        return old;
      }),
      units: seed.units.filter((unit) => unit.projectId === "p-mirador"),
    }));
    expect(state?.projects.find((project) => project.id === "p-mirador")?.type).toBe("HABITACIONAL_ALTURA");
  });

  it("migra v9 a v10 conservando entrega e iniciando las nuevas fechas pendientes", () => {
    const seed = createSeedState();
    const oldUnits = seed.units.map((unit) => {
      const legacy: Record<string, unknown> = { ...unit };
      delete legacy.provisionalDeliveryDate;
      delete legacy.municipalReceptionDate;
      return legacy;
    });
    const state = loadState(stored(9, { ...seed, units: oldUnits }));
    expect(state?.units[0]).toMatchObject({ provisionalDeliveryDate: null, municipalReceptionDate: null, deliveryDate: seed.units[0].deliveryDate });
  });
});
