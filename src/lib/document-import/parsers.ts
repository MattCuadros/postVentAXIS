/**
 * Lectores de documentos de postventa (texto ya extraído del PDF, digital u OCR).
 * Funciones puras y deterministas: no dependen del navegador ni del store.
 */
import { parseUnitHint, unitKey } from "@/lib/document-import/match";
import {
  emptyRequirement,
  parseDocDate,
  sentenceCase,
  type DetectedType,
  type ParsedDocument,
  type ParsedRequirement,
} from "@/lib/document-import/types";

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

// ---------------------------------------------------------------------------
// Tipo de documento

export function detectDocumentType(text: string, options: { fromOcr?: boolean } = {}): DetectedType {
  const upper = text.toUpperCase();
  if (/ORDEN\s+DE\s+TRABAJO|FOLIO:?\s*OT-/.test(upper)) return "OT";
  if (/ORDEN\s+DE\s+INSPECCI[OÓ]N|FOLIO:?\s*OI-/.test(upper)) return options.fromOcr ? "OI_FIRMADA" : "OI";
  if (/POST\s*VENTA/.test(upper) && /CONFORMIDAD\s+POR\s+EJECUCI|REFERENTE\s+OT|TRABAJOS\s+REALIZADOS/.test(upper)) {
    return "INFORME_AXIS";
  }
  if (/(^|\n)\s*ASUNTO\s*:/.test(upper) && /(^|\n)\s*DE\s*:/.test(upper)) return "EMAIL";
  return "UNKNOWN";
}

export function parseDocument(type: DetectedType, text: string): ParsedDocument {
  switch (type) {
    case "OI":
    case "OI_FIRMADA":
    case "OT":
      return parseOrder(type, text);
    case "INFORME_AXIS":
      return parseAxisReport(text);
    case "EMAIL":
      return parseEmail(text);
    default:
      return { type, folio: null, issuedDate: null, subject: null, requirements: [emptyRequirement()], warnings: [] };
  }
}

// ---------------------------------------------------------------------------
// Utilidades

function lines(text: string): string[] {
  return text.replace(/\f/g, "\n").split(/\r?\n/).map((line) => line.replace(/\s+$/, ""));
}

/**
 * Valor de un campo "ETIQUETA : valor" en un formulario: termina al llegar a la siguiente
 * etiqueta de la misma línea (separada por 2+ espacios) o al final de la línea.
 */
function field(text: string, label: string): string | null {
  // Los dos puntos son opcionales: el OCR suele perderlos o leerlos como guion ("PROYECTO — ALTO…").
  const pattern = new RegExp(`${label}[ \\t]*[:—–-]?[ \\t]*([^\\n]*)`, "i");
  const match = pattern.exec(text);
  if (!match) return null;
  const value = match[1]
    .split(/\s{2,}[\p{L}][\p{L} ./()-]{0,30}:/u)[0]
    // El OCR suele dejar un solo espacio antes de la etiqueta siguiente: se corta en las conocidas.
    .split(INLINE_LABELS)[0]
    .trim();
  return value === "" ? null : value;
}

/** Etiquetas que aparecen a la derecha de otra en la misma línea de los formularios OI/OT. */
const INLINE_LABELS = new RegExp(
  "\\s+(?:(?:Lugar|Item|Problema|Inicio est|C\\/NC|ETAPA|MANZANA|FECHA ENTREGA|E-MAIL|MEDIO SOLICITUD|HORA|NOMBRE QUIEN|FONO CONTACTO)\\b|\\S*sv\\s*:)",
  "i",
);

/** Texto multilínea desde una etiqueta hasta la siguiente etiqueta conocida. */
function block(text: string, label: string, stopLabels: string[]): string | null {
  const start = new RegExp(`${label}\\s*:\\s*`, "i").exec(text);
  if (!start) return null;
  const rest = text.slice(start.index + start[0].length);
  const stop = new RegExp(`\\n\\s*(${stopLabels.join("|")})\\b|\\n\\s*\\n`, "i").exec(rest);
  const value = (stop ? rest.slice(0, stop.index) : rest).replace(/\s+/g, " ").trim();
  return value === "" ? null : value;
}

