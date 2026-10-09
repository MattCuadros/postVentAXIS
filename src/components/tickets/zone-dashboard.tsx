"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CategoryBars } from "@/components/admin/category-bars";
import { StatTile } from "@/components/admin/stat-tile";
import { TrendChart } from "@/components/tickets/trend-chart";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDataApi } from "@/data/api";
import { sendReportEmail, type SendReportEmailResult } from "@/data/email";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { formatShortDate, unitLabel } from "@/lib/format";
import type { CountRow } from "@/lib/metrics";
import { ownerLabel, PROJECT_TYPES, PROJECT_TYPE_LABEL } from "@/lib/project-types";
import {
  computeZoneStats,
  DEFAULT_FILTERS,
  STALE_DAYS,
  STATS_PERIOD_LABEL,
  STATS_PERIODS,
  STATUS_GROUP_LABEL,
  rowsForStat,
  STAT_KEYS,
  type StatKey,
  type StatsFilters,
  type StatusGroup,
} from "@/lib/zone-stats";
import { parseRecipients } from "@/lib/report-email-schema";

const oneDecimal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const rangeDate = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" });
const TABLE_LIMIT = 50;
const STAT_LABELS: Record<StatKey, string> = { ingresados: "Ingresados en el período", abiertos: "Abiertos", atrasados: `Abiertos hace más de ${STALE_DAYS} días`, cerradosEnPeriodo: "Cierres conformes en el período", diasVisita: "Días promedio hasta la visita", diasCierre: "Días promedio de cierre", enRecepcion: "Esperando conformidad", noProcede: "No procede" };

function days(value: number | null): string {
  return value === null ? "—" : oneDecimal.format(value);
}

