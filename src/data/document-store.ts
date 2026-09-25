/**
 * Archivos PDF adjuntos a los tickets, guardados en IndexedDB del navegador (localStorage no
 * alcanza para PDFs). Como el resto de la persistencia local, es por navegador: en otro equipo el
 * documento figura en el ticket pero el archivo no está disponible.
 */

const DB_NAME = "postventaxis-documentos";
const STORE = "archivos";

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
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveDocumentFile(id: string, file: Blob): Promise<void> {
  await withStore("readwrite", (store) => store.put(file, id));
}

/** El PDF guardado, o null si no está en este navegador. */
export async function loadDocumentFile(id: string): Promise<Blob | null> {
  try {
    const result = await withStore<Blob | undefined>("readonly", (store) => store.get(id));
    return result ?? null;
  } catch {
    return null;
  }
}
