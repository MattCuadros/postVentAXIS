import { z } from "zod";
import { unitLabel } from "@/lib/format";
import { fieldErrors, unitSchema } from "@/lib/schemas";
import { normalize, parseSheetDate, pick, type SheetRow } from "@/lib/sheet";
import type { Unit, UnitType, User } from "@/types/domain";

/** Columnas de la plantilla de unidades, en orden. */
export const UNIT_TEMPLATE_HEADERS = [
  "Tipo",
  "Torre",
  "Piso",
  "Número",
  "Fecha entrega",
  "Correo propietario",
  "Nombre propietario",
  "Teléfono propietario",
] as const;

export const UNIT_TEMPLATE_EXAMPLE = [
  ["Departamento", "A", "1", "101", "15-10-2026", "mgonzalez@correo.cl", "María González", "+56 9 1234 5678"],
  ["Departamento", "A", "1", "102", "15-10-2026", "psilva@correo.cl", "Pablo Silva", "+56 9 2345 6789"],
  ["Casa", "", "", "12", "30-11-2026", "mgonzalez@correo.cl", "", ""],
];

export interface NewOwner {
  name: string;
  email: string;
  phone: string;
}

export interface UnitImportRow {
  line: number;
  /** "Torre A 101" / "Casa 12", para la vista previa. */
  label: string;
  ownerLabel: string;
  unit: Omit<Unit, "id" | "projectId" | "ownerId"> | null;
  /** Propietario existente (id) o por crear (datos). */
  owner: { id: string } | { create: NewOwner } | null;
  errors: string[];
}

function parseType(text: string): UnitType | null {
  const value = normalize(text);
  if (value.startsWith("dep") || value.startsWith("dpto") || value === "dto") return "DEPARTAMENTO";
  if (value.startsWith("casa")) return "CASA";
  return null;
}

/** Clave para detectar unidades repetidas dentro de la obra. */
function unitKey(type: UnitType, tower: string | null, number: string): string {
  return `${type}|${normalize(tower ?? "")}|${normalize(number)}`;
}

const newOwnerSchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre del propietario (es nuevo)."),
  phone: z.string().trim().min(1, "Falta el teléfono del propietario (es nuevo)."),
});

/**
 * Valida las filas del CSV de unidades de una obra.
 * El propietario se busca por correo; si no existe, se creará con el nombre y teléfono de la fila
 * (basta con completarlos en la primera fila en que aparece ese correo).
 */
export function validateUnitImport(rows: SheetRow[], existingUnits: Unit[], users: User[]): UnitImportRow[] {
  const takenUnits = new Set(existingUnits.map((unit) => unitKey(unit.type, unit.tower, unit.number)));
  const seenUnits = new Set<string>();
  const newOwners = new Map<string, NewOwner>();

  return rows
    .map((row, index) => ({ row, line: index + 2 }))
    .filter(({ row }) => UNIT_TEMPLATE_HEADERS.some((header) => pick(row, header) !== ""))
    .map(({ row, line }) => {
      const errors: string[] = [];
      const typeText = pick(row, "Tipo");
      const type = parseType(typeText);
      const tower = pick(row, "Torre");
      const floor = pick(row, "Piso");
      const number = pick(row, "Número");
      const dateText = pick(row, "Fecha entrega");
      const deliveryDate = parseSheetDate(dateText);
      const email = pick(row, "Correo propietario").toLowerCase();
      const ownerName = pick(row, "Nombre propietario");
      const ownerPhone = pick(row, "Teléfono propietario");

      if (type === null) errors.push(typeText ? `Tipo "${typeText}" no válido: usa Departamento o Casa.` : "Falta el tipo (Departamento o Casa).");
      if (dateText && deliveryDate === null) errors.push(`Fecha "${dateText}" no válida: usa DD-MM-AAAA.`);

      const parsed = unitSchema.safeParse({
        type: type ?? "DEPARTAMENTO",
        tower: type === "CASA" ? "" : tower,
        floor: type === "CASA" ? "" : floor,
        number,
        ownerId: "pendiente",
        deliveryDate: deliveryDate ?? (dateText ? "invalida" : ""),
      });
      if (!parsed.success) {
        for (const [field, message] of Object.entries(fieldErrors(parsed.error))) {
          if (field !== "deliveryDate" || !dateText) errors.push(message);
        }
      }

      const unit =
        type === null || deliveryDate === null || !number
          ? null
          : {
              type,
              tower: type === "CASA" || tower === "" ? null : tower,
              floor: type === "CASA" || floor === "" || !/^-?\d+$/.test(floor) ? null : Number(floor),
              number,
              deliveryDate,
            };

      if (unit) {
        const key = unitKey(unit.type, unit.tower, unit.number);
        if (takenUnits.has(key)) errors.push("Esta unidad ya existe en la obra.");
        else if (seenUnits.has(key)) errors.push("Unidad repetida en el archivo.");
        seenUnits.add(key);
      }

      let owner: UnitImportRow["owner"] = null;
      let ownerLabel = email || "—";
      if (!z.string().email().safeParse(email).success) {
        errors.push(email ? `Correo "${email}" no válido.` : "Falta el correo del propietario.");
      } else {
        const existing = users.find((user) => user.email.toLowerCase() === email);
        if (existing) {
          if (existing.role !== "PROPIETARIO") errors.push(`${email} pertenece a un usuario que no es propietario.`);
          else owner = { id: existing.id };
          ownerLabel = existing.name;
        } else if (newOwners.has(email)) {
          const pending = newOwners.get(email);
          if (pending) {
            owner = { create: pending };
            ownerLabel = `${pending.name} (nuevo)`;
          }
        } else {
          const ownerCheck = newOwnerSchema.safeParse({ name: ownerName, phone: ownerPhone });
          if (ownerCheck.success) {
            const created = { name: ownerCheck.data.name, email, phone: ownerCheck.data.phone };
            newOwners.set(email, created);
            owner = { create: created };
            ownerLabel = `${created.name} (nuevo)`;
          } else {
            errors.push(...Object.values(fieldErrors(ownerCheck.error)));
          }
        }
      }

      const label = unit ? unitLabel({ ...unit, id: "", projectId: "", ownerId: "" }) : [typeText, tower, number].filter(Boolean).join(" ") || "—";
      return errors.length === 0 ? { line, label, ownerLabel, unit, owner, errors } : { line, label, ownerLabel, unit: null, owner: null, errors };
    });
}
