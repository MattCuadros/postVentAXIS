import type { DataState } from "@/data/store";
import type { Project, Ticket, TicketMedia, TicketMediaStage, Zone } from "@/types/domain";

export const STORAGE_KEY = "postventaxis:datos";
const VERSION = 6;

interface StoredData {
  version: number;
  savedAt: string;
  state: DataState;
}

type V1State = DataState & {
  zones: Array<Zone & { code?: Zone["code"] }>;
  projects: Array<Project & { code?: string }>;
  crews: Array<DataState["crews"][number] & { projectIds?: string[] }>;
  tickets: Array<
    Ticket & {
      reportedCategoryId?: string;
      specialCase?: Ticket["specialCase"];
    }
  >;
};

const COLLECTIONS: (keyof DataState)[] = [
  "zones",
  "categories",
  "users",
  "projects",
  "units",
  "crews",
  "tickets",
  "statusHistory",
];

function isDataState(value: unknown): value is DataState {
  if (typeof value !== "object" || value === null) return false;
  return COLLECTIONS.every((key) => Array.isArray((value as Record<string, unknown>)[key]));
}

function suggestedProjectCode(name: string, taken: Set<string>): string {
  const normalized = name.normalize("NFD").replace(/[^\w\s]/g, "").toUpperCase();
  const words = normalized
    .split(/\s+/)
    .filter((word) => word && !["EDIFICIO", "CONDOMINIO", "LOS", "LAS", "EL", "LA", "DE"].includes(word));
  const base = (words.at(0) ?? "OBRA").slice(0, 3).padEnd(2, "X");

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const suffixText = String(suffix);
    const candidate = suffix === 0
      ? base
      : base.slice(0, Math.max(1, 4 - suffixText.length)) + suffixText;
    if (!taken.has(candidate)) return candidate;
  }

  return "O" + String(taken.size + 1).padStart(3, "0");
}

