"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { cn } from "@/lib/cn";
import { downloadCsv, readSheetRows } from "@/lib/sheet";
import { unitTemplateExampleForProject, unitTemplateHeadersForRole, validateUnitImport, type UnitImportRow } from "@/lib/unit-import";
import { allowedUnitTypes, ownerLabel, UNIT_TYPE_LABEL } from "@/lib/project-types";
import type { Project } from "@/types/domain";

interface UnitImporterProps {
  project: Project;
  onDone: (result: { created: number; assigned: number; withoutOwner: number; newOwners: number; skipped: number }) => void;
  onCancel: () => void;
}

/**
 * Carga masiva de las unidades de una obra desde CSV (o Excel). El propietario es opcional: una
 * fila sin datos de propietario se importa igual, para completarlo después. Si la fila coincide
 * con una unidad ya existente sin propietario y trae uno válido, se le asigna en vez de rechazarla.
 */
export function UnitImporter({ project, onDone, onCancel }: UnitImporterProps) {
  const api = useDataApi();
  const { data: units } = useQuery(api.getUnits);
  const { data: users } = useQuery(api.getUsers);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<UnitImportRow[] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const roleLabel = ownerLabel(project.type);
  const roleLower = roleLabel.toLocaleLowerCase("es");
  const allowedTypes = allowedUnitTypes(project.type).map((type) => UNIT_TYPE_LABEL[type]).join(", ");

  const valid = rows?.filter((row) => row.errors.length === 0) ?? [];
  const invalid = (rows?.length ?? 0) - valid.length;
  const withOwner = valid.filter((row) => row.owner !== null && !("none" in row.owner));
  const withoutOwner = valid.length - withOwner.length;
  const toAssign = valid.filter((row) => row.assignToUnitId !== null).length;
  const newOwnerEmails = new Set(valid.flatMap((row) => (row.owner && "create" in row.owner ? [row.owner.create.email] : [])));

  function handleTemplate() {
    const slug = project.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    downloadCsv(`plantilla-unidades-${slug}.csv`, unitTemplateHeadersForRole(roleLabel), unitTemplateExampleForProject(project.type));
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
        project.type,
        roleLabel,
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

  /** ownerId a usar para la fila: existente, recién creado (una sola vez por correo), o null. */
  async function resolveOwnerId(owner: UnitImportRow["owner"], createdIds: Map<string, string>): Promise<string | null> {
    if (owner === null || "none" in owner) return null;
    if ("id" in owner) return owner.id;
    const { email } = owner.create;
    const cached = createdIds.get(email);
    if (cached) return cached;
    const created = await api.createUser({ ...owner.create, role: "PROPIETARIO", projectIds: [], zoneIds: [], active: true });
    createdIds.set(email, created.id);
    return created.id;
  }

  async function handleImport() {
    setImporting(true);
    try {
      // Un mismo propietario nuevo puede aparecer en varias filas: se crea una sola vez.
      const createdIds = new Map<string, string>();
      let created = 0;
      let assigned = 0;
      for (const row of valid) {
        const ownerId = await resolveOwnerId(row.owner, createdIds);
        if (row.assignToUnitId) {
          await api.updateUnit(row.assignToUnitId, { ownerId });
          assigned += 1;
        } else if (row.unit) {
          await api.createUnit({ ...row.unit, projectId: project.id, ownerId });
          created += 1;
        }
      }
      onDone({ created, assigned, withoutOwner, newOwners: createdIds.size, skipped: invalid });
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
          2. <strong className="text-ink">Tipo</strong>: {allowedTypes}. Las unidades ofrecen solo los campos que corresponden a su tipo.{" "}
          <strong className="text-ink">Fecha entrega</strong> en formato DD-MM-AAAA.
        </li>
        <li>
          3. El {roleLower} es opcional. Si lo dejas vacío, la unidad se importa sin {roleLower} y podrás completarlo después
          (con este mismo archivo: vuelve a importarlo agregando el correo a las filas que falten). Si lo completas, se
          identifica por su <strong className="text-ink">correo</strong>; si aún no está registrado, agrega también su
          nombre y teléfono (solo la primera vez que aparece) y se creará automáticamente.
        </li>
      </ol>

      {!units || !users ? (
        <ContentSkeleton label="Cargando unidades y usuarios…" lines={1} />
      ) : (
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
      )}

      {rows && (
        <div>
          <p className="text-sm text-ink" aria-live="polite">
            <strong>{valid.length}</strong> {valid.length === 1 ? "unidad lista" : "unidades listas"}
            {" · "}{withOwner.length} con {roleLower}
            {" · "}{withoutOwner} sin {roleLower} (se {withoutOwner === 1 ? "importa" : "importan"} igual)
            {toAssign > 0 && <> · {toAssign} {toAssign === 1 ? "asignación a unidad existente" : "asignaciones a unidades existentes"}</>}
            {newOwnerEmails.size > 0 && <> · {newOwnerEmails.size} {roleLabel} {newOwnerEmails.size === 1 ? "nuevo" : "nuevos"}</>}
            {invalid > 0 && <> · <strong className="text-danger">{invalid}</strong> con errores (no se importan)</>}
          </p>
          <div className="mt-3 max-h-72 overflow-auto rounded-md border border-line-soft">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-secondary">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Fila</th>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Unidad</th>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">{roleLabel}</th>
                  <th scope="col" className="px-3 py-2 font-bold text-ink">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.line} className="border-t border-line-soft align-top">
                    <td className="px-3 py-2 tabular-nums text-ink-meta">{row.line}</td>
                    <td className="px-3 py-2 text-ink">{row.label}</td>
                    <td className="px-3 py-2 text-ink">{row.ownerLabel}</td>
                    <td className={cn("px-3 py-2", row.errors.length > 0 ? "text-danger" : row.warnings.length > 0 ? "text-warning" : "text-success")}>
                      {row.errors.length > 0
                        ? row.errors.map((error) => <span key={error} className="block">{error}</span>)
                        : row.warnings.length > 0
                          ? row.warnings.map((warning) => <span key={warning} className="block">{warning}</span>)
                          : row.assignToUnitId
                            ? `Se asignará ${roleLower}`
                            : "Lista"}
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
