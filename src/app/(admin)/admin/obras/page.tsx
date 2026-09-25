"use client";

import Link from "next/link";
import { useState } from "react";
import { ProjectForm } from "@/components/admin/project-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { mapsUrl } from "@/lib/geo";
import { isClosed } from "@/lib/ticket-status";

export default function ObrasPage() {
  const api = useDataApi();
  const { data: projects } = useQuery(api.getProjects);
  const { data: zones } = useQuery(api.getZones);
  const { data: units } = useQuery(api.getUnits);
  const { data: tickets } = useQuery(api.getTickets);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = projects?.map((project) => {
    const projectUnits = units?.filter((unit) => unit.projectId === project.id) ?? [];
    const unitIds = new Set(projectUnits.map((unit) => unit.id));
    return {
      project,
      zone: zones?.find((zone) => zone.id === project.zoneId)?.name ?? "—",
      units: projectUnits.length,
      open: tickets?.filter((ticket) => unitIds.has(ticket.unitId) && !isClosed(ticket.status)).length ?? 0,
    };
  });

  return (
    <div className="pb-8">
      <PageHeader
        title="Obras y unidades"
        subtitle="Obras de edificación con su ubicación, y las viviendas de cada una."
        actions={<Button onClick={() => setCreating(true)}>Nueva obra</Button>}
      />

      {notice && <Notice tone="success" className="mt-5" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {rows === undefined ? (
        <ContentSkeleton label="Cargando obras…" />
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ project, zone, units: unitCount, open }) => (
            <li key={project.id} className="flex flex-col rounded-lg border border-line-soft bg-surface p-5 shadow-card transition duration-150 ease-axis-out hover:shadow-raised">
              <Link href={`/admin/obras/${project.id}`} className="text-lg font-bold text-accent hover:underline">
                {project.name} · {project.code}
              </Link>
              <p className="text-sm text-ink-secondary">{project.address}, {project.commune}</p>
              <p className="text-sm text-ink-secondary">{zone}</p>
              <div className="mt-4 flex gap-6 text-sm">
                <p><span className="font-bold text-ink">{unitCount}</span> <span className="text-ink-secondary">{unitCount === 1 ? "unidad" : "unidades"}</span></p>
                <p><span className="font-bold text-ink">{open}</span> <span className="text-ink-secondary">{open === 1 ? "abierto" : "abiertos"}</span></p>
              </div>
              <div className="mt-4 flex gap-4 border-t border-line-soft pt-4 text-sm font-bold">
                <Link href={`/admin/obras/${project.id}`} className="text-accent hover:underline">Ver unidades</Link>
                <a href={mapsUrl(project.location)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Ver en el mapa</a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} title="Nueva obra" onClose={() => setCreating(false)}>
        {creating && (
          <ProjectForm
            onCancel={() => setCreating(false)}
            onCreated={(project) => {
              setCreating(false);
              setNotice(`Obra "${project.name}" creada. Ahora agrégale sus unidades.`);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
