import { describe, expect, it } from "vitest";
import {
  actorCapacityFor,
  canManageResponsibles,
  canSignForUnit,
  capacityOf,
  hasAccessToUnit,
  someoneCanSign,
  unitsForUser,
} from "@/lib/unit-access";
import type { Project, Unit, UnitResponsible, User } from "@/types/domain";

const titular: User = { id: "u-titular", name: "Titular", email: "titular@correo.cl", phone: "+56 9 1111 1111", role: "PROPIETARIO", zoneIds: [], projectIds: [], active: true };
const hijo: User = { id: "u-hijo", name: "Hijo", email: "hijo@correo.cl", phone: "+56 9 2222 2222", role: "PROPIETARIO", zoneIds: [], projectIds: [], active: true };
const comite: User = { id: "u-comite", name: "Comité", email: "comite@correo.cl", phone: "+56 9 3333 3333", role: "PROPIETARIO", zoneIds: [], projectIds: [], active: true };
const stranger: User = { id: "u-stranger", name: "Nadie", email: "nadie@correo.cl", phone: "+56 9 4444 4444", role: "PROPIETARIO", zoneIds: [], projectIds: [], active: true };

const encargadoCentro: User = { id: "u-enc", name: "Encargado", email: "enc@demo.cl", phone: "+56 9 5555 5555", role: "ENCARGADO", zoneIds: ["z-centro"], projectIds: [], active: true };
const encargadoOtraZona: User = { id: "u-enc-2", name: "Otro encargado", email: "enc2@demo.cl", phone: "+56 9 6666 6666", role: "ENCARGADO", zoneIds: ["z-sur"], projectIds: [], active: true };
const admin: User = { id: "u-admin", name: "Admin", email: "admin@demo.cl", phone: "+56 9 7777 7777", role: "ADMIN", zoneIds: [], projectIds: [], active: true };

const unitWithOwner: Unit = { id: "un-1", projectId: "p-1", type: "DEPARTAMENTO", tower: "A", floor: 7, number: "704", ownerId: titular.id, deliveryDate: "2026-01-01" };
const unitNoOwner: Unit = { id: "un-2", projectId: "p-2", type: "CASA", tower: null, floor: null, number: "12", ownerId: null, deliveryDate: "2026-01-01" };

const project: Project = { id: "p-1", name: "Obra Uno", code: "UNO", type: "HABITACIONAL_EXTENSION", zoneId: "z-centro", address: "", commune: "", location: { lat: 0, lng: 0 } };

const responsibles: UnitResponsible[] = [
  { id: "ur-1", unitId: "un-1", userId: hijo.id, relation: "FAMILIAR", relationNote: "hijo", canSignConformity: true, createdAt: "2026-01-01T00:00:00Z", createdById: encargadoCentro.id },
  { id: "ur-2", unitId: "un-1", userId: comite.id, relation: "ADMIN_COMITE", relationNote: null, canSignConformity: false, createdAt: "2026-01-01T00:00:00Z", createdById: encargadoCentro.id },
];

describe("unitsForUser", () => {
  it("incluye las unidades donde es titular y donde es responsable", () => {
    const units = [unitWithOwner, unitNoOwner];
    expect(unitsForUser(titular, units, responsibles).map((u) => u.id)).toEqual(["un-1"]);
    expect(unitsForUser(hijo, units, responsibles).map((u) => u.id)).toEqual(["un-1"]);
    expect(unitsForUser(stranger, units, responsibles)).toEqual([]);
  });
});

describe("hasAccessToUnit / canSignForUnit", () => {
  it("el titular siempre tiene acceso y puede firmar", () => {
    expect(hasAccessToUnit(titular, unitWithOwner, responsibles)).toBe(true);
    expect(canSignForUnit(titular, unitWithOwner, responsibles)).toBe(true);
  });

  it("el hijo (responsable con permiso) tiene acceso y puede firmar", () => {
    expect(hasAccessToUnit(hijo, unitWithOwner, responsibles)).toBe(true);
    expect(canSignForUnit(hijo, unitWithOwner, responsibles)).toBe(true);
  });

  it("el comité (responsable sin permiso) tiene acceso pero no puede firmar", () => {
    expect(hasAccessToUnit(comite, unitWithOwner, responsibles)).toBe(true);
    expect(canSignForUnit(comite, unitWithOwner, responsibles)).toBe(false);
  });

  it("un desconocido no tiene acceso ni puede firmar", () => {
    expect(hasAccessToUnit(stranger, unitWithOwner, responsibles)).toBe(false);
    expect(canSignForUnit(stranger, unitWithOwner, responsibles)).toBe(false);
  });
});

describe("someoneCanSign", () => {
  it("true si hay titular", () => {
    expect(someoneCanSign(unitWithOwner, responsibles)).toBe(true);
  });

  it("sin titular pero con un responsable con permiso: true", () => {
    const unit = { ...unitNoOwner, id: "un-3" };
    const withSigner: UnitResponsible[] = [{ id: "ur-3", unitId: unit.id, userId: hijo.id, relation: "FAMILIAR", relationNote: "hijo", canSignConformity: true, createdAt: "2026-01-01T00:00:00Z", createdById: "u-enc" }];
    expect(someoneCanSign(unit, withSigner)).toBe(true);
  });

  it("sin titular y sin nadie que firme: false", () => {
    expect(someoneCanSign(unitNoOwner, [])).toBe(false);
  });
});

describe("capacityOf / actorCapacityFor", () => {
  it("Titular para el titular; Familiar (nota) y Administrador del comité para responsables", () => {
    expect(capacityOf(titular, unitWithOwner, responsibles)).toBe("Titular");
    expect(capacityOf(hijo, unitWithOwner, responsibles)).toBe("Familiar (hijo)");
    expect(capacityOf(comite, unitWithOwner, responsibles)).toBe("Administrador del comité");
  });

  it("actorCapacityFor es null para quien no es propietario ni tiene acceso", () => {
    expect(actorCapacityFor(encargadoCentro, unitWithOwner, responsibles)).toBeNull();
    expect(actorCapacityFor(stranger, unitWithOwner, responsibles)).toBeNull();
    expect(actorCapacityFor(hijo, unitWithOwner, responsibles)).toBe("Familiar (hijo)");
  });
});

describe("canManageResponsibles", () => {
  it("el superadministrador siempre puede", () => {
    expect(canManageResponsibles(admin, unitWithOwner, [project])).toBe(true);
  });

  it("el encargado de la zona de la unidad puede", () => {
    expect(canManageResponsibles(encargadoCentro, unitWithOwner, [project])).toBe(true);
  });

  it("un encargado de otra zona no puede", () => {
    expect(canManageResponsibles(encargadoOtraZona, unitWithOwner, [project])).toBe(false);
  });

  it("el propietario no puede", () => {
    expect(canManageResponsibles(titular, unitWithOwner, [project])).toBe(false);
  });
});
