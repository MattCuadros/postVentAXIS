import { z } from "zod";
import { unitLabel } from "@/lib/format";
import { fieldErrors, unitSchema } from "@/lib/schemas";
import { normalize, parseSheetDate, pick, type SheetRow } from "@/lib/sheet";
import type { Unit, UnitType, User } from "@/types/domain";
import { allowedUnitTypes, PROJECT_TYPE_LABEL, UNIT_TYPE_LABEL } from "@/lib/project-types";
import type { ProjectType } from "@/types/domain";

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
  ["Departamento", "A", "1", "103", "15-10-2026", "", "", ""],
];

export function unitTemplateHeadersForRole(personLabel: string): string[] {
  return UNIT_TEMPLATE_HEADERS.map((header) => header.replace("propietario", personLabel.toLocaleLowerCase("es")));
}

export function unitTemplateExampleForProject(projectType: ProjectType): string[][] {
  const examples: Record<UnitType, string[]> = {
    CASA: ["Casa", "", "", "12", "15-10-2026", "", "", ""],
    DEPARTAMENTO: ["Departamento", "A", "1", "101", "15-10-2026", "", "", ""],
    LOCAL: ["Local", "", "", "3", "15-10-2026", "", "", ""],
    OFICINA: ["Oficina", "B", "12", "1203", "15-10-2026", "", "", ""],
    RECINTO: ["Recinto", "", "", "Pabellón Norte", "15-10-2026", "", "", ""],
    SECTOR: ["Sector", "", "", "Tramo 2", "15-10-2026", "", "", ""],
  };
  return allowedUnitTypes(projectType).map((type) => examples[type]);
}

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
  /** La unidad a crear; null si la fila no crea una unidad (asigna propietario a una existente, o tiene errores). */
  unit: Omit<Unit, "id" | "projectId" | "ownerId"> | null;
  /** Propietario existente, uno por crear, sin propietario (válido igual), o null si la fila tiene error. */
  owner: { id: string } | { create: NewOwner } | { none: true } | null;
  /** Id de la unidad ya existente en la obra a la que se le asignará este propietario (sin crear una unidad nueva). */
  assignToUnitId: string | null;
  /** Avisos que no bloquean la importación (dato faltante, no equivocado). */
  warnings: string[];
  errors: string[];
}

function parseType(text: string): UnitType | null {
  const value = normalize(text);
  if (value.startsWith("dep") || value.startsWith("dpto") || value === "dto") return "DEPARTAMENTO";
  if (value.startsWith("casa")) return "CASA";
  if (value.startsWith("local")) return "LOCAL";
  if (value.startsWith("oficina") || value.startsWith("of." ) || value === "of") return "OFICINA";
  if (value.startsWith("recinto")) return "RECINTO";
  if (value.startsWith("sector")) return "SECTOR";
  return null;
}

/** Clave para detectar unidades repetidas dentro de la obra. */
function unitKey(type: UnitType, tower: string | null, number: string): string {
  return `${type}|${normalize(tower ?? "")}|${normalize(number)}`;
}

const newOwnerSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
});

type OwnerOutcome =
  | { kind: "existing"; id: string; label: string }
  | { kind: "create"; owner: NewOwner; label: string }
  | { kind: "none"; warning: string | null }
  | { kind: "error"; message: string };

/**
 * Resuelve el propietario de una fila. Dato faltante (sin correo) no bloquea: la unidad se
 * importa sin propietario, con un aviso si además faltó nombre o teléfono. Dato equivocado
 * (correo inválido, o de alguien que no es propietario) sí bloquea.
 */
function resolveOwner(
  email: string,
  name: string,
  phone: string,
  users: User[],
  newOwners: Map<string, NewOwner>,
  person: string,
): OwnerOutcome {
  if (!email) {
    return { kind: "none", warning: name || phone ? `Falta el correo: no se creó el ${person}.` : null };
  }
  if (!z.string().email().safeParse(email).success) {
    return { kind: "error", message: `Correo "${email}" no válido.` };
  }

  const existing = users.find((user) => user.email.toLowerCase() === email);
  if (existing) {
    if (existing.role !== "PROPIETARIO") return { kind: "error", message: `${email} pertenece a un usuario que no es ${person}.` };
    return { kind: "existing", id: existing.id, label: existing.name };
  }

  const pending = newOwners.get(email);
  if (pending) return { kind: "create", owner: pending, label: `${pending.name} (nuevo)` };

  const ownerCheck = newOwnerSchema.safeParse({ name, phone });
  if (ownerCheck.success) {
    const created = { name: ownerCheck.data.name, email, phone: ownerCheck.data.phone };
    newOwners.set(email, created);
    return { kind: "create", owner: created, label: `${created.name} (nuevo)` };
  }
  const missing = !name.trim() && !phone.trim() ? "nombre y teléfono" : !name.trim() ? "el nombre" : "el teléfono";
  return { kind: "none", warning: `Falta ${missing} del ${person} nuevo (${email}): no se creó.` };
}

/**
 * Valida las filas del CSV de unidades de una obra. El propietario es opcional: una fila sin
 * datos de propietario se importa igual (la unidad queda sin propietario, para completarlo
 * después). Si la fila corresponde a una unidad existente sin propietario y trae uno válido, se
 * asigna en vez de rechazar la fila con "ya existe".
 */
