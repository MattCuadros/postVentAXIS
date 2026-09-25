"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { cn } from "@/lib/cn";
import { readSheetRows } from "@/lib/sheet";
import { TEMPLATE_EXAMPLE, TEMPLATE_HEADERS, validateImport, type ImportRow } from "@/lib/user-import";

interface UserImporterProps {
  onDone: (imported: number, skipped: number) => void;
  onCancel: () => void;
}

/** Carga masiva de usuarios desde Excel: plantilla → subir → revisar → importar las filas válidas. */
export function UserImporter({ onDone, onCancel }: UserImporterProps) {
  const api = useDataApi();
  const { data: zones } = useQuery(api.getZones);
  const { data: users } = useQuery(api.getUsers);
  const { data: projects } = useQuery(api.getProjects);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const valid = rows?.filter((row) => row.user !== null) ?? [];
  const invalid = (rows?.length ?? 0) - valid.length;

  async function handleTemplate() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS], ...TEMPLATE_EXAMPLE]);
    sheet["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 28 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Usuarios");
    XLSX.writeFile(book, "plantilla-usuarios-postventaxis.xlsx");
  }

  async function handleFile(file: File | undefined) {
    if (!file || !zones || !users) return;
    setReadError(null);
    setFileName(file.name);
    try {
      const data = await readSheetRows(file);
      const parsed = validateImport(data, zones, users.map((user) => user.email), projects ?? []);
      if (parsed.length === 0) {
        setRows(null);
        setReadError("La planilla no tiene filas con datos. Usa la plantilla como guía.");
        return;
      }
      setRows(parsed);
    } catch {
      setRows(null);
      setReadError("No pudimos leer el archivo. Verifica que sea un Excel (.xlsx) o CSV.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      for (const row of valid) {
        if (row.user) await api.createUser({ ...row.user, active: true });
      }
      onDone(valid.length, invalid);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-2 text-sm text-ink-secondary">
        <li>
          1. Descarga la plantilla y completa una fila por persona.{" "}
          <button type="button" className="font-bold text-accent hover:underline" onClick={handleTemplate}>Descargar plantilla</button>
        </li>
        <li>2. En <strong className="text-ink">Rol</strong> escribe Propietario, Encargado o Administrador. Los encargados necesitan sus <strong className="text-ink">Zonas</strong>, separadas por coma.</li>
        <li>3. Sube el archivo, revisa el resultado e importa las filas válidas.</li>
      </ol>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          id="user-import-file"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <label
          htmlFor="user-import-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line p-6 text-center transition-colors hover:border-accent hover:bg-accent-soft"
        >
          <span className="font-bold text-accent">{fileName ? "Subir otro archivo" : "Elegir archivo Excel"}</span>
          <span className="text-xs text-ink-meta">{fileName ?? ".xlsx, .xls o .csv"}</span>
        </label>
        {readError && <p className="mt-2 text-sm text-danger" role="alert">{readError}</p>}
      </div>

      {rows && (
        <div>
          <p className="text-sm text-ink" aria-live="polite">
            <strong>{valid.length}</strong> {valid.length === 1 ? "fila lista" : "filas listas"} para importar
            {invalid > 0 && <> · <strong className="text-danger">{invalid}</strong> con errores (no se importan)</>}
          </p>
          <div className="mt-3 max-h-72 overflow-auto rounded-md border border-line-soft">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-secondary">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Fila</th>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Nombre</th>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Rol</th>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.line} className="border-t border-line-soft align-top">
                    <td className="px-3 py-2 tabular-nums text-ink-meta">{row.line}</td>
                    <td className="px-3 py-2 text-ink">
                      {row.name || "—"}
                      <span className="block text-ink-meta">{row.email}</span>
                    </td>
                    <td className="px-3 py-2 text-ink">
                      {row.roleText || "—"}
                      {row.zonesText && <span className="block text-ink-meta">{row.zonesText}</span>}
                    </td>
                    <td className={cn("px-3 py-2", row.user ? "text-success" : "text-danger")}>
                      {row.user ? "Lista" : row.errors.map((error) => <span key={error} className="block">{error}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={importing} onClick={onCancel}>Cancelar</Button>
        <Button disabled={importing || valid.length === 0} onClick={handleImport}>
          {importing ? "Importando…" : `Importar ${valid.length} ${valid.length === 1 ? "usuario" : "usuarios"}`}
        </Button>
      </div>
    </div>
  );
}
