import { z } from "zod";
import { parseCoordinates } from "@/lib/geo";

/** Esquemas de validación de los formularios de administración (y del importador de usuarios). */

const requiredText = (label: string) => z.string().trim().min(1, `${label} es obligatorio.`);

export const projectSchema = z.object({
  name: requiredText("El nombre"),
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
    type: z.enum(["DEPARTAMENTO", "CASA"]),
    tower: z.string().trim(),
    floor: z.string().trim(),
    number: requiredText("El número"),
    ownerId: z.string().min(1, "Elige el propietario."),
    deliveryDate: z.string().min(1, "Indica la fecha de entrega."),
  })
  .superRefine((unit, context) => {
    if (unit.type === "DEPARTAMENTO" && unit.floor !== "" && !/^-?\d+$/.test(unit.floor)) {
      context.addIssue({ code: "custom", path: ["floor"], message: "El piso debe ser un número." });
    }
  });

export const ROLE_OPTIONS = ["PROPIETARIO", "ENCARGADO", "ADMIN"] as const;

export const userSchema = z
  .object({
    name: requiredText("El nombre"),
    email: z.string().trim().toLowerCase().email("Correo no válido."),
    phone: requiredText("El teléfono"),
    role: z.enum(ROLE_OPTIONS, { message: "Rol no válido (Propietario, Encargado o Administrador)." }),
    zoneIds: z.array(z.string()),
  })
  .superRefine((user, context) => {
    if (user.role === "ENCARGADO" && user.zoneIds.length === 0) {
      context.addIssue({ code: "custom", path: ["zoneIds"], message: "Un encargado necesita al menos una zona." });
    }
  });

export const crewSchema = z.object({
  name: requiredText("El nombre"),
  type: z.enum(["INTERNO", "SUBCONTRATO"]),
  contactName: requiredText("El contacto"),
  phone: requiredText("El teléfono"),
  zoneId: z.string().min(1, "Elige la zona."),
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
