"use client";

import { useEffect, useState } from "react";

interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
}

/**
 * Ejecuta una consulta de `useDataApi` y la repite cuando cambia `fetcher`.
 * Como los getters de la API dependen del estado del store, cualquier cambio
 * relevante (crear o transicionar un ticket) vuelve a disparar la consulta.
 * Mantiene el último resultado mientras llega el nuevo, para no parpadear.
 */
export function useQuery<T>(fetcher: () => Promise<T>): QueryResult<T> {
  const [result, setResult] = useState<{ data: T; fetcher: () => Promise<T> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcher().then((data) => {
      if (!cancelled) setResult({ data, fetcher });
    });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  return { data: result?.data, loading: result?.fetcher !== fetcher };
}
