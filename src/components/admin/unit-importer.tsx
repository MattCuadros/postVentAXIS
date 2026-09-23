"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { cn } from "@/lib/cn";
import { downloadCsv, readSheetRows } from "@/lib/sheet";
import { UNIT_TEMPLATE_EXAMPLE, UNIT_TEMPLATE_HEADERS, validateUnitImport, type UnitImportRow } from "@/lib/unit-import";
import type { Project } from "@/types/domain";

interface UnitImporterProps {
  project: Project;
  onDone: (result: { units: number; newOwners: number; skipped: number }) => void;
  onCancel: () => void;
}

/** Carga masiva de las unidades de una obra desde CSV (o Excel), creando los propietarios nuevos. */
export function UnitImporter({ project, onDone, onCancel }: UnitImporterProps) {
  const api = useDataApi();
  const { data: units } = useQuery(api.getUnits);
  const { data: users } = useQuery(api.getUsers);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<UnitImportRow[] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const valid = rows?.filter((row) => row.unit !== null && row.owner !== null) ?? [];
  const invalid = (rows?.length ?? 0) - valid.length;
  const newOwnerEmails = new Set(valid.flatMap((row) => (row.owner && "create" in row.owner ? [row.owner.create.email] : [])));

  function handleTemplate() {
    const slug = project.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    downloadCsv(`plantilla-unidades-${slug}.csv`, UNIT_TEMPLATE_HEADERS, UNIT_TEMPLATE_EXAMPLE);
  }

  async function handleFile(file: File | undefined) {
    if (!file || !units || !users) return;
    setReadError(null);
    setFileName(file.name);
    try {
      const parsed = validateUnitImport(
        await readSheetRows(file),
        units.filter((unit) => unit.projectId === project.id),
        users,
      );
      if (parsed.length === 0) {
        setRows(null);
        setReadError("El archivo no tiene filas con datos. Usa la plantilla como guía.");
        return;
      }
      setRows(parsed);
    } catch {
      setRows(null);
      setReadError("No pudimos leer el archivo. Verifica que sea un CSV o Excel.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      // Un mismo propietario nuevo puede aparecer en varias filas: se crea una sola vez.
      const createdIds = new Map<string, string>();
      for (const row of valid) {
        if (!row.unit || !row.owner) continue;
        let ownerId: string;
        if ("id" in row.owner) {
          ownerId = row.owner.id;
        } else {
          const { email } = row.owner.create;
          ownerId = createdIds.get(email) ?? (await api.createUser({ ...row.owner.create, role: "PROPIETARIO", zoneIds: [], active: true })).id;
          createdIds.set(email, ownerId);
        }
        await api.createUnit({ ...row.unit, projectId: project.id, ownerId });
      }
      onDone({ units: valid.length, newOwners: createdIds.size, skipped: invalid });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-2 text-sm text-ink-secondary">
        <li>
          1. Descarga la plantilla CSV y completa una fila por unidad.{" "}
          <button type="button" className="font-bold text-accent hover:underline" onClick={handleTemplate}>Descargar plantilla</button>
        </li>
        <li>
          2. <strong className="text-ink">Tipo</strong>: Departamento o Casa. Las casas no llevan Torre ni Piso.{" "}
          <strong className="text-ink">Fecha entrega</strong> en formato DD-MM-AAAA.
        </li>
        <li>
          3. El propietario se identifica por su <strong className="text-ink">correo</strong>. Si aún no está registrado, completa
          también su nombre y teléfono (solo la primera vez que aparece) y se creará automáticamente.
        </li>
      </ol>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          id="unit-import-file"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <label
          htmlFor="unit-import-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line p-6 text-center transition-colors hover:border-accent hover:bg-accent-soft"
        >
          <span className="font-bold text-accent">{fileName ? "Subir otro archivo" : "Elegir archivo CSV"}</span>
          <span className="text-xs text-ink-meta">{fileName ?? ".csv (también .xlsx)"}</span>
        </label>
        {readError && <p className="mt-2 text-sm text-danger" role="alert">{readError}</p>}
      </div>

      {rows && (
        <div>
          <p className="text-sm text-ink" aria-live="polite">
            <strong>{valid.length}</strong> {valid.length === 1 ? "unidad lista" : "unidades listas"}
            {newOwnerEmails.size > 0 && <> · {newOwnerEmails.size} {newOwnerEmails.size === 1 ? "propietario nuevo" : "propietarios nuevos"}</>}
            {invalid > 0 && <> · <strong className="text-danger">{invalid}</strong> con errores (no se importan)</>}
          </p>
          <div className="mt-3 max-h-72 overflow-auto rounded-md border border-line-soft">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-secondary">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Fila</th>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Unidad</th>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Propietario</th>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.line} className="border-t border-line-soft align-top">
                    <td className="px-3 py-2 tabular-nums text-ink-meta">{row.line}</td>
                    <td className="px-3 py-2 text-ink">{row.label}</td>
                    <td className="px-3 py-2 text-ink">{row.ownerLabel}</td>
                    <td className={cn("px-3 py-2", row.errors.length === 0 ? "text-success" : "text-danger")}>
                      {row.errors.length === 0 ? "Lista" : row.errors.map((error) => <span key={error} className="block">{error}</span>)}
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
          {importing ? "Importando…" : `Importar ${valid.length} ${valid.length === 1 ? "unidad" : "unidades"}`}
        </Button>
      </div>
    </div>
  );
}
