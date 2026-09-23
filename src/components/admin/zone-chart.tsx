"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CountRow } from "@/lib/metrics";

// Valores de los tokens de tailwind.config.ts (recharts necesita colores literales).
const ACCENT = "#003399";
const INK = "#1A1A1A";
const INK_SECONDARY = "#4D4D4D";
const LINE_SOFT = "#E6E6E6";
const SURFACE_SECONDARY = "#F2F2F2";

/**
 * Columnas por zona: una sola serie (magnitud), un solo tono. Cada columna lleva su valor
 * en la punta, así que no hace falta eje Y; el tooltip se activa en toda la franja.
 */
export function ZoneChart({ data }: { data: CountRow[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 28, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: LINE_SOFT }}
            tick={{ fill: INK_SECONDARY, fontSize: 12 }}
            interval={0}
          />
          <YAxis hide allowDecimals={false} />
          <Tooltip
            cursor={{ fill: SURFACE_SECONDARY }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as CountRow | undefined;
              if (!active || !row) return null;
              return (
                <div className="rounded-md border border-line-soft bg-surface px-3 py-2 text-sm shadow-raised">
                  <p className="font-bold text-ink">{row.label}</p>
                  <p className="text-ink-secondary">
                    {row.count} {row.count === 1 ? "requerimiento" : "requerimientos"}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
            <LabelList dataKey="count" position="top" fill={INK} fontSize={14} fontWeight={700} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
