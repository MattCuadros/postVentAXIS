import type { DataState } from "@/data/store";
import type { Project, Ticket, Zone } from "@/types/domain";

export const STORAGE_KEY = "postventaxis:datos";
const VERSION = 2;

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
    zones.push({ id: "z-austral", name: "Zona Austral", code: "A" });
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

export function loadState(raw: string | null = readRaw()): DataState | null {
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as Partial<StoredData>;
    if (!isDataState(stored.state)) return null;
    if (stored.version === VERSION) return stored.state;
    return stored.version === 1 ? migrateV1(stored.state) : null;
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
