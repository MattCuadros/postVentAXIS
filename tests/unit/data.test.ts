import { describe, expect, it } from "vitest";
import { loadState } from "@/data/persistence";
import { createSeedState } from "@/data/store";
import { nextFolio } from "@/lib/folio";
import { computeProjectInsights, ticketsOfProjects } from "@/lib/project-metrics";
import { availableTransitions, MAIN_FLOW } from "@/lib/ticket-status";

describe("nextFolio", () => {
  it("numera por obra con el sufijo de la zona", () => {
    const state = createSeedState();
    const project = state.projects.find((item) => item.id === "p-mirador")!;
    const zone = state.zones.find((item) => item.id === project.zoneId)!;
    const folio = nextFolio(state.tickets, state.units, project, zone);
    expect(folio).toMatch(new RegExp(`^${project.code}-\\d{4}-${zone.code}$`));
    const used = state.tickets.map((ticket) => ticket.folio);
    expect(used).not.toContain(folio);
  });
});

describe("flujo de visita y asignación", () => {
  it("registra primero la visita y permite asignar equipo después", () => {
    expect(MAIN_FLOW.slice(0, 5)).toEqual(["INGRESADO", "EN_REVISION", "VISITA_INSPECTIVA", "ASIGNADO", "PROGRAMADO"]);
    expect(availableTransitions("EN_REVISION", "ENCARGADO").map((item) => item.to)).toContain("VISITA_INSPECTIVA");
    expect(availableTransitions("VISITA_INSPECTIVA", "ENCARGADO").map((item) => item.to)).toContain("ASIGNADO");
    expect(availableTransitions("ASIGNADO", "ENCARGADO").map((item) => item.to)).toContain("PROGRAMADO");
  });
});

describe("loadState (migraciones)", () => {
  it("lleva datos v4 a la versión actual: zonas Postventa y fotos como media", () => {
    const ticket = {
      id: "t-mig", folio: "OBX-0001-N", unitId: "un-x", categoryId: "c-1", reportedCategoryId: "c-1", room: "Baño",
      description: "Prueba", status: "EN_RECEPCION", createdById: "u-p", encargadoId: "u-e", crewId: null,
      visitDate: null, visitTime: null, scheduledDate: null, scheduledTime: null, rejectionReason: null, externalRefs: [],
      documents: [], specialCase: null, createdAt: "2026-01-01T10:00:00.000Z", updatedAt: "2026-01-05T10:00:00.000Z",
      photos: [
        { id: "a", url: "data:image/png;base64,AA", uploadedById: "u-p", createdAt: "2026-01-01T10:00:00.000Z" },
        { id: "b", url: "data:image/png;base64,AA", uploadedById: "u-e", createdAt: "2026-01-05T10:00:00.000Z" },
      ],
    };
    const raw = JSON.stringify({
      version: 4,
      state: {
        zones: [{ id: "z-norte", name: "Zona Norte", code: "N" }, { id: "z-centro", name: "Zona Centro", code: "C" }],
        categories: [], users: [{ id: "u-e", name: "E", email: "e@demo.cl", phone: "", role: "ENCARGADO", zoneIds: ["z-norte"], active: true }],
        projects: [{ id: "p-x", name: "Obra X", code: "OBX", zoneId: "z-norte" }], units: [], crews: [], tickets: [ticket],
        statusHistory: [{ id: "h", ticketId: "t-mig", from: "EN_EJECUCION", to: "EN_RECEPCION", changedById: "u-e", comment: "", createdAt: "2026-01-05T10:00:00.000Z" }],
      },
    });
    const state = loadState(raw)!;
    expect(state.zones.map((zone) => zone.name)).toEqual(["Postventa Centro", "Postventa Austral"]);
    expect(state.projects[0].zoneId).toBe("z-austral");
    expect(state.users[0]).toMatchObject({ zoneIds: ["z-austral"], projectIds: [] });
    expect(state.tickets[0].media.map((item) => `${item.type}:${item.stage}`)).toEqual(["IMAGE:PROBLEMA", "IMAGE:SOLUCION"]);
    expect("photos" in state.tickets[0]).toBe(false);
  });

  it("descarta datos de una versión futura o corruptos", () => {
    expect(loadState(JSON.stringify({ version: 999, state: {} }))).toBeNull();
    expect(loadState("no es json")).toBeNull();
  });
});

describe("indicadores del administrador de obra", () => {
  it("solo considera los requerimientos de sus obras", () => {
    const state = createSeedState();
    const scoped = ticketsOfProjects(state.tickets, state.units, ["p-mirador"], "TODO");
    const mirador = new Set(state.units.filter((unit) => unit.projectId === "p-mirador").map((unit) => unit.id));
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((ticket) => mirador.has(ticket.unitId))).toBe(true);

    const insights = computeProjectInsights({ tickets: scoped, units: state.units, categories: state.categories, crews: state.crews, history: state.statusHistory });
    expect(insights.total).toBe(scoped.length);
    expect(insights.byCrewType.INTERNO.handled + insights.byCrewType.SUBCONTRATO.handled).toBe(scoped.filter((ticket) => ticket.crewId).length);
  });
});
