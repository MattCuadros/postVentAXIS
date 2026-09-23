"use client";

import { useRef, useState } from "react";

export interface PickedPhoto {
  id: string;
  url: string;
}

interface PhotoPickerProps {
  photos: PickedPhoto[];
  max: number;
  onAdd: (photos: PickedPhoto[]) => void;
  onRemove: (id: string) => void;
}

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

/** Selector de fotos comprimidas para que sobrevivan al almacenamiento local. */
export function PhotoPicker({ photos, max, onAdd, onRemove }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = max - photos.length;

  async function handleFiles(files: FileList | null) {
    if (files === null) return;
    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, remaining);
    if (inputRef.current) inputRef.current.value = "";

    if (selected.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const results = await Promise.allSettled(selected.map(compressPhoto));
      const added = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map((result) => ({ id: crypto.randomUUID(), url: result.value }));
      if (added.length > 0) onAdd(added);
      if (added.length !== selected.length) setError("No se pudo procesar una o más fotos.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative h-24 w-24 overflow-hidden rounded-md bg-accent-soft">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL local, next/image no aplica */}
            <img src={photo.url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={`Quitar foto ${index + 1}`}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"
              onClick={() => onRemove(photo.id)}
            >
              <span aria-hidden className="text-lg leading-none">×</span>
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-line text-accent transition-colors hover:border-accent hover:bg-accent-soft"
            disabled={processing}
            onClick={() => inputRef.current?.click()}
          >
            <span aria-hidden className="text-3xl leading-none">+</span>
            <span className="sr-only">Agregar fotos</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => handleFiles(event.target.files)}
      />
      <p className="mt-2 text-xs text-ink-meta">
        {processing ? "Procesando…" : `${photos.length} de ${max} fotos`}
      </p>
      {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
