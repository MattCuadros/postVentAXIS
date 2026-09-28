import { describe, expect, it } from "vitest";
import { createSeedState, reducer } from "@/data/store";
import type { UnitResponsible } from "@/types/domain";

const state = createSeedState();
const unit = state.units.find((item) => item.id === "un-1")!; // Torre A 704, zona Postventa Centro
const encargadoCentro = state.users.find((item) => item.id === "u-enc-centro")!;
const encargadoOtraZona = state.users.find((item) => item.role === "ENCARGADO" && item.id !== encargadoCentro.id)!;
const admin = state.users.find((item) => item.id === "u-admin")!;
const owner = state.users.find((item) => item.id === unit.ownerId)!;

function newResponsible(overrides: Partial<UnitResponsible> = {}): UnitResponsible {
  return {
    id: "ur-test",
    unitId: unit.id,
    userId: "u-prop-2",
    relation: "FAMILIAR",
    relationNote: "hijo",
    canSignConformity: true,
    createdAt: "2026-01-01T00:00:00Z",
    createdById: "u-enc-centro",
    ...overrides,
  };
}

describe("CREATE_RESPONSIBLE: solo superadministrador y encargado de la zona, incluso llamando el reducer directo", () => {
  it("el encargado de la zona de la unidad puede agregar", () => {
    const next = reducer(state, { type: "CREATE_RESPONSIBLE", responsible: newResponsible(), actingUserId: encargadoCentro.id });
    expect(next.unitResponsibles.some((item) => item.id === "ur-test")).toBe(true);
  });

  it("el superadministrador puede agregar", () => {
    const next = reducer(state, { type: "CREATE_RESPONSIBLE", responsible: newResponsible(), actingUserId: admin.id });
    expect(next.unitResponsibles.some((item) => item.id === "ur-test")).toBe(true);
  });

  it("un encargado de otra zona no puede", () => {
    expect(() => reducer(state, { type: "CREATE_RESPONSIBLE", responsible: newResponsible(), actingUserId: encargadoOtraZona.id })).toThrow();
  });

  it("el propietario (titular) no puede, aunque sea su propia unidad", () => {
    expect(() => reducer(state, { type: "CREATE_RESPONSIBLE", responsible: newResponsible(), actingUserId: owner.id })).toThrow();
  });
});

describe("UPDATE_RESPONSIBLE / DELETE_RESPONSIBLE: misma restricción", () => {
  const withResponsible = reducer(state, { type: "CREATE_RESPONSIBLE", responsible: newResponsible(), actingUserId: encargadoCentro.id });

  it("actualizar: rechaza a quien no es superadministrador ni encargado de la zona", () => {
    expect(() =>
      reducer(withResponsible, { type: "UPDATE_RESPONSIBLE", responsibleId: "ur-test", changes: { canSignConformity: false }, actingUserId: encargadoOtraZona.id }),
    ).toThrow();
  });

  it("actualizar: el encargado de la zona sí puede", () => {
    const next = reducer(withResponsible, { type: "UPDATE_RESPONSIBLE", responsibleId: "ur-test", changes: { canSignConformity: false }, actingUserId: encargadoCentro.id });
    expect(next.unitResponsibles.find((item) => item.id === "ur-test")?.canSignConformity).toBe(false);
  });

  it("quitar: rechaza a quien no corresponde, y quita el acceso de inmediato cuando sí corresponde", () => {
    expect(() => reducer(withResponsible, { type: "DELETE_RESPONSIBLE", responsibleId: "ur-test", actingUserId: encargadoOtraZona.id })).toThrow();
    const next = reducer(withResponsible, { type: "DELETE_RESPONSIBLE", responsibleId: "ur-test", actingUserId: encargadoCentro.id });
    expect(next.unitResponsibles.some((item) => item.id === "ur-test")).toBe(false);
  });
});
