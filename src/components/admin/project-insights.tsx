"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CategoryBars } from "@/components/admin/category-bars";
import { StatTile } from "@/components/admin/stat-tile";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { PERIOD_LABEL, type CountRow, type Period } from "@/lib/metrics";
import { computeProjectInsights, ticketsOfProjects, type CrewPerformance } from "@/lib/project-metrics";

const PERIODS: Period[] = ["TODO", "TRIMESTRE", "MES"];
const oneDecimal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const CREW_TYPE_LABEL = { INTERNO: "Cuadrillas internas", SUBCONTRATO: "Subcontratos" } as const;

function days(value: number | null): string {
  return value === null ? "—" : oneDecimal.format(value);
}

/**
 * Indicadores de solo lectura para el administrador de obra: fallas de sus obras (incluidas las
 * entregadas) por categoría, ubicación y equipo. Sin datos personales ni acceso a los tickets.
 */
export function ProjectInsightsView() {
  const { user } = useSession();
  const api = useDataApi();
  const { data: tickets } = useQuery(api.getTickets);
  const { data: units } = useQuery(api.getUnits);
  const { data: projects } = useQuery(api.getProjects);
  const { data: categories } = useQuery(api.getCategories);
  const { data: crews } = useQuery(api.getCrews);
  const { data: history } = useQuery(api.getStatusHistory);

  const [projectFilter, setProjectFilter] = useState("");
  const [period, setPeriod] = useState<Period>("TODO");

  const myProjects = useMemo(
    () => (projects ?? []).filter((project) => user?.projectIds.includes(project.id)),
    [projects, user],
  );

  const insights = useMemo(() => {
    if (!tickets || !units || !categories || !crews || !history || !user) return undefined;
    const scope = projectFilter ? [projectFilter] : user.projectIds;
    const scoped = ticketsOfProjects(tickets, units, scope, period);
    return computeProjectInsights({ tickets: scoped, units, categories, crews, history });
  }, [tickets, units, categories, crews, history, user, projectFilter, period]);

  const subtitle = myProjects.length === 0
    ? "No tienes obras asignadas. Pide al administrador que te asigne tus obras."
    : `Solo lectura · ${myProjects.map((project) => project.name).join(", ")}`;

  return (
    <div className="pb-8">
      <PageHeader
        title="Indicadores de obra"
        subtitle={subtitle}
        actions={
          <>
            {myProjects.length > 1 && (
              <div className="w-56">
                <Select label="Obra" name="insights-project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                  <option value="">Todas mis obras</option>
                  {myProjects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </Select>
              </div>
            )}
            <div className="w-48">
              <Select label="Período" name="insights-period" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
                {PERIODS.map((item) => (
                  <option key={item} value={item}>{PERIOD_LABEL[item]}</option>
                ))}
              </Select>
            </div>
          </>
        }
      />

      {insights === undefined ? (
        <ContentSkeleton label="Calculando indicadores…" />
      ) : (
        <>
          <section aria-label="Resumen" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Requerimientos" value={String(insights.total)} />
            <StatTile label="Abiertos" value={String(insights.open)} />
            <StatTile label="Días promedio de cierre" value={days(insights.avgDaysToClose)} />
            <StatTile label="Rechazos del propietario" value={String(insights.ownerRejections)} tone="action" />
          </section>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <InsightCard title="Fallas por origen" rows={insights.byCategory} empty={insights.total === 0}>
              <CategoryBars data={insights.byCategory} />
            </InsightCard>
            <InsightCard title="Fallas por torre y piso" rows={insights.byFloor} empty={insights.total === 0}>
              <CategoryBars data={insights.byFloor.slice(0, 10)} />
            </InsightCard>
          </div>

          <section className="mt-6 rounded-lg border border-line-soft bg-surface p-6 shadow-card">
            <h2 className="text-lg text-ink">Desempeño por equipo de trabajo</h2>
            <p className="mt-1 text-sm text-ink-secondary">Rechazos: veces que el propietario no quedó conforme y el trabajo se reprogramó.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(["INTERNO", "SUBCONTRATO"] as const).map((type) => {
                const row = insights.byCrewType[type];
                return (
                  <div key={type} className="rounded-md bg-surface-secondary p-4 text-sm">
                    <p className="font-bold text-ink">{CREW_TYPE_LABEL[type]}</p>
                    <p className="mt-1 text-ink-secondary">
                      {row.handled} atendidos · {row.closed} cerrados · {days(row.avgDaysToClose)} días promedio · {row.ownerRejections} rechazos
                    </p>
                  </div>
                );
              })}
            </div>
            <CrewTable rows={insights.crews} />
          </section>
        </>
      )}
    </div>
  );
}

function InsightCard({ title, rows, empty, children }: { title: string; rows: CountRow[]; empty: boolean; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line-soft bg-surface p-6 shadow-card">
      <h2 className="text-lg text-ink">{title}</h2>
      <div className="mt-4">
        {empty ? <p className="py-10 text-center text-sm text-ink-secondary">Sin requerimientos en este período.</p> : children}
      </div>
      {!empty && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-bold text-accent">Ver como tabla</summary>
          <table className="mt-3 w-full text-left">
            <thead>
              <tr className="border-b border-line-soft">
                <th scope="col" className="py-2 font-bold text-ink">Detalle</th>
                <th scope="col" className="py-2 text-right font-bold text-ink">Requerimientos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line-soft last:border-b-0">
                  <td className="py-2 text-ink">{row.label}</td>
                  <td className="py-2 text-right tabular-nums text-ink">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

function CrewTable({ rows }: { rows: CrewPerformance[] }) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-ink-secondary">Aún no hay requerimientos con equipo asignado en estas obras.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line-soft">
            <th scope="col" className="py-3 pr-4 font-bold text-ink">Equipo</th>
            <th scope="col" className="py-3 pr-4 font-bold text-ink">Tipo</th>
            <th scope="col" className="py-3 pr-4 text-right font-bold text-ink">Atendidos</th>
            <th scope="col" className="py-3 pr-4 text-right font-bold text-ink">Cerrados</th>
            <th scope="col" className="py-3 pr-4 text-right font-bold text-ink">Días prom. cierre</th>
            <th scope="col" className="py-3 text-right font-bold text-ink">Rechazos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line-soft last:border-b-0">
              <td className="py-3 pr-4 font-bold text-ink">{row.name}</td>
              <td className="py-3 pr-4 text-ink-secondary">{row.type === "INTERNO" ? "Interno" : "Subcontrato"}</td>
              <td className="py-3 pr-4 text-right tabular-nums text-ink">{row.handled}</td>
              <td className="py-3 pr-4 text-right tabular-nums text-ink">{row.closed}</td>
              <td className="py-3 pr-4 text-right tabular-nums text-ink">{days(row.avgDaysToClose)}</td>
              <td className="py-3 text-right tabular-nums text-ink">{row.ownerRejections}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