export function validateUnitImport(rows: SheetRow[], existingUnits: Unit[], users: User[], projectType: ProjectType = "HABITACIONAL_ALTURA", personLabel = "Propietario"): UnitImportRow[] {
  const allowed = allowedUnitTypes(projectType);
  const person = personLabel.toLocaleLowerCase("es");
  const takenUnits = new Map(existingUnits.map((unit) => [unitKey(unit.type, unit.tower, unit.number), unit]));
  const seenUnits = new Set<string>();
  const newOwners = new Map<string, NewOwner>();

  return rows
    .map((row, index) => ({ row, line: index + 2 }))
    .filter(({ row }) => UNIT_TEMPLATE_HEADERS.some((header) => pick(row, header) !== ""))
    .map(({ row, line }) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const typeText = pick(row, "Tipo");
      const detectedType = parseType(typeText);
      const type = detectedType ?? (!typeText && allowed.length === 1 ? allowed[0] : null);
      const tower = pick(row, "Torre");
      const floor = pick(row, "Piso");
      const number = pick(row, "Número");
      const dateText = pick(row, "Fecha entrega");
      const deliveryDate = parseSheetDate(dateText);
      const email = (pick(row, `Correo ${person}`) || pick(row, "Correo propietario")).toLowerCase();
      const ownerName = pick(row, `Nombre ${person}`) || pick(row, "Nombre propietario");
      const ownerPhone = pick(row, `Teléfono ${person}`) || pick(row, "Teléfono propietario");

      if (type === null) errors.push(typeText ? `Tipo "${typeText}" no válido.` : "Falta el tipo de unidad.");
      else if (!allowed.includes(type)) errors.push(`La obra (${PROJECT_TYPE_LABEL[projectType]}) no admite unidades de tipo ${UNIT_TYPE_LABEL[type]}.`);
      if (dateText && deliveryDate === null) errors.push(`Fecha "${dateText}" no válida: usa DD-MM-AAAA.`);

      const parsed = unitSchema.safeParse({
        type: type ?? "DEPARTAMENTO",
        tower: type === "DEPARTAMENTO" || type === "OFICINA" ? tower : "",
        floor: type === "DEPARTAMENTO" || type === "OFICINA" || type === "LOCAL" ? floor : "",
        number,
        ownerId: "",
        deliveryDate: deliveryDate ?? (dateText ? "invalida" : ""),
      });
      if (!parsed.success) {
        for (const [field, message] of Object.entries(fieldErrors(parsed.error))) {
          if (field !== "deliveryDate" || !dateText) errors.push(message);
        }
      }

      const unitFields =
        type === null || deliveryDate === null || !number
          ? null
          : {
              type,
              tower: type !== "DEPARTAMENTO" && type !== "OFICINA" || tower === "" ? null : tower,
              floor: type !== "DEPARTAMENTO" && type !== "OFICINA" && type !== "LOCAL" || floor === "" || !/^-?\d+$/.test(floor) ? null : Number(floor),
              number,
              deliveryDate,
            };

      const ownerOutcome = resolveOwner(email, ownerName, ownerPhone, users, newOwners, person);
      if (ownerOutcome.kind === "error") errors.push(ownerOutcome.message);
      else if (ownerOutcome.kind === "none" && ownerOutcome.warning) warnings.push(ownerOutcome.warning);

      let unit = unitFields;
      let assignToUnitId: string | null = null;
      if (unitFields) {
        const key = unitKey(unitFields.type, unitFields.tower, unitFields.number);
        const takenUnit = takenUnits.get(key);
        if (seenUnits.has(key)) {
          errors.push("Unidad repetida en el archivo.");
        } else if (takenUnit) {
          if (takenUnit.ownerId !== null) {
            errors.push("Esta unidad ya existe en la obra.");
          } else if (ownerOutcome.kind === "existing" || ownerOutcome.kind === "create") {
            unit = null;
            assignToUnitId = takenUnit.id;
          } else {
            errors.push(`Esta unidad ya existe en la obra, y sin ${person} en esta fila no hay nada que asignar.`);
          }
        }
        seenUnits.add(key);
      }

      const owner: UnitImportRow["owner"] =
        ownerOutcome.kind === "existing" ? { id: ownerOutcome.id }
        : ownerOutcome.kind === "create" ? { create: ownerOutcome.owner }
        : ownerOutcome.kind === "none" ? { none: true }
        : null;
      const rowOwnerLabel = ownerOutcome.kind === "error" ? (email || "—") : ownerOutcome.kind === "none" ? `Sin ${person}` : ownerOutcome.label;

      const label = unitFields ? unitLabel({ ...unitFields, id: "", projectId: "", ownerId: null }) : [typeText, tower, number].filter(Boolean).join(" ") || "—";

      if (errors.length > 0) return { line, label, ownerLabel: rowOwnerLabel, unit: null, owner: null, assignToUnitId: null, warnings: [], errors };
      return { line, label, ownerLabel: rowOwnerLabel, unit, owner, assignToUnitId, warnings, errors };
    });
}
