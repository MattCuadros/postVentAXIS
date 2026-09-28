"use client";

import { useEffect, useState } from "react";
import { CloseIcon, InfoIcon } from "@/components/ui/icons";
import { bannerState, parseMaintenanceFile, type BannerState, type MaintenanceFile } from "@/lib/maintenance";

const POLL_MS = 5 * 60 * 1000;
const DISMISS_KEY = "postventaxis:mantenimiento-oculto";
const BUILD_TIME = process.env.BUILD_TIME ? new Date(process.env.BUILD_TIME) : null;

const when = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function writeDismissed(value: string) {
  try {
    localStorage.setItem(DISMISS_KEY, value);
  } catch {
    // Sin almacenamiento el aviso vuelve a mostrarse; no es un problema.
  }
}

/** Identifica cada aviso, para que ocultarlo no oculte el siguiente. */
function stateKey(state: Exclude<BannerState, { kind: "none" }>): string {
  if (state.kind === "scheduled") return `scheduled:${state.inicio.toISOString()}`;
  return `${state.kind}:${state.novedades.join("|")}`;
}

/**
 * Aviso de mantenimiento programado y de versión nueva. Consulta public/mantenimiento.json cada
 * pocos minutos; nunca recarga ni saca al usuario: actualizar es decisión suya.
 */
export function MaintenanceBanner() {
  const [file, setFile] = useState<MaintenanceFile | null>(null);
  const [now, setNow] = useState(() => new Date());
  // Seguro en el servidor: el banner no se pinta hasta leer el archivo, ya en el cliente.
  const [dismissed, setDismissed] = useState<string | null>(() => readDismissed());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/mantenimiento.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const parsed = parseMaintenanceFile(await response.json());
        if (!cancelled) {
          setFile(parsed);
          setNow(new Date());
        }
      } catch {
        // Sin conexión o archivo ausente: simplemente no se muestra aviso.
      }
    }
    void load();
    const timer = window.setInterval(load, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (file === null) return null;
  const state = bannerState(file, now, BUILD_TIME);
  if (state.kind === "none") return null;
  const key = stateKey(state);
  if (dismissed === key) return null;

  function dismiss() {
    writeDismissed(key);
    setDismissed(key);
  }

  const list = state.novedades.length > 0 ? ` Novedades: ${state.novedades.join("; ")}.` : "";
  let message: string;
  if (state.kind === "scheduled") {
    message = `Mantenimiento programado para el ${when.format(state.inicio)} (unos 30 minutos). Puedes seguir usando PostventAXIS con normalidad.${list}`;
  } else if (state.kind === "running") {
    message = `Estamos instalando mejoras. Puedes seguir trabajando; no perderás lo que estás haciendo.${list}`;
  } else {
    message = `Hay una versión nueva de PostventAXIS. Actualiza cuando termines lo que estás haciendo.${list}`;
  }

  return (
    <div role="status" aria-live="polite" className="border-b border-accent/20 bg-accent-soft text-sm text-ink" data-testid="maintenance-banner">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <p className="flex-1">{message}</p>
        {state.kind === "updated" && (
          <button type="button" className="shrink-0 font-bold text-accent hover:underline" onClick={() => window.location.reload()}>
            Actualizar ahora
          </button>
        )}
        <button type="button" aria-label="Ocultar aviso" className="shrink-0 rounded p-0.5 text-ink-secondary hover:bg-accent/10" onClick={dismiss}>
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
