"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendRow } from "@/lib/zone-stats";

// Valores de los tokens de tailwind.config.ts (recharts necesita colores literales).
const ACCENT = "#003399";
const ACCENT_LIGHT = "#8FA6D6";
const INK_SECONDARY = "#4D4D4D";
const LINE_SOFT = "#E6E6E6";
const SURFACE_SECONDARY = "#F2F2F2";

/** Ingresados vs cerrados conformes por tramo (día, semana o mes), con leyenda propia. */
export function TrendChart({ data }: { data: TrendRow[] }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-secondary">
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2 w-4 rounded-pill" style={{ background: ACCENT }} />Ingresados</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2 w-4 rounded-pill" style={{ background: ACCENT_LIGHT }} />Cerrados conformes</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barGap={2}>
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: LINE_SOFT }} tick={{ fill: INK_SECONDARY, fontSize: 12 }} minTickGap={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: INK_SECONDARY, fontSize: 12 }} width={40} />
            <Tooltip
              cursor={{ fill: SURFACE_SECONDARY }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as TrendRow | undefined;
                if (!active || !row) return null;
                return (
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2 text-sm shadow-raised">
                    <p className="font-bold text-ink">{row.label}</p>
                    <p className="text-ink-secondary">{row.ingresados} ingresados · {row.cerrados} cerrados</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="ingresados" fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="cerrados" fill={ACCENT_LIGHT} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
