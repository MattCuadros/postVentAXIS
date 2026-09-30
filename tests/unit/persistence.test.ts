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
});
