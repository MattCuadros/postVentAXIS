"use client";

import Link from "next/link";
import { useState } from "react";
import { UnitForm } from "@/components/admin/unit-form";
import { UnitImporter } from "@/components/admin/unit-importer";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { formatLongDate, unitLabel } from "@/lib/format";
import { formatCoordinates, mapsUrl } from "@/lib/geo";
import { isClosed } from "@/lib/ticket-status";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const api = useDataApi();
  const { data: projects } = useQuery(api.getProjects);
  const { data: zones } = useQuery(api.getZones);
  const { data: units } = useQuery(api.getUnits);
  const { data: users } = useQuery(api.getUsers);
  const { data: tickets } = useQuery(api.getTickets);
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (projects === undefined) return <p className="text-sm text-ink-secondary" role="status">Cargando obra…</p>;

  const project = projects.find((item) => item.id === projectId);
  if (project === undefined) {
    return (
      <div className="mx-auto mt-6 w-full max-w-lg rounded-lg border border-line-soft bg-surface p-6 text-center">
        <p className="font-bold text-ink">No encontramos esta obra</p>
        <Link href="/admin/obras" className="mt-3 inline-block text-sm font-bold text-accent hover:underline">Volver a obras</Link>
      </div>
    );
  }

  const zone = zones?.find((item) => item.id === project.zoneId);
  const projectUnits = (units ?? [])
    .filter((unit) => unit.projectId === project.id)
    .toSorted((a, b) => unitLabel(a).localeCompare(unitLabel(b), "es", { numeric: true }));

  return (
    <div className="pb-8">
      <Link href="/admin/obras" className="text-sm font-bold text-accent hover:underline">‹ Obras</Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">{project.name}</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {project.address}, {project.commune} · {zone?.name}
          </p>
          <p className="text-xs text-ink-meta">
            Ubicación: {formatCoordinates(project.location)} ·{" "}
            <a href={mapsUrl(project.location)} target="_blank" rel="noopener noreferrer" className="font-bold text-accent hover:underline">Ver en el mapa</a>
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDialog("import")}>Importar unidades (CSV)</Button>
          <Button onClick={() => setDialog("add")}>Agregar unidad</Button>
        </div>
      </header>

      {notice && (
        <div className="mt-5 flex items-start justify-between gap-3 rounded-md bg-success/10 p-4 text-sm text-success" role="status">
          <p>{notice}</p>
          <button type="button" aria-label="Cerrar aviso" className="shrink-0 font-bold" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      {projectUnits.length === 0 ? (
        <div className="mt-6 rounded-lg border border-line-soft bg-surface p-8 text-center">
          <p className="font-bold text-ink">Esta obra aún no tiene unidades</p>
          <p className="mt-1 text-sm text-ink-secondary">Agrega cada vivienda con su propietario para que pueda ingresar requerimientos.</p>
          <p className="mt-1 text-sm text-ink-secondary">Si son muchas, usa <strong className="text-ink">Importar unidades (CSV)</strong> con la plantilla.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line-soft bg-surface px-6 py-2">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line-soft">
                <th scope="col" className="py-4 pr-4 font-bold text-ink">Unidad</th>
                <th scope="col" className="py-4 pr-4 font-bold text-ink">Tipo</th>
                <th scope="col" className="py-4 pr-4 font-bold text-ink">Propietario</th>
                <th scope="col" className="py-4 pr-4 font-bold text-ink">Entrega</th>
                <th scope="col" className="py-4 text-right font-bold text-ink">Requerimientos abiertos</th>
              </tr>
            </thead>
            <tbody>
              {projectUnits.map((unit) => {
                const owner = users?.find((user) => user.id === unit.ownerId);
                const open = tickets?.filter((ticket) => ticket.unitId === unit.id && !isClosed(ticket.status)).length ?? 0;
                return (
                  <tr key={unit.id} className="border-b border-line-soft last:border-b-0">
                    <td className="py-4 pr-4 font-bold text-ink">{unitLabel(unit)}</td>
                    <td className="py-4 pr-4 text-ink">{unit.type === "CASA" ? "Casa" : `Departamento${unit.floor === null ? "" : ` · piso ${unit.floor}`}`}</td>
                    <td className="py-4 pr-4 text-ink">
                      {owner ? <>{owner.name}<span className="block text-xs text-ink-meta">{owner.email}</span></> : "—"}
                    </td>
                    <td className="py-4 pr-4 text-ink">{formatLongDate(unit.deliveryDate)}</td>
                    <td className="py-4 text-right tabular-nums text-ink">{open}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialog === "add"} title="Agregar unidad" onClose={() => setDialog(null)}>
        {dialog === "add" && (
          <UnitForm
            projectId={project.id}
            onCancel={() => setDialog(null)}
            onCreated={(unit) => {
              setDialog(null);
              setNotice(`${unitLabel(unit)} agregada a ${project.name}.`);
            }}
          />
        )}
      </Dialog>

      <Dialog open={dialog === "import"} title={`Importar unidades · ${project.name}`} onClose={() => setDialog(null)}>
        {dialog === "import" && (
          <UnitImporter
            project={project}
            onCancel={() => setDialog(null)}
            onDone={({ units: imported, newOwners, skipped }) => {
              setDialog(null);
              setNotice(
                `${imported} ${imported === 1 ? "unidad importada" : "unidades importadas"}` +
                  (newOwners > 0 ? ` y ${newOwners} ${newOwners === 1 ? "propietario creado" : "propietarios creados"}` : "") +
                  (skipped > 0 ? `. ${skipped} ${skipped === 1 ? "fila con errores no se importó" : "filas con errores no se importaron"}.` : "."),
              );
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
