"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { crewSchema, fieldErrors } from "@/lib/schemas";
import { isClosed } from "@/lib/ticket-status";
import type { Ticket, WorkCrew, WorkCrewType } from "@/types/domain";

const CREW_TYPE_LABEL: Record<WorkCrewType, string> = {
  INTERNO: "Cuadrilla interna",
  SUBCONTRATO: "Subcontrato",
};

export default function EquiposAdminPage() {
  const api = useDataApi();
  const { data: crews } = useQuery(api.getCrews);
  const { data: zones } = useQuery(api.getZones);
  const { data: projects } = useQuery(api.getProjects);
  const { data: tickets } = useQuery(api.getTickets);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!crews || !zones || !projects) {
    return <ContentSkeleton label="Cargando equipos…" />;
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Equipos de trabajo"
        subtitle="Cuadrillas internas y subcontratos organizados por zona y obra."
        actions={<Button onClick={() => setCreating(true)}>Nuevo equipo</Button>}
      />

      {notice && (
        <Notice tone="success" className="mt-5" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      {zones.map((zone) => {
        const zoneProjects = projects.filter((project) => project.zoneId === zone.id);
        const unassigned = crews.filter(
          (crew) => crew.zoneId === zone.id && crew.projectIds.length === 0,
        );

        return (
          <section key={zone.id} className="mt-8">
            <h2 className="text-base">{zone.name}</h2>
            {zoneProjects.map((project) => (
              <div key={project.id} className="mt-4">
                <h3 className="text-sm font-bold text-ink">
                  {project.name} · {project.code}
                </h3>
                <CrewCards
                  crews={crews.filter((crew) => crew.projectIds.includes(project.id))}
                  tickets={tickets ?? []}
                />
              </div>
            ))}
            <div className="mt-4">
              <h3 className="text-sm font-bold text-ink">Sin obra asignada</h3>
              <CrewCards
                crews={unassigned}
                tickets={tickets ?? []}
                empty="No hay equipos sin obra asignada en esta zona."
              />
            </div>
          </section>
        );
      })}

      <Dialog open={creating} title="Nuevo equipo" onClose={() => setCreating(false)}>
        {creating && (
          <CrewForm
            onCancel={() => setCreating(false)}
            onCreated={(crew) => {
              setCreating(false);
              setNotice('Equipo "' + crew.name + '" creado.');
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function CrewCards({
  crews,
  tickets,
  empty = "Sin equipos asignados a esta obra.",
}: {
  crews: WorkCrew[];
  tickets: Ticket[];
  empty?: string;
}) {
  if (crews.length === 0) {
    return <p className="mt-2 text-sm text-ink-secondary">{empty}</p>;
  }

  return (
    <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {crews.map((crew) => {
        const active = tickets.filter(
          (ticket) => ticket.crewId === crew.id && !isClosed(ticket.status),
        ).length;

        return (
          <li key={crew.id} className="rounded-lg border border-line-soft bg-surface p-4 shadow-card">
            <p className="font-bold text-ink">{crew.name}</p>
            <p className="text-xs text-ink-secondary">{CREW_TYPE_LABEL[crew.type]}</p>
            <p className="mt-2 text-sm text-ink">{crew.contactName} · {crew.phone}</p>
            <p className="mt-2 text-xs text-ink-meta">
              {active} {active === 1 ? "requerimiento activo" : "requerimientos activos"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function CrewForm({
  onCreated,
  onCancel,
}: {
  onCreated: (crew: WorkCrew) => void;
  onCancel: () => void;
}) {
  const api = useDataApi();
  const { data: zones } = useQuery(api.getZones);
  const { data: projects } = useQuery(api.getProjects);
  const [values, setValues] = useState({
    name: "",
    type: "INTERNO" as WorkCrewType,
    contactName: "",
    phone: "",
    zoneId: "",
    projectIds: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const availableProjects = projects?.filter((project) => project.zoneId === values.zoneId) ?? [];

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === "zoneId" ? { projectIds: [] } : {}),
    }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function toggleProject(projectId: string) {
    const projectIds = values.projectIds.includes(projectId)
      ? values.projectIds.filter((id) => id !== projectId)
      : [...values.projectIds, projectId];
    set("projectIds", projectIds);
  }

  async function handleSubmit() {
    const result = crewSchema.safeParse(values);
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }

    setSaving(true);
    try {
      const crew = await api.createCrew(result.data);
      onCreated(crew);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Nombre"
        name="crew-name"
        value={values.name}
        error={errors.name}
        onChange={(event) => set("name", event.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Tipo"
          name="crew-type"
          value={values.type}
          onChange={(event) => set("type", event.target.value as WorkCrewType)}
        >
          <option value="INTERNO">Cuadrilla interna</option>
          <option value="SUBCONTRATO">Subcontrato</option>
        </Select>
        <Select
          label="Zona"
          name="crew-zone"
          value={values.zoneId}
          error={errors.zoneId}
          onChange={(event) => set("zoneId", event.target.value)}
        >
          <option value="" disabled>Selecciona la zona</option>
          {zones?.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Contacto"
          name="crew-contact"
          value={values.contactName}
          error={errors.contactName}
          onChange={(event) => set("contactName", event.target.value)}
        />
        <Input
          label="Teléfono"
          name="crew-phone"
          value={values.phone}
          error={errors.phone}
          onChange={(event) => set("phone", event.target.value)}
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">Obras que atiende</legend>
        {values.zoneId === "" ? (
          <p className="text-sm text-ink-secondary">Elige primero la zona del equipo.</p>
        ) : availableProjects.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            No hay obras en esta zona. El equipo quedará sin obra asignada.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableProjects.map((project) => (
              <label
                key={project.id}
                className="cursor-pointer rounded-md border border-line-soft px-3 py-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={values.projectIds.includes(project.id)}
                  onChange={() => toggleProject(project.id)}
                />
                {project.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button>
        <Button disabled={saving} onClick={handleSubmit}>
          {saving ? "Guardando…" : "Crear equipo"}
        </Button>
      </div>
    </div>
  );
}