function firstPhone(value: string | null): string | null {
  if (!value) return null;
  const match = /(\+?56\s?)?9\s?\d{4}\s?\d{4}|\b\d{8,9}\b/.exec(value);
  return match ? match[0].replace(/\s+/g, "") : null;
}

function firstEmail(value: string | null): string | null {
  if (!value) return null;
  const match = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(value);
  return match ? match[0].toLowerCase() : null;
}

function firstTime(value: string | null): string | null {
  if (!value) return null;
  const match = /(\d{1,2}):(\d{2})/.exec(value);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

/** "miércoles, 19 de agosto de 2026 15:57" → { date, time }. */
function parseSpanishDateTime(value: string): { date: string; time: string | null } | null {
  const match = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i.exec(value);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")];
  if (!month) return null;
  const date = parseDocDate(`${match[3]}-${month}-${match[1]}`);
  return date ? { date, time: firstTime(value.slice(match.index + match[0].length)) } : null;
}

// ---------------------------------------------------------------------------
// OI, OI firmada y OT (formularios del sistema de postventa)

function parseOrder(type: "OI" | "OI_FIRMADA" | "OT", text: string): ParsedDocument {
  const folio = /FOLIO\s*:?\s*(O[IT]-[A-Z0-9 ]+?-\d+\/\d+)/i.exec(text)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  const issuedDate = parseDocDate(field(text, "EMISION") ?? field(text, "EMISIÓN"));
  const warnings: string[] = [];

  const general = {
    projectHint: field(text, "PROYECTO"),
    unitHint: field(text, "PROPIEDAD") ?? field(text, "LOTE"),
    ownerName: field(text, "PROPIETARIO"),
    ownerEmail: firstEmail(field(text, "E-MAIL")),
    ownerPhone: firstPhone(field(text, "TELEFONOS") ?? field(text, "TELÉFONOS")),
    requestDate: parseDocDate(field(text, "FECHA SOLICITUD") ?? field(text, "FECHA(?=[ \t]*:)")),
  };

  const visitDate = parseDocDate(field(text, "FECHA VISITA ACORD\\.?") ?? field(text, "FECHA VISITA"));
  const visit = visitDate ? { date: visitDate, time: firstTime(field(text, "HORA")) } : null;
  const repairDate = parseDocDate(field(text, "FECHA DE REPARACION") ?? field(text, "FECHA DE REPARACIÓN"));

  const execution: { date: string; time: string | null }[] = [];
  let responsible: string | null = null;
  const executionPattern = /(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s*-\s*\d{1,2}:\d{2}/g;
  for (const line of lines(text)) {
    const rows = [...line.matchAll(executionPattern)];
    if (rows.length === 0) continue;
    const before = line.slice(0, rows[0].index).trim();
    if (!responsible && before && !/RESPONSABLE/i.test(before)) responsible = sentenceCase(before);
    for (const row of rows) {
      const date = parseDocDate(row[1]);
      if (date && !execution.some((item) => item.date === date)) execution.push({ date, time: firstTime(row[2]) });
    }
  }

  // Un formulario puede traer varios "REQUERIMIENTO:"; el Acta de conformidad de la OT los repite.
  const blocks = text.split(/REQUERIMIENTO\s*:\s*/i).slice(1);
  const seen = new Set<string>();
  const requirements: ParsedRequirement[] = [];

  for (const part of blocks.length > 0 ? blocks : [text]) {
    const ref = /^([A-Z0-9 ]+?-\d+\/\d+)/i.exec(part)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
    if (ref && seen.has(ref)) continue;
    if (ref) seen.add(ref);

    const room = field(part, "Recinto");
    const place = field(part, "Lugar");
    const item = field(part, "Item");
    const problem = field(part, "Problema");
    const clientDescription = block(part, "Descripci[oó]n cliente", ["Detalle", "Instrucci", "Nivel", "INFORMACI", "RECEPCIONADO", "FECHA"]);
    const instruction = block(part, "Instrucci[oó]n", ["INFORMACI", "ESTADO", "RECEPCIONADO", "NIVEL", "\\f"]);

    const description = [
      clientDescription,
      instruction ? `Instrucción OT: ${instruction}` : null,
    ].filter(Boolean).join("\n") || null;

    requirements.push({
      ...emptyRequirement(),
      ...general,
      room: room ? sentenceCase([room, place].filter(Boolean).join(" · ")) : null,
      item: item ? sentenceCase(item) : null,
      problem: problem ? sentenceCase(problem) : null,
      description,
      externalRefs: [folio, ref].filter((value): value is string => Boolean(value)),
      visit,
      execution: type === "OT" ? execution : [],
      responsible: type === "OT" ? responsible : field(text, "VISITA EFECTUADA POR"),
      repairDate,
    });
  }

  if (type === "OI_FIRMADA") {
    warnings.push("Documento escaneado: la letra manuscrita (observaciones, firma, fecha de reparación) no se lee. Revisa y completa.");
  }
  if (!folio) warnings.push("No se encontró el folio del documento.");

  return { type, folio, issuedDate, subject: null, requirements, warnings };
}

// ---------------------------------------------------------------------------
// Informe de trabajo realizado AXIS (formulario "POST VENTA", normalmente escaneado)

function parseAxisReport(text: string): ParsedDocument {
  const reference = /REFERENTE\s+OT\s+([A-Z0-9 ]+?-\d+\/\d+)\s*(?:\(([^)]*)\))?/i.exec(text);
  const dates = [...text.matchAll(/\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g)]
    .map((match) => parseDocDate(match[1]))
    .filter((value): value is string => value !== null);
  const project = /PROYECTO\s*:?\s*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 ]{3,40}?)(?=\s{2,}|\n|$)/.exec(text)?.[1] ?? null;
  const lot = /LOTE\s*:?\s*([A-Z]-?\s?\d{1,4}[A-Z]?)/.exec(text)?.[1] ?? null;
  const name = /NOMBRE\s*:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{5,60}?)(?=\s{2,}|\n|$)/.exec(text)?.[1] ?? null;
  const ref = reference?.[1]?.replace(/\s+/g, " ").trim() ?? null;

  const requirement: ParsedRequirement = {
    ...emptyRequirement(),
    projectHint: project?.trim() ?? null,
    unitHint: lot ? `Casa ${lot.replace(/[\s-]/g, "")}` : null,
    ownerName: name?.trim() ?? null,
    ownerPhone: firstPhone(field(text, "TEL[EÉ]FONO CONTACTO") ?? field(text, "TEL[EÉ]FONO")),
    problem: reference?.[2] ? sentenceCase(reference[2]) : null,
    description: reference?.[2] ? sentenceCase(reference[2]) : null,
    externalRefs: ref ? [ref] : [],
    requestDate: dates[0] ?? null,
    visit: dates[1] ? { date: dates[1], time: null } : null,
    repairDate: dates.at(-1) ?? null,
  };

  return {
    type: "INFORME_AXIS",
    folio: ref,
    issuedDate: dates.at(-1) ?? null,
    subject: null,
    requirements: [requirement],
    warnings: [
      "Informe escaneado: los trabajos realizados y la firma son manuscritos y no se leen. Revisa y completa.",
      ...(ref ? [] : ["No se encontró la OT de referencia: no se podrá enlazar con un requerimiento existente."]),
    ],
  };
}

