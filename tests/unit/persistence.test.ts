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
    expect(loadState(stored(7, seed))?.unitResponsibles).toEqual(seed.unitResponsibles);
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
});
