"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CategoryBars } from "@/components/admin/category-bars";
import { StatTile } from "@/components/admin/stat-tile";
import { TrendChart } from "@/components/tickets/trend-chart";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { formatShortDate, unitLabel } from "@/lib/format";
import type { CountRow } from "@/lib/metrics";
import {
  computeZoneStats,
  DEFAULT_FILTERS,
  STALE_DAYS,
  STATS_PERIOD_LABEL,
  STATS_PERIODS,
  STATUS_GROUP_LABEL,
  type StatsFilters,
  type StatusGroup,
} from "@/lib/zone-stats";

const oneDecimal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const rangeDate = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" });
const TABLE_LIMIT = 50;

function days(value: number | null): string {
  return value === null ? "—" : oneDecimal.format(value);
}

/** Tablero del encargado zonal: estadísticas del período con filtros y descarga a Excel. */
export function ZoneDashboard() {
  const { user } = useSession();
  const api = useDataApi();
  const zoneIds = user?.zoneIds;

  const { data: tickets } = useQuery(
    useCallback(async () => (zoneIds ? api.getTicketsByZones(zoneIds) : []), [api, zoneIds]),
  );
  const { data: history } = useQuery(api.getStatusHistory);
  const { data: units } = useQuery(api.getUnits);
  const { data: projects } = useQuery(api.getProjects);
  const { data: zones } = useQuery(api.getZones);
  const { data: categories } = useQuery(api.getCategories);
  const { data: crews } = useQuery(api.getCrews);

  const [filters, setFilters] = useState<StatsFilters>(DEFAULT_FILTERS);
  const [exporting, setExporting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const set = <K extends keyof StatsFilters>(key: K, value: StatsFilters[K]) => {
    setShowAll(false);
    setFilters((current) => ({ ...current, [key]: value, ...(key === "zoneId" ? { projectId: "" } : {}) }));
  };

  const myZones = useMemo(() => (zones ?? []).filter((zone) => zoneIds?.includes(zone.id)), [zones, zoneIds]);
  const myProjects = useMemo(
    () => (projects ?? []).filter((project) => zoneIds?.includes(project.zoneId) && (!filters.zoneId || project.zoneId === filters.zoneId)),
    [projects, zoneIds, filters.zoneId],
  );
  const myCrews = useMemo(() => (crews ?? []).filter((crew) => zoneIds?.includes(crew.zoneId)), [crews, zoneIds]);

  const stats = useMemo(() => {
    if (!tickets || !history || !units || !projects || !categories || !crews) return undefined;
    return computeZoneStats(filters, { tickets, history, units, projects, categories, crews });
  }, [filters, tickets, history, units, projects, categories, crews]);

  const zoneName = filters.zoneId ? myZones.find((zone) => zone.id === filters.zoneId)?.name ?? "" : myZones.map((zone) => zone.name).join(" y ");
  const range = stats?.start ? `${rangeDate.format(stats.start)} – ${rangeDate.format(stats.end)}` : "Desde el primer requerimiento";
  const filtered = filters.projectId || filters.categoryId || filters.crewId || filters.status !== "TODOS" || filters.zoneId;

  async function handleExport() {
    if (!stats || !user) return;
    setExporting(true);
    try {
      const { exportZoneStatsToExcel } = await import("@/lib/export-zone-stats");
      await exportZoneStatsToExcel({
        stats,
        filters,
        encargado: user.name,
        filterNames: {
          zone: zoneName || "Mis zonas",
          project: myProjects.find((item) => item.id === filters.projectId)?.name ?? "Todas",
          category: categories?.find((item) => item.id === filters.categoryId)?.name ?? "Todos",
          crew: myCrews.find((item) => item.id === filters.crewId)?.name ?? "Todos",
        },
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Estadísticas"
        subtitle={`${zoneName || "Mis zonas"} · ${range}`}
        actions={
          <Button variant="secondary" disabled={exporting || !stats} onClick={handleExport}>
            {exporting ? "Preparando Excel…" : "Descargar Excel"}
          </Button>
        }
      />

      <section aria-label="Filtros" className="mt-6 rounded-lg border border-line-soft bg-surface p-4 shadow-card">
        <fieldset className="flex flex-wrap gap-2" aria-label="Período">
          <legend className="sr-only">Período</legend>
          {STATS_PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              aria-pressed={filters.period === period}
              className={
                filters.period === period
                  ? "rounded-pill bg-accent px-4 py-2 text-sm font-bold text-white"
                  : "rounded-pill border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
              }
              onClick={() => set("period", period)}
            >
              {STATS_PERIOD_LABEL[period]}
            </button>
          ))}
        </fieldset>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {myZones.length > 1 && (
            <Select label="Zona" name="stats-zone" value={filters.zoneId} onChange={(event) => set("zoneId", event.target.value)}>
              <option value="">Todas mis zonas</option>
              {myZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
            </Select>
          )}
          <Select label="Obra" name="stats-project" value={filters.projectId} onChange={(event) => set("projectId", event.target.value)}>
            <option value="">Todas las obras</option>
            {myProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </Select>
          <Select label="Origen de la falla" name="stats-category" value={filters.categoryId} onChange={(event) => set("categoryId", event.target.value)}>
            <option value="">Todos los orígenes</option>
            {(categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
          <Select label="Equipo" name="stats-crew" value={filters.crewId} onChange={(event) => set("crewId", event.target.value)}>
            <option value="">Todos los equipos</option>
            {myCrews.map((crew) => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
          </Select>
          <Select label="Estado" name="stats-status" value={filters.status} onChange={(event) => set("status", event.target.value as StatusGroup)}>
            {(Object.keys(STATUS_GROUP_LABEL) as StatusGroup[]).map((group) => <option key={group} value={group}>{STATUS_GROUP_LABEL[group]}</option>)}
          </Select>
        </div>
        {filtered && (
          <button
            type="button"
            className="mt-3 text-sm font-bold text-accent hover:underline"
            onClick={() => setFilters((current) => ({ ...DEFAULT_FILTERS, period: current.period }))}
          >
            Quitar filtros
          </button>
        )}
      </section>

      {stats === undefined ? (
        <ContentSkeleton label="Calculando estadísticas…" className="mt-6" />
      ) : (
        <>
          <section aria-label="Resumen" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Ingresados en el período" value={String(stats.ingresados)} />
            <StatTile label="Abiertos" value={String(stats.abiertos)} />
            <StatTile label={`Abiertos hace más de ${STALE_DAYS} días`} value={String(stats.atrasados)} tone="action" />
            <StatTile label="Cierres conformes en el período" value={String(stats.cerradosEnPeriodo)} />
            <StatTile label="Días promedio hasta la visita" value={days(stats.avgDaysToVisit)} />
            <StatTile label="Días promedio de cierre" value={days(stats.avgDaysToClose)} />
            <StatTile label="Esperando conformidad" value={String(stats.enRecepcion)} tone="action" />
            <StatTile label="No procede" value={String(stats.noProcede)} />
          </section>
          <p className="mt-3 text-sm text-ink-secondary">
            {stats.casosEspeciales} {stats.casosEspeciales === 1 ? "caso especial" : "casos especiales"} ·{" "}
            {stats.reclasificados} con origen reclasificado en la visita · {stats.ownerRejections}{" "}
            {stats.ownerRejections === 1 ? "rechazo" : "rechazos"} del propietario en la recepción
          </p>

          <section className="mt-6 rounded-lg border border-line-soft bg-surface p-6 shadow-card">
            <h2 className="text-lg text-ink">Ingresados y cerrados</h2>
            <p className="mb-4 mt-1 text-sm text-ink-secondary">
              {filters.period === "SEMANA" || filters.period === "DOS_SEMANAS" ? "Por día" : filters.period === "TODO" ? "Por mes" : "Por semana (desde el día indicado)"}
            </p>
            <TrendChart data={stats.trend} />
          </section>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <BreakdownCard title="Por estado" rows={stats.byStatus} />
            <BreakdownCard title="Por origen de la falla" rows={stats.byCategory} />
            <BreakdownCard title="Por obra" rows={stats.byProject} />
            <BreakdownCard title="Por equipo" rows={stats.byCrew} />
          </div>

          <section className="mt-6 rounded-lg border border-line-soft bg-surface p-6 shadow-card">
            <h2 className="text-lg text-ink">Requerimientos del período</h2>
            {stats.rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-secondary">No hay requerimientos con estos filtros.</p>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[52rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line-soft">
                        <th scope="col" className="py-3 pr-4 font-bold text-ink">Folio</th>
                        <th scope="col" className="py-3 pr-4 font-bold text-ink">Ingresado</th>
                        <th scope="col" className="py-3 pr-4 font-bold text-ink">Obra y unidad</th>
                        <th scope="col" className="py-3 pr-4 font-bold text-ink">Origen</th>
                        <th scope="col" className="py-3 pr-4 font-bold text-ink">Equipo</th>
                        <th scope="col" className="py-3 pr-4 font-bold text-ink">Estado</th>
                        <th scope="col" className="py-3 text-right font-bold text-ink">Días</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAll ? stats.rows : stats.rows.slice(0, TABLE_LIMIT)).map((row) => (
                        <tr key={row.ticket.id} className="border-b border-line-soft last:border-b-0">
                          <td className="py-3 pr-4">
                            <Link href={`/encargado/tickets/${row.ticket.id}`} className="font-bold text-accent hover:underline">{row.ticket.folio}</Link>
                          </td>
                          <td className="py-3 pr-4 text-ink-secondary">{formatShortDate(row.ticket.createdAt)}</td>
                          <td className="py-3 pr-4 text-ink">{row.project}{row.unit ? ` · ${unitLabel(row.unit)}` : ""}</td>
                          <td className="py-3 pr-4 text-ink">{row.category}</td>
                          <td className="py-3 pr-4 text-ink-secondary">{row.crew}</td>
                          <td className="py-3 pr-4"><StatusBadge status={row.ticket.status} /></td>
                          <td className="py-3 text-right tabular-nums text-ink">{Math.floor(row.days)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {stats.rows.length > TABLE_LIMIT && !showAll && (
                  <button type="button" className="mt-4 text-sm font-bold text-accent hover:underline" onClick={() => setShowAll(true)}>
                    Mostrar los {stats.rows.length} requerimientos
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: CountRow[] }): ReactNode {
  return (
    <section className="rounded-lg border border-line-soft bg-surface p-6 shadow-card">
      <h2 className="text-lg text-ink">{title}</h2>
      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-secondary">Sin requerimientos en este período.</p>
        ) : (
          <CategoryBars data={rows} />
        )}
      </div>
    </section>
  );
}