// ---------------------------------------------------------------------------
// Correo impreso desde Gmail

const EMAIL_NOISE = [
  /CONFIDENCIALIDAD|uso exclusivo del emisor|copia de esta informaci|respondiendo este mismo|borre todos los archivos|Imprime s\s?ó\s?lo/i,
  /^\d{1,2}\/\d{1,2}\/\d{2},\s+\d{1,2}:\d{2}\s+Correo de/i,
  /^https?:\/\//i,
  /^\d+\s+mensajes?$/i,
  /^\d+K$/,
];

interface EmailMessage {
  subject: string | null;
  sent: { date: string; time: string | null } | null;
  body: string[];
}

function cleanSubject(value: string): string {
  return value.replace(/^\s*((RV|RE|FW|FWD|TR)\s*:\s*)+/i, "").trim();
}

function splitMessages(allLines: string[]): EmailMessage[] {
  const messages: EmailMessage[] = [];
  let current: EmailMessage | null = null;
  let inHeaders = false;

  for (const raw of allLines) {
    const line = raw.trim();
    if (EMAIL_NOISE.some((pattern) => pattern.test(line))) continue;
    if (/^De\s*:/i.test(line)) {
      current = { subject: null, sent: null, body: [] };
      messages.push(current);
      inHeaders = true;
      continue;
    }
    if (!current) continue;
    if (inHeaders) {
      if (/^Enviado el\s*:/i.test(line)) current.sent = parseSpanishDateTime(line);
      if (/^Asunto\s*:/i.test(line)) {
        current.subject = cleanSubject(line.replace(/^Asunto\s*:/i, ""));
        inHeaders = false;
      }
      continue;
    }
    current.body.push(line);
  }

  return messages;
}

