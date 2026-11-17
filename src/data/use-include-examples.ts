"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "postventaxis:incluir-ejemplos";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Preferencia de este navegador: sumar los datos de ejemplo a los tableros (apagada por defecto). */
export function useIncludeExamples(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((next: boolean) => {
    try {
      if (next) window.localStorage.setItem(KEY, "1");
      else window.localStorage.removeItem(KEY);
    } catch {
      // Sin almacenamiento: la preferencia no se conserva.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [value, set];
}
