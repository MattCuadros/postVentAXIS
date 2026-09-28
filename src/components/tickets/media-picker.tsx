"use client";

import { useRef, useState } from "react";
import { MediaThumb } from "@/components/tickets/media-thumb";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { discardTicketMedia, uploadTicketMedia } from "@/data/media-upload";
import { MAX_IMAGE_MB, MAX_VIDEO_MB, MAX_VIDEO_SECONDS, type TicketMediaType } from "@/types/domain";

export interface PickedMedia {
  id: string;
  url: string;
  type: TicketMediaType;
  durationSeconds: number | null;
}

interface MediaPickerProps {
  items: PickedMedia[];
  max: number;
  onAdd: (items: PickedMedia[]) => void;
  onRemove: (id: string) => void;
}

const MB = 1024 * 1024;
/** Tolerancia para la duración que reportan los navegadores (ej. 5,02 s en un video de 5 s). */
const DURATION_TOLERANCE = 0.25;

const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.72;

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("No se pudo leer la foto."));
    reader.onerror = () => reject(new Error("No se pudo leer la foto."));
    reader.readAsDataURL(file);
  });
}

async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Algunos formatos o navegadores no admiten createImageBitmap; se usa img como respaldo.
    }
  }

  const image = new Image();
  image.src = await fileAsDataUrl(file);
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No se pudo procesar la foto."));
  });
  return { source: image, width: image.naturalWidth, height: image.naturalHeight };
}

async function compressPhoto(file: File): Promise<string> {
  const image = await loadImage(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("No se pudo procesar la foto.");
    context.drawImage(image.source, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    image.close?.();
  }
}

/**
 * Duración en segundos leída de los metadatos del video, o null si el navegador no la informa.
 *
 * Algunos videos grabados en el navegador (MediaRecorder, sin índice de duración) reportan
 * `duration: Infinity` al cargar los metadatos: saltar al final fuerza a calcularla. El elemento
 * se agrega oculto al documento mientras se lee: uno separado del documento puede quedar con
 * prioridad de decodificación baja y demorar mucho más en resolver el salto.
 */
async function videoDuration(file: File): Promise<number | null> {
  // Un intento aislado a veces se queda esperando (dispositivo lento, video muy corto): un
  // segundo intento con un elemento nuevo suele resolverlo.
  return (await readVideoDuration(file)) ?? (await readVideoDuration(file));
}

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;";
    document.body.appendChild(video);
    const done = (value: number | null) => {
      video.remove();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) return done(video.duration);
      let settled = false;
      const finish = (value: number | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        done(value);
      };
      const timeout = window.setTimeout(() => finish(null), 20_000);
      const fromCurrentTime = () => (Number.isFinite(video.duration) ? video.duration : video.currentTime > 0 ? video.currentTime : null);
      video.ondurationchange = () => Number.isFinite(video.duration) && finish(video.duration);
      video.ontimeupdate = () => video.currentTime > 0 && finish(fromCurrentTime());
      video.onseeked = () => finish(fromCurrentTime());
      video.currentTime = Number.MAX_SAFE_INTEGER;
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}

class MediaError extends Error {}

async function prepare(file: File): Promise<PickedMedia> {
  const id = crypto.randomUUID();
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_MB * MB) throw new MediaError(`El video pesa más de ${MAX_VIDEO_MB} MB.`);
    const duration = await videoDuration(file);
    if (duration === null) throw new MediaError("No pudimos leer la duración del video. Prueba grabarlo de nuevo.");
    if (duration > MAX_VIDEO_SECONDS + DURATION_TOLERANCE) {
      throw new MediaError(`El video dura ${Math.round(duration)} segundos; el máximo es ${MAX_VIDEO_SECONDS}.`);
    }
    return { id, type: "VIDEO", durationSeconds: Math.round(duration * 10) / 10, url: await uploadTicketMedia(id, "VIDEO", file) };
  }
  const dataUrl = await compressPhoto(file);
  if ((dataUrl.length * 3) / 4 > MAX_IMAGE_MB * MB) throw new MediaError(`La foto pesa más de ${MAX_IMAGE_MB} MB.`);
  return { id, type: "IMAGE", durationSeconds: null, url: await uploadTicketMedia(id, "IMAGE", dataUrl) };
}

/**
 * Selector de fotos (comprimidas para el almacenamiento local) y videos cortos. Valida en el
 * cliente la duración y el peso antes de "subir" (ver src/data/media-upload.ts).
 */
export function MediaPicker({ items, max, onAdd, onRemove }: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const remaining = max - items.length;

  async function handleFiles(files: FileList | null) {
    if (files === null) return;
    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .slice(0, remaining);
    if (inputRef.current) inputRef.current.value = "";

    if (selected.length === 0) return;
    setProcessing(true);
    setErrors([]);
    try {
      const results = await Promise.allSettled(selected.map(prepare));
      const added = results
        .filter((result): result is PromiseFulfilledResult<PickedMedia> => result.status === "fulfilled")
        .map((result) => result.value);
      if (added.length > 0) onAdd(added);
      const failed = results.flatMap((result, index) => {
        if (result.status === "fulfilled") return [];
        const reason = result.reason instanceof MediaError ? result.reason.message : "No se pudo procesar el archivo.";
        return [`${selected[index].name}: ${reason}`];
      });
      setErrors(failed);
    } finally {
      setProcessing(false);
    }
  }

  function handleRemove(item: PickedMedia) {
    onRemove(item.id);
    void discardTicketMedia(item.url);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {items.map((item, index) => {
          const label = `${item.type === "VIDEO" ? "Video" : "Foto"} ${index + 1}`;
          return (
            <div key={item.id} className="relative">
              <MediaThumb url={item.url} type={item.type} label={label} durationSeconds={item.durationSeconds} />
              <button
                type="button"
                aria-label={`Quitar ${label.toLowerCase()}`}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"
                onClick={() => handleRemove(item)}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {remaining > 0 && (
          <button
            type="button"
            className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-line text-accent transition duration-150 ease-axis-out hover:border-accent hover:bg-accent-soft active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
            disabled={processing}
            onClick={() => inputRef.current?.click()}
          >
            <PlusIcon className="h-7 w-7" />
            <span className="sr-only">Agregar fotos o video</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="media-input"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <p className="mt-2 text-xs text-ink-meta">
        {processing ? "Procesando…" : `${items.length} de ${max} archivos · fotos o video de hasta ${MAX_VIDEO_SECONDS} segundos`}
      </p>
      {errors.length > 0 && (
        <div className="mt-1 text-xs text-danger" role="alert">
          {errors.map((message) => <p key={message}>{message}</p>)}
        </div>
      )}
    </div>
  );
}