const UNIT_IN_TEXT = /\b(casa\s*(?:n[°º.]?\s*)?[a-z]?-?\d{1,4}[a-z]?|depto\.?\s*\d{2,4}|departamento\s*\d{2,4}|\d{2,4}\s?-\s?[a-z]\b|[a-z]\s\d{3,4}\b)/gi;

/** Unidad mencionada en el asunto: "405-C" → "405-C"; "TH/ CASA 15" → "CASA 15". */
function unitFromSubject(subject: string): string | null {
  const match = /casa\s*(?:n[°º.]?\s*)?[a-z]?-?\d{1,4}[a-z]?|\b\d{2,4}\s?-\s?[a-z]\b|\b[a-z]\s?\d{3,4}\b|\bS\d{3,4}\b/i.exec(subject);
  return match ? match[0].trim() : null;
}

function projectFromSubject(subject: string, unit: string | null): string | null {
  const segments = subject.split(/\s+-\s+|:/).map((segment) => segment.trim()).filter(Boolean);
  const candidates = segments.filter((segment) => !(unit && segment.includes(unit)) && !/ficha\s*pv/i.test(segment));
  if (candidates.length > 0) return candidates[0];
  const beforeSlash = subject.split("/")[0]?.trim();
  return beforeSlash && beforeSlash !== subject ? beforeSlash : null;
}

const ROOM_WORDS = [
  "baño principal", "baño de servicio", "baño", "cocina", "living", "comedor", "dormitorio principal", "dormitorio",
  "logia", "terraza", "hall de acceso", "hall", "pasillo", "estacionamiento", "bodega", "fachada", "departamento general",
];

function roomFromText(value: string): string | null {
  const lower = value.toLowerCase();
  const found = ROOM_WORDS.find((word) => lower.includes(word));
  return found ? sentenceCase(found) : null;
}

const TABLE_ROW = /^(.+?)\s{2,}([A-Z]\s?\d{2,4}|\d{2,4}\s?-?\s?[A-Z]|CASA\s*\d+[A-Z]?)\s{2,}(\+?\d[\d\s]{7,}\d)\s{2,}(.*)$/i;
const BODY_END = /^(saludos|atentamente|quedo atento|adjunto|cordialmente)/i;

/** Filas de la tabla "nombre · unidad · teléfono · recinto · ítem · problema" del correo. */
function parseTableRows(body: string[]): ParsedRequirement[] {
  const rows: ParsedRequirement[] = [];
  let continuation: string[] | null = null;
  let pending: ParsedRequirement | null = null;

  function closePending() {
    if (!pending || !continuation) return;
    const extra = [...continuation];
    if (!pending.item && extra.length > 0) {
      let item = extra.shift() ?? "";
      while (item.endsWith("/") && extra.length > 0) item = `${item} ${extra.shift()}`;
      pending.item = item.trim();
    }
    if (!pending.problem && extra.length > 0) pending.problem = extra.join(" ").trim();
    finishRow(pending);
    continuation = null;
    pending = null;
  }

  function finishRow(row: ParsedRequirement) {
    row.description = [row.item, row.problem].filter(Boolean).join(": ") || null;
    if (!row.problem || row.problem.length < 12) {
      row.warnings.push(`La descripción puede venir cortada por la impresión del correo ("${row.problem ?? ""}…"). Complétala.`);
    }
  }

  for (const raw of body) {
    const line = raw.trim();
    const match = TABLE_ROW.exec(line);
    if (match) {
      closePending();
      const cells = match[4].split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
      const row: ParsedRequirement = {
        ...emptyRequirement(),
        ownerName: match[1].replace(/\s{2,}/g, " ").trim(),
        unitHint: match[2].trim(),
        ownerPhone: firstPhone(match[3]),
        room: cells[0] ?? null,
        item: cells[1] ?? null,
        problem: cells.slice(2).join(" ") || null,
      };
      if (cells.length < 3) {
        pending = row;
        continuation = [];
        rows.push(row);
      } else {
        finishRow(row);
        rows.push(row);
      }
      continue;
    }
    if (pending && continuation && line && !BODY_END.test(line)) {
      continuation.push(line);
      continue;
    }
    closePending();
  }
  closePending();
  return rows;
}

