import { describe, expect, it } from "vitest";
import { canTransition, MAIN_FLOW, TRANSITIONS } from "@/lib/ticket-status";

describe("ticket status flow", () => {
  it("ordena la visita inspectiva antes de asignar el equipo", () => {
    expect(MAIN_FLOW).toEqual([
      "INGRESADO",
      "EN_REVISION",
      "VISITA_INSPECTIVA",
      "ASIGNADO",
      "PROGRAMADO",
      "EN_EJECUCION",
      "EN_RECEPCION",
      "CERRADO",
    ]);
  });

  it("permite registrar la visita, asignar el equipo y programar el trabajo en orden", () => {
    expect(canTransition("EN_REVISION", "VISITA_INSPECTIVA", "ENCARGADO")).toBe(true);
    expect(canTransition("VISITA_INSPECTIVA", "ASIGNADO", "ENCARGADO")).toBe(true);
    expect(canTransition("ASIGNADO", "PROGRAMADO", "ENCARGADO")).toBe(true);
    expect(canTransition("EN_REVISION", "NO_PROCEDE", "ENCARGADO")).toBe(true);
    expect(canTransition("VISITA_INSPECTIVA", "NO_PROCEDE", "ENCARGADO")).toBe(true);
  });

  it("no permite asignar antes de la visita ni registrar visita después de asignar", () => {
    expect(canTransition("EN_REVISION", "ASIGNADO", "ENCARGADO")).toBe(false);
    expect(canTransition("ASIGNADO", "VISITA_INSPECTIVA", "ENCARGADO")).toBe(false);
    expect(TRANSITIONS.ASIGNADO).toHaveLength(1);
    expect(TRANSITIONS.ASIGNADO[0].to).toBe("PROGRAMADO");
  });
});