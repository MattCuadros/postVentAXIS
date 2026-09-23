import type { DataState } from "@/data/store";

/**
 * Persistencia local mientras no hay backend: el estado completo se guarda en `localStorage`
 * del navegador. Sobrevive recargas y se sincroniza entre pestañas, pero es por navegador
 * (otro equipo o navegador parte con los datos de ejemplo).
 */

export const STORAGE_KEY = "postventaxis:datos";
const VERSION = 1;

interface StoredData {
  version: number;
  savedAt: string;
  state: DataState;
}

const COLLECTIONS: (keyof DataState)[] = ["zones", "categories", "users", "projects", "units", "crews", "tickets", "statusHistory"];

function isDataState(value: unknown): value is DataState {
  if (typeof value !== "object" || value === null) return false;
  return COLLECTIONS.every((key) => Array.isArray((value as Record<string, unknown>)[key]));
}

/** Lee el estado guardado; null si no hay, si es de otra versión o si está dañado. */
export function loadState(raw: string | null = readRaw()): DataState | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredData>;
    return stored.version === VERSION && isDataState(stored.state) ? stored.state : null;
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
    const stored: StoredData = { version: VERSION, savedAt: new Date().toISOString(), state };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setError(null);
  } catch (error) {
    const full = error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22);
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

// Último error de guardado, expuesto como store externo (useSyncExternalStore).
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
