import { describe, expect, it } from "vitest";
import { createSeedState } from "@/data/store";
import { validateUnitImport } from "@/lib/unit-import";
import type { Unit, User } from "@/types/domain";

const HEADERS = ["Tipo", "Torre", "Piso", "Número", "Fecha entrega", "Correo propietario", "Nombre propietario", "Teléfono propietario"] as const;

function row(...values: string[]): Record<string, string> {
  return Object.fromEntries(HEADERS.map((header, index) => [header, values[index] ?? ""]));
}

const state = createSeedState();
const owner = state.users.find((user) => user.role === "PROPIETARIO")!;
const users: User[] = state.users;

describe("validateUnitImport: dato faltante no bloquea, dato equivocado sí", () => {
  it("sin correo, nombre ni teléfono: unidad válida, sin propietario, sin aviso", () => {
    const [result] = validateUnitImport([row("Departamento", "A", "1", "201", "15-10-2026")], [], users);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.owner).toEqual({ none: true });
    expect(result.unit).not.toBeNull();
  });

  it("sin correo pero con nombre: unidad válida, sin propietario, con aviso", () => {
    const [result] = validateUnitImport([row("Departamento", "A", "1", "202", "15-10-2026", "", "Juan Pérez")], [], users);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(["Falta el correo: no se creó el propietario."]);
    expect(result.owner).toEqual({ none: true });
  });

  it("correo válido de un propietario existente: se vincula", () => {
    const [result] = validateUnitImport([row("Departamento", "A", "1", "203", "15-10-2026", owner.email)], [], users);
    expect(result.errors).toEqual([]);
    expect(result.owner).toEqual({ id: owner.id });
  });

  it("correo nuevo con nombre y teléfono: se crea", () => {
    const [result] = validateUnitImport(
      [row("Departamento", "A", "1", "204", "15-10-2026", "nueva@correo.cl", "Nueva Persona", "+56 9 1111 1111")],
      [],
      users,
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.owner).toEqual({ create: { name: "Nueva Persona", email: "nueva@correo.cl", phone: "+56 9 1111 1111" } });
  });

  it("correo nuevo sin teléfono: unidad válida, sin propietario, con aviso (no se creó)", () => {
    const [result] = validateUnitImport(
      [row("Departamento", "A", "1", "205", "15-10-2026", "sinfono@correo.cl", "Alguien")],
      [],
      users,
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(["Falta el teléfono del propietario nuevo (sinfono@correo.cl): no se creó."]);
    expect(result.owner).toEqual({ none: true });
  });

  it("correo mal escrito: error, bloquea la fila", () => {
    const [result] = validateUnitImport([row("Departamento", "A", "1", "206", "15-10-2026", "no-es-correo")], [], users);
    expect(result.errors).toContain('Correo "no-es-correo" no válido.');
    expect(result.unit).toBeNull();
  });

  it("correo de un usuario que no es propietario: error", () => {
    const encargado = state.users.find((user) => user.role === "ENCARGADO")!;
    const [result] = validateUnitImport([row("Departamento", "A", "1", "207", "15-10-2026", encargado.email)], [], users);
    expect(result.errors).toEqual([`${encargado.email} pertenece a un usuario que no es propietario.`]);
  });
});

describe("validateUnitImport: unidades existentes", () => {
  const ownerlessUnit: Unit = { id: "u-existente", projectId: "p-mirador", type: "DEPARTAMENTO", tower: "Z", floor: 9, number: "901", ownerId: null, deliveryDate: "2026-01-01" };
  const ownedUnit: Unit = { id: "u-con-dueno", projectId: "p-mirador", type: "DEPARTAMENTO", tower: "Z", floor: 9, number: "902", ownerId: owner.id, deliveryDate: "2026-01-01" };

  it("unidad existente sin propietario + correo válido: asigna en vez de rechazar", () => {
    const [result] = validateUnitImport([row("Departamento", "Z", "9", "901", "15-10-2026", owner.email)], [ownerlessUnit, ownedUnit], users);
    expect(result.errors).toEqual([]);
    expect(result.unit).toBeNull();
    expect(result.assignToUnitId).toBe("u-existente");
    expect(result.owner).toEqual({ id: owner.id });
  });

  it("unidad existente sin propietario y fila tampoco trae uno: error (nada que asignar)", () => {
    const [result] = validateUnitImport([row("Departamento", "Z", "9", "901", "15-10-2026")], [ownerlessUnit], users);
    expect(result.errors).toHaveLength(1);
    expect(result.assignToUnitId).toBeNull();
  });

  it("unidad existente CON propietario: siempre error, nunca se sobrescribe en silencio", () => {
    const [result] = validateUnitImport([row("Departamento", "Z", "9", "902", "15-10-2026", owner.email)], [ownedUnit], users);
    expect(result.errors).toEqual(["Esta unidad ya existe en la obra."]);
    expect(result.assignToUnitId).toBeNull();
  });

  it("unidad repetida dentro del mismo archivo: error en la segunda aparición", () => {
    const rows = [row("Casa", "", "", "50", "15-10-2026"), row("Casa", "", "", "50", "15-10-2026")];
    const [first, second] = validateUnitImport(rows, [], users);
    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual(["Unidad repetida en el archivo."]);
  });

  it("128 unidades con solo 2 propietarios: las 128 se importan, 2 con propietario y 126 sin", () => {
    const rows = Array.from({ length: 128 }, (_, index) => {
      const number = String(index + 1).padStart(3, "0");
      return index < 2
        ? row("Departamento", "X", "1", number, "15-10-2026", `p${index}@correo.cl`, `Persona ${index}`, "+56 9 0000 0000")
        : row("Departamento", "X", "1", number, "15-10-2026");
    });
    const results = validateUnitImport(rows, [], users);
    expect(results).toHaveLength(128);
    expect(results.every((r) => r.errors.length === 0)).toBe(true);
    expect(results.filter((r) => r.owner !== null && !("none" in r.owner))).toHaveLength(2);
    expect(results.filter((r) => r.owner && "none" in r.owner)).toHaveLength(126);
  });
});
