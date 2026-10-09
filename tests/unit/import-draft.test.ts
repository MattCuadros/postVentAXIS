import { describe, expect, it } from "vitest";
import { draftErrors, ownerDefaults, type DraftSources, type ImportDraft } from "@/components/tickets/import-draft";
import { emptyRequirement } from "@/lib/document-import/types";

const owner = { id: "owner-1", name: "Dueño", email: "owner@example.cl", phone: "+56912345678", role: "PROPIETARIO" as const, zoneIds: [], projectIds: [], active: true };
const project = { id: "project-1", name: "Obra", code: "OB", type: "HABITACIONAL_EXTENSION" as const, zoneId: "zone-1", address: "", commune: "", location: { lat: 0, lng: 0 } };
const unitWithOwner = { id: "unit-1", projectId: project.id, type: "CASA" as const, tower: null, floor: null, number: "1", ownerId: owner.id, provisionalDeliveryDate: null, municipalReceptionDate: null, deliveryDate: "2026-01-01" };
const base: DraftSources = { projects: [project], units: [unitWithOwner], users: [owner], categories: [{ id: "cat", name: "Sanitarias" }], tickets: [] };

function draft(overrides: Partial<ImportDraft>): ImportDraft {
  return {
    key: "draft", include: true, parsed: emptyRequirement(), projectId: project.id, unitMode: "existing", unitId: unitWithOwner.id,
    newUnit: { type: "CASA", tower: "", number: "" }, ownerMode: "new", ownerId: "",
    newOwner: { name: "", email: "", phone: "" }, categoryId: "cat", room: "Baño", description: "Falla suficientemente larga",
    linkedTicketId: null, ...overrides,
  };
}

describe("draftErrors propietario visible", () => {
  it("ignora un ownerMode new incompleto cuando la unidad seleccionada ya tiene propietario", () => {
    expect(draftErrors(draft({}), base)).not.toHaveProperty("owner");
  });

  it("requiere teléfono al crear propietario para unidad existente sin propietario", () => {
    const emptyUnit = { ...unitWithOwner, id: "unit-empty", ownerId: null };
    expect(draftErrors(draft({ unitId: emptyUnit.id, ownerMode: "new", newOwner: { name: "Nuevo", email: "nuevo@example.cl", phone: "" } }), { ...base, units: [emptyUnit] })).toHaveProperty("owner", "Indica el teléfono del propietario.");
  });

  it("permite crear una unidad nueva sin crear propietario", () => {
    expect(draftErrors(draft({ unitMode: "new", unitId: "", newUnit: { type: "CASA", tower: "", number: "2" }, ownerMode: "none" }), base)).not.toHaveProperty("owner");
  });
});

describe("ownerDefaults", () => {
  it("usa el propietario de la unidad existente", () => expect(ownerDefaults(unitWithOwner, emptyRequirement(), base)).toEqual({ ownerMode: "existing", ownerId: owner.id }));
  it("deja sin asignar una unidad existente sin propietario", () => expect(ownerDefaults({ ...unitWithOwner, ownerId: null }, emptyRequirement(), base)).toEqual({ ownerMode: "none", ownerId: "" }));
  it("usa datos completos detectados para una unidad nueva, y deja none si son incompletos", () => {
    const parsed = { ...emptyRequirement(), ownerName: "Nuevo", ownerEmail: "nuevo@example.cl", ownerPhone: "+56912345678" };
    expect(ownerDefaults(undefined, parsed, base)).toEqual({ ownerMode: "new", ownerId: "" });
    expect(ownerDefaults(undefined, emptyRequirement(), base)).toEqual({ ownerMode: "none", ownerId: "" });
  });
});
