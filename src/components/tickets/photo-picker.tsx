"use client";

import { useRef } from "react";

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

/**
 * Selector de fotos con vista previa. En esta etapa sin backend las fotos viven
 * como object URLs del navegador; al llegar el backend se suben a storage.
 */
export function PhotoPicker({ photos, max, onAdd, onRemove }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = max - photos.length;

  function handleFiles(files: FileList | null) {
    if (files === null) return;
    const added = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, remaining)
      .map((file) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(file) }));
    if (added.length > 0) onAdd(added);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative h-24 w-24 overflow-hidden rounded-md bg-accent-soft">
            {/* eslint-disable-next-line @next/next/no-img-element -- object URL local, next/image no aplica */}
            <img src={photo.url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={`Quitar foto ${index + 1}`}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"
              onClick={() => {
                URL.revokeObjectURL(photo.url);
                onRemove(photo.id);
              }}
            >
              <span aria-hidden className="text-lg leading-none">×</span>
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-line text-accent transition-colors hover:border-accent hover:bg-accent-soft"
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
        {photos.length} de {max} fotos
      </p>
    </div>
  );
}
