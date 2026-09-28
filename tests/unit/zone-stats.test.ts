import { describe, expect, it } from "vitest";
import { createSeedState } from "@/data/store";
import { computeZoneStats, DEFAULT_FILTERS, statsPeriodStart, type StatsFilters } from "@/lib/zone-stats";

const NOW = new Date(2026, 8, 25, 15, 0); // 25-09-2026 15:00 local

describe("statsPeriodStart", () => {
  it("abre ventanas móviles que incluyen el día de hoy", () => {
    expect(statsPeriodStart("SEMANA", NOW)).toEqual(new Date(2026, 8, 19));
    expect(statsPeriodStart("DOS_SEMANAS", NOW)).toEqual(new Date(2026, 8, 12));
    expect(statsPeriodStart("MES", NOW)).toEqual(new Date(2026, 7, 26));
    expect(statsPeriodStart("TRIMESTRE", NOW)).toEqual(new Date(2026, 5, 26));
    expect(statsPeriodStart("TODO", NOW)).toBeNull();
  });
});

describe("computeZoneStats", () => {
  const state = createSeedState();
  const centro = new Set(state.projects.filter((project) => project.zoneId === "z-centro").map((project) => project.id));
  const centroUnits = new Set(state.units.filter((unit) => centro.has(unit.projectId)).map((unit) => unit.id));
  const sources = {
    tickets: state.tickets.filter((ticket) => centroUnits.has(ticket.unitId)),
    history: state.statusHistory,
    units: state.units,
    projects: state.projects,
    categories: state.categories,
    crews: state.crews,
  };
  const run = (filters: Partial<StatsFilters>) => computeZoneStats({ ...DEFAULT_FILTERS, ...filters }, sources);

  it("con todo el período cuenta todos los requerimientos de la zona", () => {
    const stats = run({ period: "TODO" });
    expect(stats.ingresados).toBe(sources.tickets.length);
    expect(stats.abiertos + stats.cerrados + stats.noProcede).toBe(stats.ingresados);
    expect(stats.byStatus.reduce((sum, row) => sum + row.count, 0)).toBe(stats.ingresados);
    expect(stats.byCategory.reduce((sum, row) => sum + row.count, 0)).toBe(stats.ingresados);
  });

  it("las ventanas más cortas nunca tienen más requerimientos que las largas", () => {
    const counts = (["SEMANA", "DOS_SEMANAS", "MES", "TRIMESTRE", "TODO"] as const).map((period) => run({ period }).ingresados);
    for (let index = 1; index < counts.length; index += 1) expect(counts[index]).toBeGreaterThanOrEqual(counts[index - 1]);
  });

  it("la tendencia por día suma lo mismo que los ingresados de la semana", () => {
    const stats = run({ period: "SEMANA" });
    expect(stats.trend).toHaveLength(7);
    expect(stats.trend.reduce((sum, row) => sum + row.ingresados, 0)).toBe(stats.ingresados);
  });

  it("los filtros acotan el resultado", () => {
    const all = run({ period: "TODO" });
    const open = run({ period: "TODO", status: "ABIERTOS" });
    expect(open.ingresados).toBe(all.abiertos);
    expect(open.rows.every((row) => !["CERRADO", "NO_PROCEDE"].includes(row.ticket.status))).toBe(true);

    const crewId = sources.tickets.find((ticket) => ticket.crewId)?.crewId ?? "";
    const byCrew = run({ period: "TODO", crewId });
    expect(byCrew.rows.every((row) => row.ticket.crewId === crewId)).toBe(true);
    expect(byCrew.ingresados).toBeLessThanOrEqual(all.ingresados);
  });
});