function migrateV1(state: DataState): DataState {
  const old = state as V1State;
  const zoneCodes: Record<string, Zone["code"]> = {
    "z-norte": "N",
    "z-centro": "C",
    "z-sur": "S",
    "z-austral": "A",
  };
  const zones = old.zones.map((zone) => ({
    ...zone,
    code: zone.code ?? zoneCodes[zone.id] ?? "C",
  }));

  if (!zones.some((zone) => zone.id === "z-austral")) {
    zones.push({ id: "z-austral", name: "Postventa Austral", code: "A" });
  }

  const taken = new Set<string>();
  const projects = old.projects.map((project) => {
    const currentCode = project.code ?? "";
    const hasUniqueValidCode = /^[A-Z]{2,4}$/.test(currentCode) && !taken.has(currentCode);
    const code = hasUniqueValidCode ? currentCode : suggestedProjectCode(project.name, taken);
    taken.add(code);
    return { ...project, code };
  });

  const crews = old.crews.map((crew) => ({
    ...crew,
    projectIds: projects
      .filter((project) => project.zoneId === crew.zoneId)
      .map((project) => project.id),
  }));
  const unitProject = new Map(old.units.map((unit) => [unit.id, unit.projectId]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  const counters = new Map<string, number>();
  const tickets = [...old.tickets]
    .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((ticket) => {
      const projectId = unitProject.get(ticket.unitId) ?? "";
      const project = projectById.get(projectId);
      const zone = project ? zoneById.get(project.zoneId) : undefined;
      const index = project ? (counters.get(project.id) ?? 0) + 1 : 1;

      if (project) counters.set(project.id, index);

      const folio = project && zone
        ? project.code + "-" + String(index).padStart(4, "0") + "-" + zone.code
        : ticket.folio;

      return {
        ...ticket,
        folio,
        reportedCategoryId: ticket.reportedCategoryId ?? ticket.categoryId,
        specialCase: ticket.specialCase ?? null,
      };
    });

  return { ...old, zones, projects, crews, tickets };
}

/** v2 → v3: las visitas y los trabajos pasan a tener hora (null en lo ya registrado). */
function migrateV2(state: DataState): DataState {
  return {
    ...state,
    tickets: state.tickets.map((ticket) => ({
      ...ticket,
      visitTime: ticket.visitTime ?? null,
      scheduledTime: ticket.scheduledTime ?? null,
    })),
  };
}

/** v3 → v4: los tickets pueden tener referencias externas y documentos adjuntos. */
function migrateV3(state: DataState): DataState {
  return {
    ...state,
    tickets: state.tickets.map((ticket) => ({
      ...ticket,
      externalRefs: ticket.externalRefs ?? [],
      documents: ticket.documents ?? [],
    })),
  };
}

/** Nombres reales de las zonas de postventa (ids estables). */
const ZONE_NAMES: Record<string, string> = {
  "z-centro": "Postventa Centro",
  "z-sur": "Postventa Sur",
  "z-austral": "Postventa Austral",
};

/**
 * v4 → v5: las zonas pasan a llamarse "Postventa Centro/Sur/Austral" y Zona Norte desaparece:
 * todo lo que apuntaba a z-norte (obras, encargados, equipos) pasa a Postventa Austral.
 * Además los usuarios ganan `projectIds` (rol Administrador de obra).
 */
function migrateV4(state: DataState): DataState {
  const remap = (zoneId: string) => (zoneId === "z-norte" ? "z-austral" : zoneId);
  const zones = state.zones.filter((zone) => zone.id !== "z-norte");
  if (!zones.some((zone) => zone.id === "z-austral")) zones.push({ id: "z-austral", name: "Postventa Austral", code: "A" });

  return {
    ...state,
    zones: zones.map((zone) => ({ ...zone, name: ZONE_NAMES[zone.id] ?? zone.name })),
    projects: state.projects.map((project) => ({ ...project, zoneId: remap(project.zoneId) })),
    users: state.users.map((user) => ({
      ...user,
      zoneIds: [...new Set(user.zoneIds.map(remap))],
      projectIds: user.projectIds ?? [],
    })),
    crews: state.crews.map((crew) => ({ ...crew, zoneId: remap(crew.zoneId) })),
  };
}

type LegacyPhoto = { id: string; url: string; uploadedById: string; createdAt: string };

/**
 * v5 → v6: `Ticket.photos` pasa a `Ticket.media` (fotos y video corto). Las fotos existentes
 * quedan como IMAGE; su etapa se deduce de quién la subió y del estado registrado en ese momento.
 */
function migrateV5(state: DataState): DataState {
  return {
    ...state,
    tickets: state.tickets.map((ticket) => {
      const { photos, ...rest } = ticket as Ticket & { photos?: LegacyPhoto[] };
      if (ticket.media) return ticket;
      const media: TicketMedia[] = (photos ?? []).map((photo) => {
        const entry = state.statusHistory.find((item) => item.ticketId === ticket.id && item.createdAt === photo.createdAt);
        const stage: TicketMediaStage =
          entry?.to === "EN_RECEPCION" ? "SOLUCION"
            : entry?.to === "VISITA_INSPECTIVA" ? "VISITA"
              : photo.uploadedById === ticket.createdById ? "PROBLEMA" : "VISITA";
        return { ...photo, type: "IMAGE", durationSeconds: null, stage };
      });
      return { ...rest, media };
    }),
  };
}

/** Migración de cada versión a la siguiente (clave = versión de origen). */
const MIGRATIONS: Record<number, (state: DataState) => DataState> = {
  1: migrateV1,
  2: migrateV2,
  3: migrateV3,
  4: migrateV4,
  5: migrateV5,
};

export function loadState(raw: string | null = readRaw()): DataState | null {
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as Partial<StoredData>;
    if (!isDataState(stored.state)) return null;
    if (typeof stored.version !== "number" || stored.version < 1 || stored.version > VERSION) return null;

    let state = stored.state;
    for (let version = stored.version; version < VERSION; version += 1) {
      state = MIGRATIONS[version](state);
    }
    return state;
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveState(state: DataState): void {
  try {
    const stored: StoredData = {
      version: VERSION,
      savedAt: new Date().toISOString(),
      state,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setError(null);
  } catch (error) {
    const full = error instanceof DOMException && (
      error.name === "QuotaExceededError" ||
      error.code === 22
    );
    setError(
      full
        ? "El almacenamiento local del navegador está lleno (probablemente por las fotos). Los últimos cambios se perderán al recargar."
        : "No pudimos guardar los cambios en este navegador. Se perderán al recargar.",
    );
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin acceso al almacenamiento: no hay nada que borrar.
  }
}

let lastError: string | null = null;
const listeners = new Set<() => void>();

function setError(message: string | null): void {
  if (message === lastError) return;
  lastError = message;
  for (const listener of listeners) listener();
}

export function subscribeStorageError(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStorageError(): string | null {
  return lastError;
}