/** Tablero del encargado zonal: estadísticas del período con filtros y descarga a Excel. */
export function ZoneDashboard() {
  const { user } = useSession();
  const api = useDataApi();
  const zoneIds = user?.zoneIds;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tableHeading = useRef<HTMLHeadingElement>(null);

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
  const [pdfBusy, setPdfBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [recipientText, setRecipientText] = useState("");
  const [recipientError, setRecipientError] = useState("");
  const [emailNotice, setEmailNotice] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  const [recentRecipients, setRecentRecipients] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [requestedStat, setSelectedStat] = useState<StatKey | null>(() => STAT_KEYS.find((key) => key === searchParams.get("ver")) ?? null);
  const set = <K extends keyof StatsFilters>(key: K, value: StatsFilters[K]) => {
    setShowAll(false);
    setFilters((current) => ({ ...current, [key]: value, ...(key === "zoneId" || key === "projectType" ? { projectId: "" } : {}) }));
  };

  const myZones = useMemo(() => (zones ?? []).filter((zone) => zoneIds?.includes(zone.id)), [zones, zoneIds]);
  const myProjects = useMemo(
    () => (projects ?? []).filter((project) => zoneIds?.includes(project.zoneId) && (!filters.zoneId || project.zoneId === filters.zoneId) && (!filters.projectType || project.type === filters.projectType)),
    [projects, zoneIds, filters.zoneId, filters.projectType],
  );
  const myCrews = useMemo(() => (crews ?? []).filter((crew) => zoneIds?.includes(crew.zoneId)), [crews, zoneIds]);

  const stats = useMemo(() => {
    if (!tickets || !history || !units || !projects || !categories || !crews) return undefined;
    return computeZoneStats(filters, { tickets, history, units, projects, categories, crews });
  }, [filters, tickets, history, units, projects, categories, crews]);

  const zoneName = filters.zoneId ? myZones.find((zone) => zone.id === filters.zoneId)?.name ?? "" : myZones.map((zone) => zone.name).join(" y ");
  const range = stats?.start ? `${rangeDate.format(stats.start)} – ${rangeDate.format(stats.end)}` : "Desde el primer requerimiento";
  const personRole = filters.projectId
    ? ownerLabel(projects?.find((project) => project.id === filters.projectId)?.type ?? "HABITACIONAL_ALTURA").toLocaleLowerCase("es")
    : "propietario / administrador";
  // Una tarjeta que queda sin requerimientos deja de estar seleccionada (se deriva, no se corrige con un efecto).
  const selectedStat = requestedStat && stats && rowsForStat(requestedStat, stats).length > 0 ? requestedStat : null;
  const shownRows = stats && selectedStat ? rowsForStat(selectedStat, stats) : stats?.rows ?? [];
  const selectedLabel = selectedStat ? STAT_LABELS[selectedStat] : "";
  useEffect(() => { const params = new URLSearchParams(searchParams.toString()); if (requestedStat) params.set("ver", requestedStat); else params.delete("ver"); const query = params.toString(); if (query !== searchParams.toString()) router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }); }, [requestedStat, router, pathname, searchParams]);
  useEffect(() => { if (!selectedStat) return; tableHeading.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); tableHeading.current?.focus({ preventScroll: true }); }, [selectedStat]);
  const toggleStat = (key: StatKey) => { setSelectedStat((current) => current === key ? null : key); setShowAll(false); };
  const filtered = filters.projectId || filters.projectType || filters.categoryId || filters.crewId || filters.status !== "TODOS" || filters.zoneId;

  function exportContext() {
    if (!stats || !user) return null;
    return { stats, filters, encargado: user.name, filterNames: {
      zone: zoneName || "Mis zonas", project: myProjects.find((item) => item.id === filters.projectId)?.name ?? "Todas",
      category: categories?.find((item) => item.id === filters.categoryId)?.name ?? "Todos", crew: myCrews.find((item) => item.id === filters.crewId)?.name ?? "Todos",
    } };
  }

  async function createPdf() {
    const ctx = exportContext();
    if (!ctx) return null;
    const response = await fetch("/api/reports/pdf", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      filters: ctx.filters, filterNames: ctx.filterNames, encargado: ctx.encargado,
      stats: {
        start: ctx.stats.start?.toISOString() ?? null, end: ctx.stats.end.toISOString(), ingresados: ctx.stats.ingresados, abiertos: ctx.stats.abiertos, atrasados: ctx.stats.atrasados, cerradosEnPeriodo: ctx.stats.cerradosEnPeriodo,
        avgDaysToVisit: ctx.stats.avgDaysToVisit, avgDaysToClose: ctx.stats.avgDaysToClose, enRecepcion: ctx.stats.enRecepcion, noProcede: ctx.stats.noProcede, cerrados: ctx.stats.cerrados, casosEspeciales: ctx.stats.casosEspeciales, reclasificados: ctx.stats.reclasificados, ownerRejections: ctx.stats.ownerRejections,
        byStatus: ctx.stats.byStatus, byCategory: ctx.stats.byCategory, byProject: ctx.stats.byProject, byCrew: ctx.stats.byCrew,
        rows: ctx.stats.rows.map((row) => ({ folio: row.ticket.folio, unit: row.unit ? unitLabel(row.unit) : "Sin unidad", days: row.days, status: row.ticket.status })),
      },
    }) });
    if (!response.ok) throw new Error("No se pudo generar el informe PDF");
    return { bytes: new Uint8Array(await response.arrayBuffer()), filename: response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "estadisticas-postventaxis.pdf" };
  }

  async function handlePdfDownload() {
    setPdfBusy(true);
    try {
      const result = await createPdf();
      if (!result) return;
      const url = URL.createObjectURL(new Blob([Uint8Array.from(result.bytes).buffer], { type: "application/pdf" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url);
    } finally { setPdfBusy(false); }
  }

  async function handleEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setRecipientError(""); setEmailNotice(null);
    const parsed = parseRecipients(recipientText);
    if (!parsed.success) { setRecipientError("Ingresa entre 1 y 5 correos válidos, separados por coma o punto y coma."); return; }
    setEmailBusy(true);
    try {
      const pdf = await createPdf(); const ctx = exportContext();
      if (!pdf || !ctx) return;
      const { zoneStatsSummary } = await import("@/lib/export-zone-stats");
      const summary = zoneStatsSummary(ctx);
      const result: SendReportEmailResult = await sendReportEmail({ to: parsed.data, ...summary, attachment: { filename: pdf.filename, content: btoa(String.fromCharCode(...pdf.bytes)) } });
      if (result.ok) {
        setRecipientText(""); setEmailNotice({ tone: "success", text: `Informe enviado a ${parsed.data.join(", ")}.` });
        const updated = [...parsed.data, ...recentRecipients.filter((email) => !parsed.data.includes(email))].slice(0, 5);
        setRecentRecipients(updated);
        try { localStorage.setItem(`postventaxis:destinatarios:${user?.id}`, JSON.stringify(updated)); } catch { /* almacenamiento opcional */ }
      } else if (result.reason === "NO_DISPONIBLE") {
        const url = URL.createObjectURL(new Blob([Uint8Array.from(pdf.bytes).buffer], { type: "application/pdf" }));
        const anchor = document.createElement("a"); anchor.href = url; anchor.download = pdf.filename; anchor.click(); URL.revokeObjectURL(url);
        const maxText = 1800; const mailText = summary.text.length > maxText ? `${summary.text.slice(0, maxText - 55)}\n(resumen recortado; ver PDF adjunto)` : summary.text;
        window.location.href = `mailto:${encodeURIComponent(parsed.data.join(","))}?subject=${encodeURIComponent(summary.subject)}&body=${encodeURIComponent(mailText)}`;
        setEmailNotice({ tone: "info", text: "Te descargamos el informe y abrimos tu correo con el mensaje listo. Adjunta el archivo descargado antes de enviar." });
      } else setEmailNotice({ tone: "danger", text: result.reason === "RECHAZADO" ? "No pudimos enviar a esa dirección. Revísala e intenta de nuevo." : "No pudimos conectar con el servicio de correo. Intenta de nuevo." });
    } finally { setEmailBusy(false); }
  }

  async function handleExport() {
    if (!stats || !user) return;
    setExporting(true);
    try {
      const { exportZoneStatsToExcel } = await import("@/lib/export-zone-stats");
      const ctx = exportContext();
      if (ctx) await exportZoneStatsToExcel(ctx);
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="secondary" disabled={pdfBusy || !stats} onClick={handlePdfDownload}>{pdfBusy ? "Preparando PDF…" : "Descargar PDF"}</Button>
            <Button variant="secondary" disabled={exporting || !stats} onClick={handleExport}>{exporting ? "Preparando Excel…" : "Descargar Excel"}</Button>
          </div>
        }
      />

      <section className="mt-4 rounded-lg border border-line-soft bg-surface p-4 shadow-card">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleEmail} noValidate>
          <div className="min-w-0 flex-1">
            <label htmlFor="stats-recipients" className="mb-1 block text-sm font-bold text-ink">Enviar a</label>
            <input id="stats-recipients" type="email" multiple list="stats-recent-recipients" placeholder="correo@axisdc.cl" value={recipientText} onChange={(event) => { setRecipientText(event.target.value); setRecipientError(""); }} aria-invalid={Boolean(recipientError)} aria-describedby={recipientError ? "stats-recipients-error" : undefined} className="min-h-11 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
            {user && <RecentRecipients userId={user.id} onLoad={setRecentRecipients} />}
            <datalist id="stats-recent-recipients">{recentRecipients.map((email) => <option key={email} value={email} />)}</datalist>
            {recipientError && <p id="stats-recipients-error" className="mt-1 text-sm text-danger">{recipientError}</p>}
          </div>
          <Button type="submit" variant="secondary" disabled={emailBusy || !stats}>{emailBusy ? "Enviando…" : "Enviar"}</Button>
        </form>
        {emailNotice && <Notice tone={emailNotice.tone} className="mt-3">{emailNotice.text}</Notice>}
      </section>

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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {myZones.length > 1 && (
            <Select label="Zona" name="stats-zone" value={filters.zoneId} onChange={(event) => set("zoneId", event.target.value)}>
              <option value="">Todas mis zonas</option>
              {myZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
            </Select>
          )}
          <Select label="Tipo de obra" name="stats-project-type" value={filters.projectType ?? ""} onChange={(event) => set("projectType", event.target.value)}>
            <option value="">Todos los tipos</option>
            {PROJECT_TYPES.map((type) => <option key={type} value={type}>{PROJECT_TYPE_LABEL[type]}</option>)}
          </Select>
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
            <StatTile label="Ingresados en el período" value={String(stats.ingresados)} onSelect={() => toggleStat("ingresados")} selected={selectedStat === "ingresados"} />
            <StatTile label="Abiertos" value={String(stats.abiertos)} onSelect={() => toggleStat("abiertos")} selected={selectedStat === "abiertos"} />
            <StatTile label={`Abiertos hace más de ${STALE_DAYS} días`} value={String(stats.atrasados)} tone="action" onSelect={() => toggleStat("atrasados")} selected={selectedStat === "atrasados"} />
            <StatTile label="Cierres conformes en el período" value={String(stats.cerradosEnPeriodo)} onSelect={() => toggleStat("cerradosEnPeriodo")} selected={selectedStat === "cerradosEnPeriodo"} />
            <StatTile label="Días promedio hasta la visita" value={days(stats.avgDaysToVisit)} onSelect={stats.avgDaysToVisit === null ? undefined : () => toggleStat("diasVisita")} selected={selectedStat === "diasVisita"} />
            <StatTile label="Días promedio de cierre" value={days(stats.avgDaysToClose)} onSelect={stats.avgDaysToClose === null ? undefined : () => toggleStat("diasCierre")} selected={selectedStat === "diasCierre"} />
            <StatTile label="Esperando conformidad" value={String(stats.enRecepcion)} tone="action" onSelect={() => toggleStat("enRecepcion")} selected={selectedStat === "enRecepcion"} />
            <StatTile label="No procede" value={String(stats.noProcede)} onSelect={() => toggleStat("noProcede")} selected={selectedStat === "noProcede"} />
          </section>
          <p className="mt-3 text-sm text-ink-secondary">
            {stats.casosEspeciales} {stats.casosEspeciales === 1 ? "caso especial" : "casos especiales"} ·{" "}
            {stats.reclasificados} con origen reclasificado en la visita · {stats.ownerRejections}{" "}
            {stats.ownerRejections === 1 ? "rechazo" : "rechazos"} de {personRole} en la recepción
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
            <h2 ref={tableHeading} tabIndex={-1} className="text-lg text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{selectedStat ? `Requerimientos: ${selectedLabel}` : "Requerimientos del período"}</h2>
            {selectedStat && <p className="mt-2 text-sm text-ink-secondary">Mostrando: <strong>{selectedLabel}</strong> ({shownRows.length}) · <button type="button" className="font-bold text-accent hover:underline" onClick={() => { setSelectedStat(null); setShowAll(false); }}>Ver todos</button></p>}
            {shownRows.length === 0 ? (
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
                        <th scope="col" className="py-3 text-right font-bold text-ink">{selectedStat === "diasVisita" ? "Días hasta la visita" : "Días"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAll ? shownRows : shownRows.slice(0, TABLE_LIMIT)).map((row) => (
                        <tr key={row.ticket.id} className="border-b border-line-soft last:border-b-0">
                          <td className="py-3 pr-4">
                            <Link href={`/encargado/tickets/${row.ticket.id}`} className="font-bold text-accent hover:underline">{row.ticket.folio}</Link>
                          </td>
                          <td className="py-3 pr-4 text-ink-secondary">{formatShortDate(row.ticket.createdAt)}</td>
                          <td className="py-3 pr-4 text-ink">{row.project}{row.unit ? ` · ${unitLabel(row.unit)}` : ""}</td>
                          <td className="py-3 pr-4 text-ink">{row.category}</td>
                          <td className="py-3 pr-4 text-ink-secondary">{row.crew}</td>
                          <td className="py-3 pr-4"><StatusBadge status={row.ticket.status} /></td>
                          <td className="py-3 text-right tabular-nums text-ink">{Math.floor(selectedStat === "diasVisita" ? row.daysToVisit ?? row.days : row.days)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {shownRows.length > TABLE_LIMIT && !showAll && (
                  <button type="button" className="mt-4 text-sm font-bold text-accent hover:underline" onClick={() => setShowAll(true)}>
                    Mostrar los {shownRows.length} requerimientos
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

function RecentRecipients({ userId, onLoad }: { userId: string; onLoad: (emails: string[]) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(`postventaxis:destinatarios:${userId}`) ?? "[]");
        onLoad(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 5) : []);
      } catch { onLoad([]); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId, onLoad]);
  return null;
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
