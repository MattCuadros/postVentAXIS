import { describe, expect, it } from "vitest";
import { DOCUMENT_PATH, planImport, type ImportRowData } from "@/lib/document-import/plan";

const row: ImportRowData = {
  kind: "OT",
  documentFolio: "OT-123",
  externalRefs: [],
  requestDate: "2026-09-01",
  issuedDate: "2026-09-02",
  visit: { date: "2026-09-04", time: "10:00" },
  execution: [{ date: "2026-09-05", time: "09:00" }],
  repairDate: null,
  responsible: "Equipo interno",
};

describe("document import paths", () => {
  it("registra la visita antes de asignar equipo en OT e informe AXIS", () => {
    expect(DOCUMENT_PATH.OT).toEqual([
      "INGRESADO", "EN_REVISION", "VISITA_INSPECTIVA", "ASIGNADO", "PROGRAMADO",
    ]);
    expect(DOCUMENT_PATH.INFORME_AXIS).toEqual([
      "INGRESADO", "EN_REVISION", "VISITA_INSPECTIVA", "ASIGNADO", "PROGRAMADO",
      "EN_EJECUCION", "EN_RECEPCION", "CERRADO",
    ]);

    const plan = planImport(row, undefined, "2026-09-06");
    expect(plan.steps.map((step) => step.to)).toEqual(DOCUMENT_PATH.OT);
    expect(plan.steps.map((step) => step.at)).toEqual(
      plan.steps.map((step) => step.at).toSorted(),
    );
  });
});