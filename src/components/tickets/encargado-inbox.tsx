"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { daysOpen, unitLabel } from "@/lib/format";
import { isClosed, MAIN_FLOW, STATUS_LABEL } from "@/lib/ticket-status";
import type { Ticket, TicketStatus } from "@/types/domain";

const OPEN = "ABIERTOS";
const ALL = "TODOS";
type StatusFilter = typeof OPEN | typeof ALL | TicketStatus;

const STATUS_OPTIONS: TicketStatus[] = [...MAIN_FLOW, "NO_PROCEDE"];

interface Row {
  ticket: Ticket;
  place: string;
  unit: string;
  category: string;
  crew: string;
  zoneId: string;
  owner: string;
  days: number;
}

/** Bandeja del encargado: solo los tickets de las obras de sus zonas. */
export function EncargadoInbox() {
  const { user } = useSession();
  const api = useDataApi();
  const zoneIds = user?.zoneIds;

  const { data: tickets } = useQuery(
    useCallback(async () => (zoneIds ? api.getTicketsByZones(zoneIds) : []), [api, zoneIds]),
  );
  const { data: units } = useQuery(api.getUnits);
  const { data: projects } = useQuery(api.getProjects);
  const { data: categories } = useQuery(api.getCategories);
  const { data: crews } = useQuery(api.getCrews);
  const { data: zones } = useQuery(api.getZones);
  const { data: users } = useQuery(api.getUsers);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>(OPEN);
  const [zone, setZone] = useState("");

  const rows = useMemo<Row[] | undefined>(() => {
    if (!tickets || !units || !projects || !categories || !crews || !users) return undefined;
    const now = new Date();
    return tickets.map((ticket) => {
      const unit = units.find((item) => item.id === ticket.unitId);
      const project = projects.find((item) => item.id === unit?.projectId);
      return {
        ticket,
        place: project?.name ?? "—",
        unit: unit ? unitLabel(unit) : "—",
        category: categories.find((item) => item.id === ticket.categoryId)?.name ?? "—",
        crew: crews.find((item) => item.id === ticket.crewId)?.name ?? "Sin asignar",
        zoneId: project?.zoneId ?? "",
        owner: users.find((item) => item.id === unit?.ownerId)?.name ?? "",
        days: daysOpen(ticket, now),
      };
    });
  }, [tickets, units, projects, categories, crews, users]);

  const filtered = useMemo(() => {
    if (!rows) return undefined;
    const term = search.trim().toLocaleLowerCase("es");
    return rows.filter((row) => {
      if (status === OPEN && isClosed(row.ticket.status)) return false;
      if (status !== OPEN && status !== ALL && row.ticket.status !== status) return false;
      if (zone && row.zoneId !== zone) return false;
      if (!term) return true;
      return [row.ticket.folio, row.place, row.unit, row.owner].some((value) => value.toLocaleLowerCase("es").includes(term));
    });
  }, [rows, search, status, zone]);

  const openCount = rows?.filter((row) => !isClosed(row.ticket.status)).length ?? 0;
  const newCount = rows?.filter((row) => row.ticket.status === "INGRESADO").length ?? 0;
  const receptionCount = rows?.filter((row) => row.ticket.status === "EN_RECEPCION").length ?? 0;
  const myZones = zones?.filter((item) => zoneIds?.includes(item.id)) ?? [];

  return (
    <div className="pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Requerimientos</h1>
          <p className="mt-1 text-sm text-ink-secondary" aria-live="polite">
            {rows === undefined
              ? "Cargando…"
              : [
                  `${openCount} ${openCount === 1 ? "abierto" : "abiertos"} en tus zonas`,
                  newCount > 0 && `${newCount} por revisar`,
                  receptionCount > 0 && `${receptionCount} esperando conformidad`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
        <span aria-hidden className="mb-1 hidden h-1 w-24 rounded-pill bg-brand-orange sm:block" />
      </header>

      <div className="mt-6 grid gap-4 rounded-lg border border-line-soft bg-surface p-4 sm:p-5 md:grid-cols-[1fr_12rem_12rem]">
        <Input
          label="Buscar"
          name="search"
          type="search"
          placeholder="Folio, obra, unidad o propietario"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select label="Estado" name="status" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value={OPEN}>Abiertos</option>
          <option value={ALL}>Todos</option>
          {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
        </Select>
        <Select label="Zona" name="zone" value={zone} disabled={myZones.length < 2} onChange={(event) => setZone(event.target.value)}>
          {myZones.length !== 1 && <option value="">Todas mis zonas</option>}
          {myZones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </div>

      {filtered === undefined ? (
        <p className="mt-6 text-sm text-ink-secondary" role="status">Cargando requerimientos…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-lg border border-line-soft bg-surface p-8 text-center">
          <p className="font-bold text-ink">No hay requerimientos con estos filtros</p>
          <p className="mt-1 text-sm text-ink-secondary">Prueba con otro estado o borra la búsqueda.</p>
        </div>
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <ul className="mt-6 flex flex-col gap-3 md:hidden">
            {filtered.map((row) => (
              <li key={row.ticket.id}>
                <Link href={`/encargado/tickets/${row.ticket.id}`} className="block rounded-lg border border-line-soft bg-surface p-4 transition-colors hover:border-accent/40">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-bold text-accent">{row.ticket.folio}</span>
                    <span className="text-xs text-ink-meta">{row.days} {row.days === 1 ? "día" : "días"}</span>
                  </div>
                  <p className="mt-1 font-bold text-ink">{row.place} · {row.unit}</p>
                  <p className="text-sm text-ink-secondary">{row.category} · {row.crew}</p>
                  <StatusBadge status={row.ticket.status} className="mt-3" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-line-soft bg-surface px-6 py-2 md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line-soft text-ink">
                  <th scope="col" className="py-4 pr-4 font-bold">Folio</th>
                  <th scope="col" className="py-4 pr-4 font-bold">Obra y unidad</th>
                  <th scope="col" className="py-4 pr-4 font-bold">Categoría</th>
                  <th scope="col" className="py-4 pr-4 font-bold">Estado</th>
                  <th scope="col" className="py-4 pr-4 text-right font-bold">Días abierto</th>
                  <th scope="col" className="py-4 pl-4 font-bold">Equipo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.ticket.id} className="border-b border-line-soft last:border-b-0 hover:bg-surface-warm">
                    <td className="py-4 pr-4">
                      <Link href={`/encargado/tickets/${row.ticket.id}`} className="font-bold text-accent underline underline-offset-2">
                        {row.ticket.folio}
                      </Link>
                    </td>
                    <td className="py-4 pr-4 text-ink">{row.place} · {row.unit}</td>
                    <td className="py-4 pr-4 text-ink">{row.category}</td>
                    <td className="py-4 pr-4"><StatusBadge status={row.ticket.status} /></td>
                    <td className="py-4 pr-4 text-right tabular-nums text-ink">{row.days}</td>
                    <td className="py-4 pl-4 text-ink">{row.crew}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
