"use client";

import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { isClosed } from "@/lib/ticket-status";
import type { WorkCrewType } from "@/types/domain";

const CREW_TYPE_LABEL: Record<WorkCrewType, string> = { INTERNO: "Cuadrilla interna", SUBCONTRATO: "Subcontrato" };

/** Equipos de las zonas del encargado, con su carga actual. Se administran desde /admin. */
export default function EquiposEncargadoPage() {
  const { user } = useSession();
  const api = useDataApi();
  const { data: crews } = useQuery(api.getCrews);
  const { data: zones } = useQuery(api.getZones);
  const { data: tickets } = useQuery(api.getTickets);

  const myZones = zones?.filter((zone) => user?.zoneIds.includes(zone.id)) ?? [];

  return (
    <div className="pb-8">
      <h1 className="text-2xl">Equipos de trabajo</h1>
      <p className="mt-1 text-sm text-ink-secondary">Cuadrillas y subcontratos disponibles en tus zonas.</p>

      {crews === undefined || tickets === undefined ? (
        <p className="mt-6 text-sm text-ink-secondary" role="status">Cargando equipos…</p>
      ) : (
        myZones.map((zone) => {
          const zoneCrews = crews.filter((crew) => crew.zoneId === zone.id);
          return (
            <section key={zone.id} className="mt-6">
              <h2 className="text-base">{zone.name}</h2>
              {zoneCrews.length === 0 ? (
                <p className="mt-2 text-sm text-ink-secondary">No hay equipos registrados en esta zona.</p>
              ) : (
                <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {zoneCrews.map((crew) => {
                    const active = tickets.filter((ticket) => ticket.crewId === crew.id && !isClosed(ticket.status)).length;
                    return (
                      <li key={crew.id} className="rounded-lg border border-line-soft bg-surface p-4">
                        <p className="font-bold text-ink">{crew.name}</p>
                        <p className="text-xs text-ink-secondary">{CREW_TYPE_LABEL[crew.type]}</p>
                        <p className="mt-2 text-sm text-ink">{crew.contactName}</p>
                        <a href={`tel:${crew.phone.replace(/\s/g, "")}`} className="text-sm text-accent hover:underline">{crew.phone}</a>
                        <p className="mt-2 text-xs text-ink-meta">
                          {active} {active === 1 ? "requerimiento activo" : "requerimientos activos"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
