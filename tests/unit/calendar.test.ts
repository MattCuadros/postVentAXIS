import { describe, expect, it } from "vitest";
import { createSeedState } from "@/data/store";
import { buildAgenda } from "@/lib/calendar";

describe("buildAgenda", () => {
  it("deja pendiente y editable la visita de un ticket En revisión", () => {
    const ticket = createSeedState().tickets.find((item) => item.id === "t-5")!;
    const agenda = buildAgenda([{ ...ticket, status: "EN_REVISION", visitDate: "2026-10-02" }], "2026-10-01");

    expect(agenda[0]).toMatchObject({ kind: "VISITA", done: false, editable: true });
  });

  it("marca la visita como realizada después de salir de En revisión", () => {
    const ticket = createSeedState().tickets.find((item) => item.id === "t-5")!;
    const agenda = buildAgenda([{ ...ticket, status: "VISITA_INSPECTIVA", visitDate: "2026-10-02" }], "2026-10-01");

    expect(agenda[0]).toMatchObject({ kind: "VISITA", done: true, editable: false });
  });
});