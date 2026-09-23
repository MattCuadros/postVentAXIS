/** Utilidades compartidas por los importadores de planillas (CSV / Excel). */

export type SheetRow = Record<string, unknown>;

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Valor de una columna, tolerando mayúsculas, tildes y espacios en el encabezado. */
export function pick(row: SheetRow, header: string): string {
  const key = Object.keys(row).find((item) => normalize(item) === normalize(header));
  if (key === undefined) return "";
  const value = row[key];
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").trim();
}

/**
 * Lee la primera hoja de un .xlsx/.xls o un .csv (con "," o ";", como lo guarda Excel en español).
 * Los CSV se leen como texto para que fechas y números no se reinterpreten.
 */
export async function readSheetRows(file: File): Promise<SheetRow[]> {
  const XLSX = await import("xlsx");
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
  const book = isCsv
    ? XLSX.read((await file.text()).replace(/^﻿/, ""), { type: "string", raw: true })
    : XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0] ?? ""];
  if (!sheet) throw new Error("El archivo no tiene hojas.");
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "", raw: true });
}

/** Descarga una plantilla CSV separada por ";" y con BOM, para que Excel en español la abra bien. */
export function downloadCsv(filename: string, headers: readonly string[], rows: readonly (readonly string[])[]): void {
  const escape = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const content = [headers, ...rows].map((row) => row.map(escape).join(";")).join("\r\n");
  const blob = new Blob([`﻿${content}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Fecha de planilla a YYYY-MM-DD. Acepta 2026-08-30, 30-08-2026 y 30/08/2026. */
export function parseSheetDate(text: string): string | null {
  const value = text.trim();
  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (local) [day, month, year] = [Number(local[1]), Number(local[2]), Number(local[3])];
  else return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}
