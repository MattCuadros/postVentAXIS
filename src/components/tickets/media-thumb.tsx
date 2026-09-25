"use client";

import { useEffect, useState } from "react";
import { PlayIcon } from "@/components/ui/icons";
import { LOCAL_MEDIA_PREFIX, loadLocalMedia } from "@/data/media-upload";
import { cn } from "@/lib/cn";
import type { TicketMediaType } from "@/types/domain";

/** URL reproducible del medio: las referencias locales se resuelven desde IndexedDB. */
export function useMediaSrc(url: string): string | null | undefined {
  const isLocal = url.startsWith(LOCAL_MEDIA_PREFIX);
  const [resolved, setResolved] = useState<{ url: string; src: string | null } | null>(null);

  useEffect(() => {
    if (!isLocal) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    loadLocalMedia(url).then((blob) => {
      if (cancelled) return;
      objectUrl = blob ? URL.createObjectURL(blob) : null;
      setResolved({ url, src: objectUrl });
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, isLocal]);

  if (!isLocal) return url;
  return resolved?.url === url ? resolved.src : undefined;
}

interface MediaThumbProps {
  url: string;
  type: TicketMediaType;
  label: string;
  durationSeconds?: number | null;
  /** Abre el archivo en otra pestaña al tocarlo. */
  linked?: boolean;
  className?: string;
}

/** Miniatura cuadrada de una foto o video corto. */
export function MediaThumb({ url, type, label, durationSeconds, linked = false, className }: MediaThumbProps) {
  const src = useMediaSrc(url);
  const box = cn("relative block h-24 w-24 shrink-0 overflow-hidden rounded-md bg-accent-soft", className);

  if (src === null) {
    return (
      <div className={cn(box, "flex items-center justify-center p-2 text-center text-[11px] leading-tight text-ink-secondary")}>
        {type === "VIDEO" ? "Video no disponible en este equipo" : "Foto no disponible"}
      </div>
    );
  }
  if (src === undefined) return <div className={cn(box, "animate-pulse")} aria-label={`Cargando ${label}`} />;

  const content = type === "VIDEO" ? (
    <>
      <video src={src} muted playsInline preload="metadata" aria-label={label} className="h-full w-full object-cover" />
      <span className="absolute inset-0 flex items-center justify-center bg-ink/20 text-white" aria-hidden>
        <PlayIcon className="h-8 w-8" />
      </span>
      {durationSeconds != null && (
        <span className="absolute bottom-1 right-1 rounded bg-ink/70 px-1 text-[11px] tabular-nums text-white">
          {Math.round(durationSeconds)} s
        </span>
      )}
    </>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- data URL local, next/image no aplica
    <img src={src} alt={label} className="h-full w-full object-cover" />
  );

  return linked ? (
    <a href={src} target="_blank" rel="noopener noreferrer" className={box}>{content}</a>
  ) : (
    <div className={box}>{content}</div>
  );
}
