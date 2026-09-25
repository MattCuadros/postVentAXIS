import type { DocumentKind } from "@/types/domain";

export type DetectedType = DocumentKind | "UNKNOWN";

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  EMAIL: "Correo",
  OI: "Orden de inspección (OI)",
  OI_FIRMADA: "OI firmada (solucionado en visita)",
  OT: "Orden de trabajo (OT)",
  INFORME_AXIS: "Informe de trabajo realizado AXIS",
};

/** Fecha (YYYY-MM-DD) y hora opcional (HH:mm). */
export interface DateTimeValue {
  date: string;
  time: string | null;
}

/** Lo que el lector detectó en el documento para un requerimiento. Todo es editable en la revisión. */
export interface ParsedRequirement {
  projectHint: string | null;
  unitHint: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  room: string | null;
  item: string | null;
  problem: string | null;
  description: string | null;
  /** Folio del documento (OI-…, OT-…) y número de requerimiento (AB3C-000096/1). */
  externalRefs: string[];
  requestDate: string | null;
  visit: DateTimeValue | null;
  /** Filas "FECHA EJECUCION TRABAJOS" de una OT, en orden. */
  execution: DateTimeValue[];
  responsible: string | null;
  repairDate: string | null;
  /** Advertencias para revisar: texto cortado, datos que se contradicen, campos ilegibles. */
  warnings: string[];
}

export interface ParsedDocument {
  type: DetectedType;
  /** Folio del documento completo, ej. "OI-AB3C-000096/4466". */
  folio: string | null;
  issuedDate: string | null;
  subject: string | null;
  requirements: ParsedRequirement[];
  warnings: string[];
}

export function emptyRequirement(): ParsedRequirement {
  return {
    projectHint: null,
    unitHint: null,
    ownerName: null,
    ownerEmail: null,
    ownerPhone: null,
    room: null,
    item: null,
    problem: null,
    description: null,
    externalRefs: [],
    requestDate: null,
    visit: null,
    execution: [],
    responsible: null,
    repairDate: null,
    warnings: [],
  };
}

/** Minúsculas, sin tildes ni signos: para comparar textos de documentos con los datos registrados. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/** "BAÑO 1" → "Baño 1"; "LOGGIA / LAVADERO" → "Loggia / lavadero". */
export function sentenceCase(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return clean;
  const lower = clean.toLocaleLowerCase("es");
  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}

/** "12/10/2023", "16-08-2023", "2026-09-22" → "YYYY-MM-DD" (null si no es una fecha válida). */
export function parseDocDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  let year: number;
  let month: number;
  let day: number;
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const local = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (local) {
    [day, month, year] = [Number(local[1]), Number(local[2]), Number(local[3])];
    if (year < 100) year += 2000;
  } else {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}
