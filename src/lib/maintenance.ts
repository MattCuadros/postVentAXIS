/**
 * Estado del banner de mantenimiento a partir de public/mantenimiento.json (lo actualizan los
 * workflows de despliegue; ver scripts/mantenimiento.mjs). Nunca bloquea ni recarga la app:
 * solo avisa, y ofrece actualizar cuando el usuario quiera.
 */

export interface MaintenanceWindow {
  rama: string;
  titulo: string;
  inicio: string;
  duracionMinutos: number;
}

export interface MaintenanceFile {
  programado: MaintenanceWindow[];
  ultimo: { completadoEn: string; novedades: string[] } | null;
}

export type BannerState =
  | { kind: "none" }
  | { kind: "scheduled"; inicio: Date; novedades: string[] }
  | { kind: "running"; novedades: string[] }
  | { kind: "updated"; novedades: string[] };

/** Cuánto tiempo se ofrece actualizar tras un despliegue. */
const UPDATE_OFFER_MS = 24 * 60 * 60 * 1000;

export function parseMaintenanceFile(value: unknown): MaintenanceFile {
  const data = (value ?? {}) as Partial<MaintenanceFile>;
  const programado = Array.isArray(data.programado)
    ? data.programado.filter((item): item is MaintenanceWindow => typeof item?.inicio === "string" && typeof item?.titulo === "string")
    : [];
  const ultimo = data.ultimo && typeof data.ultimo.completadoEn === "string" ? data.ultimo : null;
  return { programado, ultimo };
}

/**
 * `buildTime`: cuándo se compiló la versión que el usuario tiene abierta. Si hubo un despliegue
 * posterior, se le ofrece actualizar (sin forzarlo).
 */
export function bannerState(file: MaintenanceFile, now: Date, buildTime: Date | null): BannerState {
  const { ultimo } = file;
  if (ultimo && buildTime) {
    const completed = new Date(ultimo.completadoEn);
    if (completed > buildTime && now.getTime() - completed.getTime() < UPDATE_OFFER_MS) {
      return { kind: "updated", novedades: ultimo.novedades };
    }
  }

  const windows = file.programado
    .map((item) => ({ ...item, start: new Date(item.inicio) }))
    .filter((item) => !Number.isNaN(item.start.getTime()))
    .toSorted((a, b) => a.start.getTime() - b.start.getTime());
  if (windows.length === 0) return { kind: "none" };

  const running = windows.filter((item) => item.start <= now);
  if (running.length > 0) return { kind: "running", novedades: running.map((item) => item.titulo) };
  const next = windows[0].start;
  return { kind: "scheduled", inicio: next, novedades: windows.filter((item) => item.start.getTime() === next.getTime()).map((item) => item.titulo) };
}
