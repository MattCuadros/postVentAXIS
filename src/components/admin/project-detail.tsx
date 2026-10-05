"use client";

import Link from "next/link";
import { useState } from "react";
import { UnitForm } from "@/components/admin/unit-form";
import { UnitImporter } from "@/components/admin/unit-importer";
import { UnitResponsibles } from "@/components/admin/unit-responsibles";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { formatLongDate, unitLabel } from "@/lib/format";
import { formatCoordinates, mapsUrl } from "@/lib/geo";
import { isClosed } from "@/lib/ticket-status";
import { ownerLabel, PROJECT_TYPE_LABEL, UNIT_TYPE_LABEL } from "@/lib/project-types";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { user } = useSession();
  const api = useDataApi();
  const { data: projects } = useQuery(api.getProjects);
  const { data: zones } = useQuery(api.getZones);
  const { data: units } = useQuery(api.getUnits);
  const { data: users } = useQuery(api.getUsers);
  const { data: tickets } = useQuery(api.getTickets);
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [responsiblesUnitId, setResponsiblesUnitId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (projects === undefined || user === null) return <ContentSkeleton label="Cargando obra…" />;

  const project = projects.find((item) => item.id === projectId);
  if (project === undefined) {
    return (
      <div className="mx-auto mt-6 w-full max-w-lg rounded-lg border border-line-soft bg-surface p-6 text-center shadow-card">
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
      <PageHeader
        back={{ href: "/admin/obras", label: "Obras" }}
        title={`${project.name} · ${project.code}`}
        subtitle={
          <>
            <p>
              {PROJECT_TYPE_LABEL[project.type]} · {project.address}, {project.commune} · {zone?.name}
            </p>
            <p className="text-xs text-ink-meta">
              Ubicación: {formatCoordinates(project.location)} ·{" "}
              <a href={mapsUrl(project.location)} target="_blank" rel="noopener noreferrer" className="font-bold text-accent hover:underline">
                Ver en el mapa
              </a>
            </p>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialog("import")}>Importar unidades (CSV)</Button>
            <Button onClick={() => setDialog("add")}>Agregar unidad</Button>
          </>
        }
      />

      {notice && <Notice tone="success" className="mt-5" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {projectUnits.length === 0 ? (
        <div className="mt-6 rounded-lg border border-line-soft bg-surface p-8 text-center shadow-card">
          <p className="font-bold text-ink">Esta obra aún no tiene unidades</p>
          <p className="mt-1 text-sm text-ink-secondary">Agrega cada unidad con su {ownerLabel(project.type).toLocaleLowerCase("es")} para que pueda ingresar requerimientos.</p>
          <p className="mt-1 text-sm text-ink-secondary">Si son muchas, usa <strong className="text-ink">Importar unidades (CSV)</strong> con la plantilla.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line-soft bg-surface px-6 py-2 shadow-card">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line-soft">
                <th scope="col" className="py-4 pr-4 font-bold text-ink">Unidad</th>
                <th scope="col" className="py-4 pr-4 font-bold text-ink">Tipo</th>
                <th scope="col" className="py-4 pr-4 font-bold text-ink">{ownerLabel(project.type)}</th>
                <th scope="col" className="py-4 pr-4 font-bold text-ink">Fecha Recepción Provisoria</th>
                <th scope="col" className="py-4 pr-4 font-bold text-ink">Fecha Recepción Final Municipal</th>
                <th scope="col" className="py-4 pr-4 font-bold text-ink">Fecha entrega a {ownerLabel(project.type).toLocaleLowerCase("es")}</th>
                <th scope="col" className="py-4 pr-4 text-right font-bold text-ink">Requerimientos abiertos</th>
                <th scope="col" className="py-4 text-right font-bold text-ink">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {projectUnits.map((unit) => {
                const owner = users?.find((user) => user.id === unit.ownerId);
                const open = tickets?.filter((ticket) => ticket.unitId === unit.id && !isClosed(ticket.status)).length ?? 0;
                return (
                  <tr key={unit.id} className="border-b border-line-soft last:border-b-0">
                    <td className="py-4 pr-4 font-bold text-ink">{unitLabel(unit)}</td>
                    <td className="py-4 pr-4 text-ink">{UNIT_TYPE_LABEL[unit.type]}{unit.floor === null ? "" : ` · piso ${unit.floor}`}</td>
                    <td className="py-4 pr-4 text-ink">
                      {owner ? <>{owner.name}<span className="block text-xs text-ink-meta">{owner.email}</span></> : <span className="text-ink-meta">Sin {ownerLabel(project.type).toLocaleLowerCase("es")}</span>}
                    </td>
                    {[unit.provisionalDeliveryDate, unit.municipalReceptionDate, unit.deliveryDate].map((date, index) => <td key={index} className={`py-4 pr-4 ${date ? "text-ink" : "text-ink-meta"}`}><span className="sm:hidden block text-xs font-bold text-ink-secondary">{["Fecha Recepción Provisoria", "Fecha Recepción Final Municipal", `Fecha entrega a ${ownerLabel(project.type).toLocaleLowerCase("es")}`][index]}</span>{date ? formatLongDate(date) : "Pendiente"}</td>)}
                    <td className="py-4 pr-4 text-right tabular-nums text-ink">{open}</td>
                    <td className="py-4 text-right">
                      <button type="button" className="text-sm font-bold text-accent hover:underline" onClick={() => setEditingUnitId(unit.id)}>
                        Editar
                      </button>
                      <button type="button" className="ml-3 text-sm font-bold text-accent hover:underline" onClick={() => setResponsiblesUnitId(unit.id)}>
                        Responsables
                      </button>
                    </td>
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

      <Dialog open={editingUnitId !== null} title="Editar unidad" onClose={() => setEditingUnitId(null)}>
        {editingUnitId !== null && (() => {
          const editing = projectUnits.find((item) => item.id === editingUnitId);
          return editing ? (
            <UnitForm
              projectId={project.id}
              unit={editing}
              onCancel={() => setEditingUnitId(null)}
              onCreated={(saved) => {
                setEditingUnitId(null);
                setNotice(`${unitLabel(saved)} actualizada.`);
              }}
            />
          ) : null;
        })()}
      </Dialog>

      <Dialog open={responsiblesUnitId !== null} title="Responsables" onClose={() => setResponsiblesUnitId(null)}>
        {responsiblesUnitId !== null && (() => {
          const target = projectUnits.find((item) => item.id === responsiblesUnitId);
          return target ? <UnitResponsibles unit={target} actingUser={user} /> : null;
        })()}
      </Dialog>

      <Dialog open={dialog === "import"} title={`Importar unidades · ${project.name}`} onClose={() => setDialog(null)}>
        {dialog === "import" && (
          <UnitImporter
            project={project}
            onCancel={() => setDialog(null)}
            onDone={({ created, assigned, withoutOwner, newOwners, skipped }) => {
              setDialog(null);
              const imported = created + assigned;
              setNotice(
                `${imported} ${imported === 1 ? "unidad procesada" : "unidades procesadas"}` +
                  (assigned > 0 ? ` (${assigned} ${assigned === 1 ? "asignación a unidad existente" : "asignaciones a unidades existentes"})` : "") +
                  (newOwners > 0 ? ` · ${newOwners} ${ownerLabel(project.type).toLocaleLowerCase("es")} ${newOwners === 1 ? "creado" : "creados"}` : "") +
                  (withoutOwner > 0 ? ` · ${withoutOwner} sin ${ownerLabel(project.type).toLocaleLowerCase("es")} (se pueden completar reimportando el mismo archivo)` : "") +
                  (skipped > 0 ? `. ${skipped} ${skipped === 1 ? "fila con errores no se importó" : "filas con errores no se importaron"}.` : "."),
              );
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
