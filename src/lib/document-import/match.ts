/**
 * Cruce de lo leído en un documento con los datos registrados (obras, unidades, propietarios,
 * categorías). Funciones puras: reciben los datos y devuelven la mejor coincidencia o null.
 */
import { normalizeText } from "@/lib/document-import/types";
import type { Project, TicketCategory, Unit, UnitType, User } from "@/types/domain";

export interface UnitHint {
  type: UnitType;
  tower: string | null;
  number: string;
}

/**
 * Interpreta cómo los documentos nombran una unidad: "AB3C - CASA. G26", "CASA 15", "Casa F35",
 * "F-35", "C 405", "405-C", "Torre C 405", "Depto 405".
 */
export function parseUnitHint(value: string | null): UnitHint | null {
  if (!value) return null;
  const text = value.toUpperCase();

  const house = /CASA\.?\s*(?:N[°º.]?\s*)?([A-Z]?)-?\s?(\d{1,4})([A-Z]?)\b/.exec(text);
  if (house) return { type: "CASA", tower: null, number: `${house[1]}${house[2]}${house[3]}` };

  const tower = /TORRE\s*([A-Z0-9]{1,2})\D{0,12}?(\d{2,4})/.exec(text);
  if (tower) return { type: "DEPARTAMENTO", tower: tower[1], number: tower[2] };

  const numberTower = /\b(\d{2,4})\s?-\s?([A-Z])\b/.exec(text);
  if (numberTower) return { type: "DEPARTAMENTO", tower: numberTower[2], number: numberTower[1] };

  const towerNumber = /\b([A-Z])\s(\d{3,4})\b/.exec(text);
  if (towerNumber) return { type: "DEPARTAMENTO", tower: towerNumber[1], number: towerNumber[2] };

  const lot = /\b([A-Z])-(\d{1,3})\b/.exec(text);
  if (lot) return { type: "CASA", tower: null, number: `${lot[1]}${lot[2]}` };

  const flat = /\b(?:DEPTO|DPTO|DEPARTAMENTO)\.?\s*(\d{2,4})\b/.exec(text);
  if (flat) return { type: "DEPARTAMENTO", tower: null, number: flat[1] };

  return null;
}

/** Clave comparable de una unidad ("405-C" y "C 405" dan la misma). */
export function unitKey(hint: UnitHint): string {
  return [hint.type, hint.tower ?? "", hint.number.replace(/^0+/, "")].join(":");
}

const PROJECT_STOPWORDS = new Set(["edificio", "condominio", "etapa", "proyecto", "el", "la", "los", "las", "de", "del"]);

function tokens(value: string): string[] {
  return normalizeText(value).split(" ").filter((token) => token && !PROJECT_STOPWORDS.has(token));
}

/**
 * Obra más parecida al texto del documento: todas las palabras del nombre registrado deben
 * aparecer ("ALTO BULNES III C" coincide con "Alto Bulnes III"). También acepta el código de obra.
 */
export function matchProject(hint: string | null, projects: Project[]): Project | null {
  if (!hint) return null;
  const hintTokens = new Set(tokens(hint));
  let best: { project: Project; score: number } | null = null;

  for (const project of projects) {
    const nameTokens = tokens(project.name);
    if (nameTokens.length === 0) continue;
    const hits = nameTokens.filter((token) => hintTokens.has(token)).length;
    let score = hits / nameTokens.length;
    if (hintTokens.has(project.code.toLowerCase())) score = Math.max(score, 1);
    if (!best || score > best.score) best = { project, score };
  }

  if (!best) return null;
  // Coincidencia completa; o, si viene de OCR con una palabra mal leída ("ALTO BULNES MB"),
  // al menos dos tercios del nombre y dos palabras reconocidas.
  const hits = Math.round(best.score * tokens(best.project.name).length);
  return best.score >= 0.99 || (best.score >= 0.66 && hits >= 2) ? best.project : null;
}

/** Unidad de la obra que calza con la pista del documento. */
export function matchUnit(hint: string | null, units: Unit[]): Unit | null {
  const parsed = parseUnitHint(hint);
  if (!parsed) return null;
  const key = unitKey(parsed);
  return (
    units.find((unit) => unitKey({ type: unit.type, tower: unit.tower, number: unit.number.toUpperCase() }) === key) ??
    // Sin torre en el documento: basta el número si es único en la obra.
    (parsed.tower === null
      ? units.filter((unit) => unit.type === parsed.type && unit.number.toUpperCase() === parsed.number).at(0) ?? null
      : null)
  );
}

/** Propietario por correo; si no, el dueño registrado de la unidad. */
export function matchOwner(email: string | null, users: User[], unit: Unit | null): User | null {
  if (email) {
    const byEmail = users.find((user) => user.role === "PROPIETARIO" && user.email.toLowerCase() === email.toLowerCase());
    if (byEmail) return byEmail;
  }
  if (unit) return users.find((user) => user.id === unit.ownerId) ?? null;
  return null;
}

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["calefaccion y gas", /caldera|termostato|calefac|radiador|calefont|\bgas\b|estufa/],
  ["sanitarias", /desag|filtr|llave|grifer|\bwc\b|inodoro|lavamanos|lavaplatos|receptac|ducha|sifon|estanque|agua|alcantarill|malos olores|olor/],
  ["ceramicas", /ceramic|fragu|porcelanato|azulej|palmeta/],
  ["ventanas", /ventana|vidrio|termopanel|corredera|ventanal/],
  ["techo", /techo|cubierta|canaleta|gotera|\bteja/],
  ["puertas", /puerta|chapa|cerradura|cerrojo|bisagra|quincaller|picaporte|manilla/],
  ["pisos", /piso|flotante|alfombra|zocalo|junquillo|parquet/],
  ["muros y tabiques", /muro|tabique|pared|grieta|fisura|yeso|volcanita/],
  ["pintura", /pintura|descascar|pintad|desprendimiento/],
];

/** Categoría por palabras clave del ítem, problema y descripción (en ese orden de prioridad). */
export function matchCategory(texts: (string | null)[], categories: TicketCategory[]): TicketCategory | null {
  for (const text of texts) {
    if (!text) continue;
    const normalized = normalizeText(text);
    for (const [name, pattern] of CATEGORY_KEYWORDS) {
      if (!pattern.test(normalized)) continue;
      const category = categories.find((item) => normalizeText(item.name) === name);
      if (category) return category;
    }
  }
  return categories.find((item) => normalizeText(item.name) === "otros") ?? null;
}