/** Lista numerada "1. En baño principal, …" → un requerimiento por punto. */
function parseNumberedItems(body: string[]): ParsedRequirement[] {
  const items: string[] = [];
  let current: string | null = null;

  for (const raw of body) {
    const line = raw.trim();
    const numbered = /^(\d{1,2})[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (current) items.push(current);
      current = numbered[2];
      continue;
    }
    if (current && line && !BODY_END.test(line)) {
      current = `${current} ${line}`;
    } else if (current) {
      items.push(current);
      current = null;
    }
  }
  if (current) items.push(current);

  return items.map((text) => ({
    ...emptyRequirement(),
    room: roomFromText(text),
    description: text.replace(/\s+/g, " ").trim(),
  }));
}

/** Cuerpo del mensaje sin saludo ni despedida. */
function plainBody(body: string[]): string | null {
  const kept: string[] = [];
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    if (BODY_END.test(line)) break;
    // Saludo con nombre ("Ma. Nombre Persona,") o fórmula de saludo al inicio.
    if (kept.length === 0 && line.endsWith(",") && line.length < 45) continue;
    const withoutGreeting = line
      .replace(/^(estimad[oa@]s?|hola)\b[^,.:]*[,.:]\s*/i, "")
      .replace(/^(buenas\s+(tardes|días|dias|noches)|junto con saludar)[,.:]?\s*/i, "")
      .trim();
    if (withoutGreeting) kept.push(withoutGreeting);
  }
  const text = kept.join(" ").replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

function parseEmail(text: string): ParsedDocument {
  const allLines = lines(text);
  const title = allLines.map((line) => line.trim()).find((line, index) => index > 0 && line !== "" && !line.includes("@")) ?? "";
  const messages = splitMessages(allLines);
  const subject = cleanSubject(messages.find((message) => message.subject)?.subject ?? title);
  const oldest = messages.at(-1);
  const warnings: string[] = [];

  const unitHint = unitFromSubject(subject);
  const projectHint = projectFromSubject(subject, unitHint);

  // Busca requerimientos del más antiguo al más reciente: normalmente el reporte original está al final del hilo.
  let requirements: ParsedRequirement[] = [];
  for (const message of [...messages].reverse()) {
    requirements = parseTableRows(message.body);
    if (requirements.length === 0) requirements = parseNumberedItems(message.body);
    if (requirements.length > 0) break;
  }
  if (requirements.length === 0) {
    const description = plainBody(oldest?.body ?? []) ?? subject;
    requirements = [{ ...emptyRequirement(), description, room: roomFromText(description) }];
  }

  // Unidades distintas mencionadas en el hilo: el encargado debe confirmar cuál es.
  const mentions = new Map<string, string>();
  for (const match of text.matchAll(UNIT_IN_TEXT)) {
    const hint = parseUnitHint(match[0]);
    if (hint && !mentions.has(unitKey(hint))) mentions.set(unitKey(hint), match[0].replace(/\s+/g, " ").trim());
  }
  if (mentions.size > 1) {
    warnings.push(`El correo menciona distintas unidades (${[...mentions.values()].join(", ")}). Confirma la correcta.`);
  }

  const requestDate = oldest?.sent?.date ?? null;
  for (const requirement of requirements) {
    requirement.projectHint ??= projectHint;
    requirement.unitHint ??= unitHint;
    requirement.requestDate ??= requestDate;
  }

  return { type: "EMAIL", folio: null, issuedDate: requestDate, subject, requirements, warnings };
}
