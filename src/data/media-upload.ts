/**
 * Punto de integración de la subida de fotos y videos de tickets.
 *
 * Hoy, sin backend: las fotos (ya comprimidas) viajan como data URL dentro del estado local y los
 * videos se guardan en IndexedDB del navegador, referenciados como "local-media:<id>".
 *
 * Con backend (Cloudflare R2): `uploadTicketMedia` pedirá al servidor una URL prefirmada
 * (POST /api/media/upload-url con id, tipo y tamaño; el servidor revalida MAX_*), hará PUT del
 * archivo a esa URL y devolverá la clave del objeto en R2. Solo este archivo debería cambiar.
 */
import type { TicketMediaType } from "@/types/domain";

const DB_NAME = "postventaxis-medios";
const STORE = "videos";
export const LOCAL_MEDIA_PREFIX = "local-media:";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** "Sube" el archivo y devuelve la URL/clave que se guarda en `TicketMedia.url`. */
export async function uploadTicketMedia(id: string, type: TicketMediaType, file: Blob | string): Promise<string> {
  // TODO(R2): reemplazar por URL prefirmada + PUT a Cloudflare R2.
  if (typeof file === "string") return file;
  if (type === "IMAGE") throw new Error("Las fotos se suben ya comprimidas como data URL.");
  await withStore("readwrite", (store) => store.put(file, id));
  return LOCAL_MEDIA_PREFIX + id;
}

/** Descarta un archivo subido que el usuario quitó antes de enviar el formulario. */
export async function discardTicketMedia(url: string): Promise<void> {
  if (!url.startsWith(LOCAL_MEDIA_PREFIX)) return;
  try {
    await withStore("readwrite", (store) => store.delete(url.slice(LOCAL_MEDIA_PREFIX.length)));
  } catch {
    // Si no se pudo borrar queda huérfano en este navegador; no afecta al ticket.
  }
}

/** Blob de un video local, o null si no está en este navegador. */
export async function loadLocalMedia(url: string): Promise<Blob | null> {
  try {
    const result = await withStore<Blob | undefined>("readonly", (store) => store.get(url.slice(LOCAL_MEDIA_PREFIX.length)));
    return result ?? null;
  } catch {
    return null;
  }
}
