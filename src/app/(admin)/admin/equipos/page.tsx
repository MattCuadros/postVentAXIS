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
import type { WorkCrew, WorkCrewType } from "@/types/domain";

const CREW_TYPE_LABEL: Record<WorkCrewType, string> = { INTERNO: "Cuadrilla interna", SUBCONTRATO: "Subcontrato" };

export default function EquiposAdminPage() {
  const api = useDataApi();
  const { data: crews } = useQuery(api.getCrews);
  const { data: zones } = useQuery(api.getZones);
  const { data: tickets } = useQuery(api.getTickets);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="pb-8">
      <PageHeader
        title="Equipos de trabajo"
        subtitle="Cuadrillas internas y subcontratos que los encargados pueden asignar en cada zona."
        actions={<Button onClick={() => setCreating(true)}>Nuevo equipo</Button>}
      />

      {notice && <Notice tone="success" className="mt-5" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {crews === undefined || zones === undefined ? (
        <ContentSkeleton label="Cargando equipos…" />
      ) : (
        zones.map((zone) => {
          const zoneCrews = crews.filter((crew) => crew.zoneId === zone.id);
          return (
            <section key={zone.id} className="mt-8">
              <h2 className="text-base">{zone.name}</h2>
              {zoneCrews.length === 0 ? (
                <p className="mt-2 text-sm text-ink-secondary">Sin equipos: los encargados de esta zona no podrán asignar trabajos.</p>
              ) : (
                <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {zoneCrews.map((crew) => {
                    const active = tickets?.filter((ticket) => ticket.crewId === crew.id && !isClosed(ticket.status)).length ?? 0;
                    return (
                      <li key={crew.id} className="rounded-lg border border-line-soft bg-surface p-4 shadow-card">
                        <p className="font-bold text-ink">{crew.name}</p>
                        <p className="text-xs text-ink-secondary">{CREW_TYPE_LABEL[crew.type]}</p>
                        <p className="mt-2 text-sm text-ink">{crew.contactName} · {crew.phone}</p>
                        <p className="mt-2 text-xs text-ink-meta">{active} {active === 1 ? "requerimiento activo" : "requerimientos activos"}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}

      <Dialog open={creating} title="Nuevo equipo" onClose={() => setCreating(false)}>
        {creating && (
          <CrewForm
            onCancel={() => setCreating(false)}
            onCreated={(crew) => {
              setCreating(false);
              setNotice(`Equipo "${crew.name}" creado.`);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function CrewForm({ onCreated, onCancel }: { onCreated: (crew: WorkCrew) => void; onCancel: () => void }) {
  const api = useDataApi();
  const { data: zones } = useQuery(api.getZones);
  const [values, setValues] = useState({ name: "", type: "INTERNO" as WorkCrewType, contactName: "", phone: "", zoneId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  async function handleSubmit() {
    const result = crewSchema.safeParse(values);
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setSaving(true);
    try {
      onCreated(await api.createCrew(result.data));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Nombre" name="crew-name" placeholder="Ej.: Cuadrilla Postventa Centro" value={values.name} error={errors.name} onChange={(event) => set("name", event.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Tipo" name="crew-type" value={values.type} onChange={(event) => set("type", event.target.value as WorkCrewType)}>
          <option value="INTERNO">Cuadrilla interna</option>
          <option value="SUBCONTRATO">Subcontrato</option>
        </Select>
        <Select label="Zona" name="crew-zone" value={values.zoneId} error={errors.zoneId} onChange={(event) => set("zoneId", event.target.value)}>
          <option value="" disabled>Selecciona la zona</option>
          {zones?.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Contacto" name="crew-contact" value={values.contactName} error={errors.contactName} onChange={(event) => set("contactName", event.target.value)} />
        <Input label="Teléfono" name="crew-phone" type="tel" placeholder="+56 9 1234 5678" value={values.phone} error={errors.phone} onChange={(event) => set("phone", event.target.value)} />
      </div>
      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button>
        <Button disabled={saving} onClick={handleSubmit}>{saving ? "Guardando…" : "Crear equipo"}</Button>
      </div>
    </div>
  );
}
