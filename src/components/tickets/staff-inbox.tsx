"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ContentSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { daysOpen, unitLabel } from "@/lib/format";
import { isClosed, MAIN_FLOW, STATUS_LABEL } from "@/lib/ticket-status";
import type { Ticket, TicketStatus } from "@/types/domain";

const OPEN = "ABIERTOS";
const ALL = "TODOS";
const SPECIAL = "CASOS_ESPECIALES";
type StatusFilter = typeof OPEN | typeof ALL | typeof SPECIAL | TicketStatus;

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

interface StaffInboxProps {
  /** Ruta base del detalle, ej. "/encargado/tickets". */
  basePath: string;
  /** Admin: todas las zonas. Encargado: solo las suyas. */
  allZones?: boolean;
}

/** Bandeja de requerimientos del equipo Axis (encargado por zona, admin global). */
export function StaffInbox({ basePath, allZones = false }: StaffInboxProps) {
  const { user } = useSession();
  const api = useDataApi();
  const zoneIds = user?.zoneIds;

  const { data: tickets } = useQuery(
    useCallback(async () => {
      if (allZones) return (await api.getTickets()).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
      return zoneIds ? api.getTicketsByZones(zoneIds) : [];
    }, [api, zoneIds, allZones]),
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
      if (status === SPECIAL && row.ticket.specialCase === null) return false;
      if (status !== OPEN && status !== ALL && row.ticket.status !== status) return false;
      if (zone && row.zoneId !== zone) return false;
      if (!term) return true;
      return [row.ticket.folio, row.place, row.unit, row.owner].some((value) => value.toLocaleLowerCase("es").includes(term));
    });
  }, [rows, search, status, zone]);

  const openCount = rows?.filter((row) => !isClosed(row.ticket.status)).length ?? 0;
  const newCount = rows?.filter((row) => row.ticket.status === "INGRESADO").length ?? 0;
  const receptionCount = rows?.filter((row) => row.ticket.status === "EN_RECEPCION").length ?? 0;
  const myZones = zones?.filter((item) => allZones || zoneIds?.includes(item.id)) ?? [];
  const scopeLabel = allZones ? "en todas las zonas" : "en tus zonas";

  return (
    <div className="pb-8">
      <PageHeader
        title="Requerimientos"
        subtitle={
          <p aria-live="polite">
            {rows === undefined
              ? "Cargando…"
              : [
                  `${openCount} ${openCount === 1 ? "abierto" : "abiertos"} ${scopeLabel}`,
                  newCount > 0 && `${newCount} por revisar`,
                  receptionCount > 0 && `${receptionCount} esperando conformidad`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        }
        actions={<span aria-hidden className="mb-1 hidden h-1 w-24 rounded-pill bg-brand-orange sm:block" />}
      />

      <div className="mt-6 grid gap-4 rounded-lg border border-line-soft bg-surface p-4 shadow-card sm:p-5 md:grid-cols-[1fr_12rem_12rem]">
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
          <option value={SPECIAL}>Casos especiales</option>
          {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
        </Select>
        <Select label="Zona" name="zone" value={zone} disabled={myZones.length < 2} onChange={(event) => setZone(event.target.value)}>
          {myZones.length !== 1 && <option value="">{allZones ? "Todas las zonas" : "Todas mis zonas"}</option>}
          {myZones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </div>

      {filtered === undefined ? (
        <>
          <ContentSkeleton label="Cargando requerimientos…" lines={4} className="md:hidden" />
          <TableSkeleton label="Cargando requerimientos…" rows={6} className="mt-6 hidden md:block" />
        </>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-lg border border-line-soft bg-surface p-8 text-center shadow-card">
          <p className="font-bold text-ink">No hay requerimientos con estos filtros</p>
          <p className="mt-1 text-sm text-ink-secondary">Prueba con otro estado o borra la búsqueda.</p>
        </div>
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <ul className="mt-6 flex flex-col gap-3 md:hidden">
            {filtered.map((row) => (
              <li key={row.ticket.id}>
                <Link href={`${basePath}/${row.ticket.id}`} className="block rounded-lg border border-line-soft bg-surface p-4 shadow-card transition duration-150 ease-axis-out hover:border-accent/40 hover:shadow-raised active:scale-[0.99]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-bold text-accent">{row.ticket.folio}</span>
                    <span className="text-xs text-ink-meta">{row.days} {row.days === 1 ? "día" : "días"}</span>
                  </div>
                  <p className="mt-1 font-bold text-ink">{row.place} · {row.unit}</p>
                  <p className="text-sm text-ink-secondary">{row.category} · {row.crew}</p>
                  <StatusBadge status={row.ticket.status} className="mt-3" />
                  {row.ticket.specialCase && <span className="ml-2 inline-flex rounded-sm bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">Caso especial</span>}
                </Link>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-line-soft bg-surface px-6 py-2 shadow-card md:block">
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
                  <tr key={row.ticket.id} className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-surface-warm">
                    <td className="py-4 pr-4">
                      <Link href={`${basePath}/${row.ticket.id}`} className="font-bold text-accent underline underline-offset-2">
                        {row.ticket.folio}
                      </Link>
                    </td>
                    <td className="py-4 pr-4 text-ink">{row.place} · {row.unit}</td>
                    <td className="py-4 pr-4 text-ink">{row.category}</td>
                    <td className="py-4 pr-4"><StatusBadge status={row.ticket.status} />{row.ticket.specialCase && <span className="ml-2 inline-flex rounded-sm bg-accent-soft px-2 py-1 text-xs font-semibold text-accent">Caso especial</span>}</td>
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
