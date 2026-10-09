import { describe, expect, it } from "vitest";
import { allowedUnitTypes, ownerLabel, unitFields } from "@/lib/project-types";

describe("project type rules", () => {
  it("exposes only the approved unit types for each project kind", () => {
    expect(allowedUnitTypes("HABITACIONAL_EXTENSION")).toEqual(["CASA"]);
    expect(allowedUnitTypes("HABITACIONAL_ALTURA")).toEqual(["DEPARTAMENTO", "LOCAL"]);
    expect(allowedUnitTypes("RETAIL")).toEqual(["LOCAL"]);
    expect(allowedUnitTypes("OFICINAS")).toEqual(["OFICINA", "LOCAL"]);
    expect(allowedUnitTypes("INSTITUCIONAL")).toEqual(["RECINTO"]);
    expect(allowedUnitTypes("INDUSTRIAL")).toEqual(["RECINTO"]);
    expect(allowedUnitTypes("URBANIZACION")).toEqual(["SECTOR"]);
  });

  it("defines owner-facing role labels and unit fields", () => {
    expect(ownerLabel("HABITACIONAL_EXTENSION")).toBe("Propietario");
    expect(ownerLabel("HABITACIONAL_ALTURA")).toBe("Propietario");
    for (const type of ["RETAIL", "INSTITUCIONAL", "URBANIZACION", "OFICINAS", "INDUSTRIAL"] as const) {
      expect(ownerLabel(type)).toBe("Administrador");
    }
    expect(unitFields("CASA")).toEqual({ tower: false, floor: false, number: true, freeText: false });
    expect(unitFields("LOCAL")).toEqual({ tower: false, floor: true, number: true, freeText: false });
    expect(unitFields("RECINTO").freeText).toBe(true);
  });
});
