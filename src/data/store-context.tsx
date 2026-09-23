"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useSyncExternalStore, type Dispatch, type ReactNode } from "react";
import { clearState, getStorageError, loadState, saveState, STORAGE_KEY, subscribeStorageError } from "@/data/persistence";
import { createSeedState, reducer, type DataAction, type DataState } from "@/data/store";

interface DataContextValue {
  state: DataState;
  dispatch: Dispatch<DataAction>;
  /** Borra lo guardado en este navegador y vuelve a los datos de ejemplo. */
  resetData: () => void;
  /** Mensaje si el último guardado local falló (ej. almacenamiento lleno). */
  storageError: string | null;
}

const DataContext = createContext<DataContextValue | null>(null);

const noopSubscribe = () => () => {};

export function DataProvider({ children }: { children: ReactNode }) {
  // false en el servidor y durante la hidratación; true ya montado en el navegador.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // En el navegador parte desde lo guardado; en el servidor, desde los datos de ejemplo.
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    typeof window === "undefined" ? createSeedState() : (loadState() ?? createSeedState()),
  );
  const storageError = useSyncExternalStore(subscribeStorageError, getStorageError, () => null);

  useEffect(() => {
    if (mounted) saveState(state);
  }, [mounted, state]);

  // Otra pestaña guardó cambios: se adoptan aquí también.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      dispatch({ type: "REPLACE_STATE", state: loadState(event.newValue) ?? createSeedState() });
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const resetData = useCallback(() => {
    clearState();
    dispatch({ type: "REPLACE_STATE", state: createSeedState() });
  }, []);

  const value = useMemo(() => ({ state, dispatch, resetData, storageError }), [state, resetData, storageError]);

  // Hasta montar no se conocen los datos guardados: no se renderiza nada para evitar
  // mostrar (y parpadear) los datos de ejemplo antes de los reales.
  return <DataContext.Provider value={value}>{mounted ? children : null}</DataContext.Provider>;
}

export function useDataContext(): DataContextValue {
  const context = useContext(DataContext);
  if (context === null) {
    throw new Error("useDataContext must be used within a DataProvider");
  }

  return context;
}
