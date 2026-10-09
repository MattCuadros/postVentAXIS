import type { BrowserContext, Page } from "@playwright/test";
import type { Role } from "@/types/domain";

/** Sesión simulada: las mismas cookies que deja la pantalla de pruebas (/pruebas). */
export async function loginAs(context: BrowserContext, userId: string, role: Role, baseURL = "http://localhost:3100") {
  await context.addCookies([
    { name: "pv_user_id", value: userId, url: baseURL },
    { name: "pv_role", value: role, url: baseURL },
  ]);
}

/** Estado guardado por la app en localStorage (espera a que la app lo escriba al cargar). */
export async function savedState(page: Page) {
  await page.waitForFunction(() => localStorage.getItem("postventaxis:datos") !== null);
  return page.evaluate(() => JSON.parse(localStorage.getItem("postventaxis:datos")!));
}

/**
 * Modifica a mano un registro guardado en localStorage (unidades, tickets, etc.), para dejar el
 * estado en un escenario puntual antes de recargar la página. `collection` es la clave del array
 * en el estado (ej. "units", "tickets"); `changes` se combina con el registro que tenga ese id.
 */
export async function patchRecord(page: Page, collection: string, id: string, changes: Record<string, unknown>) {
  await savedState(page);
  await page.evaluate(
    ({ collection, id, changes }) => {
      const raw = JSON.parse(localStorage.getItem("postventaxis:datos")!);
      raw.state[collection] = raw.state[collection].map((item: { id: string }) => (item.id === id ? { ...item, ...changes } : item));
      localStorage.setItem("postventaxis:datos", JSON.stringify(raw));
    },
    { collection, id, changes },
  );
}

/** Saca de una colección los registros cuyo campo `field` valga `value` (ej. limpiar los responsables de una unidad). */
export async function removeRecords(page: Page, collection: string, field: string, value: string) {
  await savedState(page);
  await page.evaluate(
    ({ collection, field, value }) => {
      const raw = JSON.parse(localStorage.getItem("postventaxis:datos")!);
      raw.state[collection] = raw.state[collection].filter((item: Record<string, unknown>) => item[field] !== value);
      localStorage.setItem("postventaxis:datos", JSON.stringify(raw));
    },
    { collection, field, value },
  );
}

/** Graba en el navegador un video WebM de `seconds` segundos (como uno capturado desde el teléfono). */
export async function recordVideo(page: Page, seconds: number): Promise<Buffer> {
  const bytes = await page.evaluate(async (ms) => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const context = canvas.getContext("2d")!;
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    // El codificador de Chrome puede demorar más de lo que dura una grabación corta en entregar
    // su primer dato (la primera grabación de la corrida completa). Si se detiene antes, el
    // archivo queda vacío (0 bytes) y no se puede decodificar. Por eso el reloj de `ms` parte
    // recién cuando llega el primer dato, no al llamar a start().
    let onFirstData: () => void = () => {};
    const firstData = new Promise<void>((resolve) => (onFirstData = resolve));
    recorder.ondataavailable = (event) => {
      chunks.push(event.data);
      if (event.data.size > 0) onFirstData();
    };
    let frame = 0;
    const timer = setInterval(() => {
      context.fillStyle = frame++ % 2 ? "#003399" : "#ff6600";
      context.fillRect(0, 0, 160, 120);
    }, 60);
    recorder.start(200);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("MediaRecorder no entregó datos en 30 s")), 30_000));
    await Promise.race([firstData, timeout]);
    await new Promise((resolve) => setTimeout(resolve, ms));
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.stop();
    await stopped;
    clearInterval(timer);
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  }, seconds * 1000);
  return Buffer.from(bytes);
}

export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
