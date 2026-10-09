import { z } from "zod";
import { parseCoordinates } from "@/lib/geo";
import { PROJECT_TYPES } from "@/lib/project-types";

/** Esquemas de validación de los formularios de administración (y del importador de usuarios). */

const requiredText = (label: string) => z.string().trim().min(1, `${label} es obligatorio.`);

export const projectSchema = z.object({
  type: z.enum(PROJECT_TYPES, { message: "Elige el tipo de obra." }),
  name: requiredText("El nombre"),
  code: z.string().trim().regex(/^[A-Z]{2,4}$/, "El código debe tener entre 2 y 4 letras mayúsculas."),
  zoneId: z.string().min(1, "Elige la zona."),
  address: requiredText("La dirección"),
  commune: requiredText("La comuna"),
  coordinates: z
    .string()
    .trim()
    .min(1, "La ubicación es obligatoria: la usan los encargados para llegar a la obra.")
    .refine((value) => parseCoordinates(value) !== null, "No reconocemos esas coordenadas. Pega algo como -33.4489, -70.6693."),
});

export const unitSchema = z
  .object({
    type: z.enum(["DEPARTAMENTO", "CASA", "LOCAL", "OFICINA", "RECINTO", "SECTOR"]),
    tower: z.string().trim(),
    floor: z.string().trim(),
    number: requiredText("El número o nombre"),
    /** "" = sin propietario (se puede completar después). */
    ownerId: z.string(),
    provisionalDeliveryDate: z.string().nullable().refine(isIsoDate, "La fecha debe ser válida."),
    municipalReceptionDate: z.string().nullable().refine(isIsoDate, "La fecha debe ser válida."),
    deliveryDate: z.string().nullable().refine(isIsoDate, "La fecha debe ser válida."),
  })
  .superRefine((unit, context) => {
    if ((unit.type === "DEPARTAMENTO" || unit.type === "OFICINA" || unit.type === "LOCAL") && unit.floor !== "" && !/^-?\d+$/.test(unit.floor)) {
      context.addIssue({ code: "custom", path: ["floor"], message: "El piso debe ser un número." });
    }
  });

export function unitDateWarnings(unit: { provisionalDeliveryDate: string | null; municipalReceptionDate: string | null; deliveryDate: string | null }): string[] {
  const warnings: string[] = [];
  if (unit.municipalReceptionDate && unit.provisionalDeliveryDate && unit.municipalReceptionDate < unit.provisionalDeliveryDate) warnings.push("La recepción final municipal es anterior a la recepción provisoria.");
  if (unit.deliveryDate && unit.municipalReceptionDate && unit.deliveryDate < unit.municipalReceptionDate) warnings.push("La entrega es anterior a la recepción final municipal.");
  return warnings;
}

function isIsoDate(value: string | null): boolean {
  if (value === null || value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const ROLE_OPTIONS = ["PROPIETARIO", "ENCARGADO", "ADMIN_OBRA", "ADMIN"] as const;

export const userSchema = z
  .object({
    name: requiredText("El nombre"),
    email: z.string().trim().toLowerCase().email("Correo no válido."),
    phone: requiredText("El teléfono"),
    role: z.enum(ROLE_OPTIONS, { message: "Rol no válido (Propietario, Encargado, Administrador de obra o Superadministrador)." }),
    zoneIds: z.array(z.string()),
    projectIds: z.array(z.string()).default([]),
  })
  .superRefine((user, context) => {
    if (user.role === "ENCARGADO" && user.zoneIds.length === 0) {
      context.addIssue({ code: "custom", path: ["zoneIds"], message: "Un encargado necesita al menos una zona." });
    }
    if (user.role === "ADMIN_OBRA" && user.projectIds.length === 0) {
      context.addIssue({ code: "custom", path: ["projectIds"], message: "Un administrador de obra necesita al menos una obra." });
    }
  });

export const crewSchema = z.object({
  name: requiredText("El nombre"),
  type: z.enum(["INTERNO", "SUBCONTRATO"]),
  contactName: requiredText("El contacto"),
  phone: requiredText("El teléfono"),
  zoneId: z.string().min(1, "Elige la zona."),
  projectIds: z.array(z.string()),
});

/** Primer mensaje de error por campo, para mostrar bajo cada input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    result[key] ??= issue.message;
  }
  return result;
}

/** Formulario de ingreso. La contraseña solo se exige; no se recorta ni se valida su forma aquí. */
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Ingresa tu correo.").email("Escribe un correo válido, por ejemplo nombre@empresa.cl."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});
