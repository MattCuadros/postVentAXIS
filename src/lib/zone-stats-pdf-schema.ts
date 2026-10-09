import { z } from "zod";
import { STATS_PERIODS } from "@/lib/zone-stats";
import { STATUS_LABEL } from "@/lib/ticket-status";

const labelCount = z.object({ id: z.string().max(180), label: z.string().max(180), count: z.number().int().nonnegative().max(100_000) });
const row = z.object({ folio: z.string().max(60), unit: z.string().max(100), days: z.number().nonnegative().max(100_000), status: z.enum(Object.keys(STATUS_LABEL) as [keyof typeof STATUS_LABEL, ...(keyof typeof STATUS_LABEL)[]]) });
export const reportPdfContextSchema = z.object({
  encargado: z.string().max(180),
  filters: z.object({ period: z.enum(STATS_PERIODS), zoneId: z.string().max(100), projectId: z.string().max(100), categoryId: z.string().max(100), crewId: z.string().max(100), status: z.enum(["TODOS", "ABIERTOS", "CERRADOS", "NO_PROCEDE", "CASOS_ESPECIALES"]) }),
  filterNames: z.object({ zone: z.string().max(180), project: z.string().max(180), category: z.string().max(180), crew: z.string().max(180) }),
  stats: z.object({ start: z.string().nullable(), end: z.string(), ingresados: z.number().int().nonnegative(), abiertos: z.number().int().nonnegative(), atrasados: z.number().int().nonnegative(), cerradosEnPeriodo: z.number().int().nonnegative(), avgDaysToVisit: z.number().nullable(), avgDaysToClose: z.number().nullable(), enRecepcion: z.number().int().nonnegative(), noProcede: z.number().int().nonnegative(), cerrados: z.number().int().nonnegative(), casosEspeciales: z.number().int().nonnegative(), reclasificados: z.number().int().nonnegative(), ownerRejections: z.number().int().nonnegative(), byStatus: z.array(labelCount).max(100), byCategory: z.array(labelCount).max(100), byProject: z.array(labelCount).max(100), byCrew: z.array(labelCount).max(100), rows: z.array(row).max(10_000) }),
});
export type ReportPdfPayload = z.infer<typeof reportPdfContextSchema>;
