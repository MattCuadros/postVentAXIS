import { describe, expect, it } from "vitest";
import { createSeedState } from "@/data/store";
import { isExampleProject, isExampleTicket, isExampleUser, ticketsForStats } from "@/lib/example-data";
import { computeZoneStats, DEFAULT_FILTERS } from "@/lib/zone-stats";
import type { Ticket, Unit } from "@/types/domain";

describe("datos de ejemplo", () => {
  const seed = createSeedState();
  const realUnit: Unit = { ...seed.units[0], id: "un-real", projectId: "p-real" };
  const realTicket: Ticket = { ...seed.tickets[0], id: "t-real", folio: "REA-0001-C", unitId: realUnit.id };
  // Requerimiento nuevo sobre una obra de ejemplo: sigue siendo una prueba.
  const testTicket: Ticket = { ...seed.tickets[0], id: "t-nuevo", unitId: seed.units[0].id };
  const units = [...seed.units, realUnit];

  it("todo lo que viene de la semilla es de ejemplo; lo creado después sobre obras reales, no", () => {
    expect(seed.tickets.every((ticket) => isExampleTicket(ticket, units))).toBe(true);
    expect(seed.projects.every((project) => isExampleProject(project.id))).toBe(true);
    expect(seed.users.every((user) => isExampleUser(user.id))).toBe(true);
    expect(isExampleTicket(testTicket, units)).toBe(true);
    expect(isExampleTicket(realTicket, units)).toBe(false);
    expect(isExampleProject("p-real")).toBe(false);
    expect(isExampleUser("u-nuevo")).toBe(false);
  });

  it("las estadísticas cuentan solo casos reales, salvo que se pida incluir los de ejemplo", () => {
    const all = [...seed.tickets, testTicket, realTicket];
    expect(ticketsForStats(all, units, false).map((ticket) => ticket.id)).toEqual(["t-real"]);
    expect(ticketsForStats(all, units, true)).toHaveLength(all.length);

    const projects = [...seed.projects, { ...seed.projects[0], id: "p-real", name: "Obra real", code: "REA" }];
    const sources = { history: seed.statusHistory, units, projects, categories: seed.categories, crews: seed.crews };
    const stats = computeZoneStats({ ...DEFAULT_FILTERS, period: "TODO" }, { ...sources, tickets: ticketsForStats(all, units, false) });
    expect(stats.ingresados).toBe(1);
    expect(stats.byProject.map((row) => row.label)).toEqual(["Obra real"]);
  });
});
