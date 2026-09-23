"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CategoryBars } from "@/components/admin/category-bars";
import { StatTile } from "@/components/admin/stat-tile";
import { ZoneChart } from "@/components/admin/zone-chart";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { exportTicketsToExcel } from "@/lib/export-tickets";
import { computeIndicators, PERIOD_LABEL, type CountRow, type Period } from "@/lib/metrics";

const PERIODS: Period[] = ["MES", "TRIMESTRE", "TODO"];
const oneDecimal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export default function IndicadoresPage() {
  const api = useDataApi();
  const { data: tickets } = useQuery(api.getTickets);
  const { data: history } = useQuery(api.getStatusHistory);
  const { data: units } = useQuery(api.getUnits);
  const { data: projects } = useQuery(api.getProjects);
  const { data: zones } = useQuery(api.getZones);
  const { data: categories } = useQuery(api.getCategories);
  const { data: users } = useQuery(api.getUsers);
  const { data: crews } = useQuery(api.getCrews);

  const [period, setPeriod] = useState<Period>("MES");
  const [exporting, setExporting] = useState(false);

  const indicators = useMemo(() => {
    if (!tickets || !history || !units || !projects || !zones || !categories) return undefined;
    return computeIndicators(period, { tickets, history, units, projects, zones, categories });
  }, [period, tickets, history, units, projects, zones, categories]);

  const periodCaption = period === "MES"
    ? new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date())
    : PERIOD_LABEL[period];

  async function handleExport() {
    if (!tickets || !units || !projects || !zones || !categories || !users || !crews) return;
    setExporting(true);
    try {
      await exportTicketsToExcel({ tickets, units, projects, zones, categories, users, crews });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Indicadores</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {periodCaption.charAt(0).toUpperCase() + periodCaption.slice(1)}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-44">
            <Select label="Período" name="period" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
              {PERIODS.map((item) => <option key={item} value={item}>{PERIOD_LABEL[item]}</option>)}
            </Select>
          </div>
          <Button variant="secondary" disabled={exporting || !tickets} onClick={handleExport}>
            {exporting ? "Exportando…" : "Exportar a Excel"}
          </Button>
        </div>
      </header>

      {indicators === undefined ? (
        <p className="mt-6 text-sm text-ink-secondary" role="status">Calculando indicadores…</p>
      ) : (
        <>
          <section aria-label="Resumen" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label={period === "MES" ? "Ingresados este mes" : `Ingresados · ${PERIOD_LABEL[period].toLowerCase()}`} value={String(indicators.created)} />
            <StatTile label="Abiertos ahora" value={String(indicators.open)} />
            <StatTile label="Esperando conformidad" value={String(indicators.awaitingOwner)} tone="action" />
            <StatTile
              label="Días promedio de cierre"
              value={indicators.avgDaysToClose === null ? "—" : oneDecimal.format(indicators.avgDaysToClose)}
            />
          </section>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ChartCard title="Requerimientos por zona" rows={indicators.byZone} empty={indicators.created === 0}>
              <ZoneChart data={indicators.byZone} />
            </ChartCard>
            <ChartCard title="Fallas más frecuentes" rows={indicators.byCategory} empty={indicators.byCategory.length === 0}>
              <CategoryBars data={indicators.byCategory} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

/** Tarjeta de gráfico con su vista de tabla (el dato nunca queda solo en el color o la forma). */
function ChartCard({ title, rows, empty, children }: { title: string; rows: CountRow[]; empty: boolean; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line-soft bg-surface p-6">
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
