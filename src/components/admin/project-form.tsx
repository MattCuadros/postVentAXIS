"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { formatCoordinates, looksLikeMapsShortLink, mapsUrl, parseCoordinates } from "@/lib/geo";
import { fieldErrors, projectSchema } from "@/lib/schemas";
import type { Project } from "@/types/domain";

/** Alta de obra de edificación. La ubicación la define el superadmin aquí (no el propietario). */
export function ProjectForm({ onCreated, onCancel }: { onCreated: (project: Project) => void; onCancel: () => void }) {
  const api = useDataApi();
  const { data: zones } = useQuery(api.getZones);
  const { data: projects } = useQuery(api.getProjects);
  const [values, setValues] = useState({ name: "", code: "", zoneId: "", address: "", commune: "", coordinates: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  /** Nombre que devolvió el geocodificador, para confirmar que cayó en el lugar correcto. */
  const [foundLabel, setFoundLabel] = useState<string | null>(null);

  const point = parseCoordinates(values.coordinates);

  function set(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value, ...(key === "name" && current.code === "" ? { code: suggestCode(value) } : {}) }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  async function callApi(path: string, body: Record<string, string>): Promise<{ lat: number; lng: number; label?: string } | null> {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return response.ok ? ((await response.json()) as { lat: number; lng: number; label?: string }) : null;
  }

  /**
   * Un solo flujo para Ubicación: coordenadas o enlace largo se leen al instante; un enlace corto
   * se sigue en el servidor; y si está vacía, se busca desde Dirección + Comuna. Devuelve el
   * texto final del campo (o el mismo si no se pudo resolver, con un aviso amable).
   */
  async function resolveLocation(current: typeof values): Promise<typeof values> {
    const text = current.coordinates.trim();
    if (text && parseCoordinates(text)) return current;
    const canSearchAddress = !text && current.address.trim() && current.commune.trim();
    if (!text && !canSearchAddress) return current;
    if (text && !looksLikeMapsShortLink(text)) return current;

    setLocating(true);
    setFoundLabel(null);
    try {
      const found = text
        ? await callApi("/api/resolve-maps-link", { url: text })
        : await callApi("/api/geocode", { address: current.address, commune: current.commune });
      if (!found) {
        setErrors((errs) => ({
          ...errs,
          coordinates: text
            ? "No pudimos leer ese enlace. Prueba pegar las coordenadas o el enlace largo de Google Maps."
            : "No encontramos esa dirección. Prueba agregando la comuna o pega un enlace de Google Maps.",
        }));
        return current;
      }
      setFoundLabel(found.label ?? null);
      const next = { ...current, coordinates: formatCoordinates(found) };
      setValues(next);
      setErrors((errs) => ({ ...errs, coordinates: "" }));
      return next;
    } catch {
      setErrors((errs) => ({ ...errs, coordinates: "No pudimos buscar la ubicación ahora. Pégala a mano (coordenadas o enlace de Google Maps)." }));
      return current;
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    const resolved = await resolveLocation(values);
    const result = projectSchema.safeParse(resolved);
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    if (projects?.some((project) => project.code === result.data.code)) {
      setErrors({ code: "Este código ya está en uso por otra obra." });
      return;
    }
    const location = parseCoordinates(result.data.coordinates);
    if (location === null) return;
    setSaving(true);
    try {
      const project = await api.createProject({
        name: result.data.name,
        code: result.data.code,
        zoneId: result.data.zoneId,
        address: result.data.address,
        commune: result.data.commune,
        location,
      });
      onCreated(project);
    } catch {
      setErrors({ code: "No pudimos crear la obra: revisa que el código sea único." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Nombre de la obra" name="project-name" placeholder="Ej.: Edificio Mirador Central" value={values.name} error={errors.name} onChange={(event) => set("name", event.target.value)} />
      <Input label="Código de obra" name="project-code" placeholder="Ej.: MIR" value={values.code} error={errors.code} maxLength={4} onChange={(event) => set("code", event.target.value.toUpperCase())} />
      <Select label="Zona" name="project-zone" value={values.zoneId} error={errors.zoneId} onChange={(event) => set("zoneId", event.target.value)}>
        <option value="" disabled>Selecciona la zona</option>
        {zones?.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
      </Select>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Input label="Dirección" name="project-address" value={values.address} error={errors.address} onChange={(event) => set("address", event.target.value)} />
        <Input label="Comuna" name="project-commune" value={values.commune} error={errors.commune} onChange={(event) => set("commune", event.target.value)} onBlur={() => void resolveLocation(values)} />
      </div>
      <div>
        <Input
          label="Ubicación"
          name="project-coordinates"
          placeholder="Dirección o enlace de Google Maps"
          value={values.coordinates}
          error={errors.coordinates}
          onChange={(event) => {
            setFoundLabel(null);
            set("coordinates", event.target.value);
          }}
          onBlur={() => void resolveLocation(values)}
        />
        {locating && <p className="mt-1.5 text-xs text-ink-meta" role="status">Buscando ubicación…</p>}
        {!errors.coordinates && (
          <p className="mt-1.5 text-xs text-ink-meta">
            {point ? (
              <>
                {foundLabel && <>Encontramos: {foundLabel}. </>}
                Coordenadas: {formatCoordinates(point)} ·{" "}
                <a href={mapsUrl(point)} target="_blank" rel="noopener noreferrer" className="font-bold text-accent hover:underline">
                  Revisar en el mapa
                </a>
              </>
            ) : (
              <>
                Escribe la dirección y la comuna y pulsa{" "}
                <button type="button" className="font-bold text-accent hover:underline" disabled={locating} onClick={() => void resolveLocation({ ...values, coordinates: "" })}>
                  Buscar ubicación
                </button>
                , o pega un enlace de Google Maps (también el corto de «Compartir»).
              </>
            )}
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button>
        <Button disabled={saving} onClick={handleSubmit}>{saving ? "Guardando…" : "Crear obra"}</Button>
      </div>
    </div>
  );
}

function suggestCode(name: string): string {
  const words = name.normalize("NFD").replace(/[^\w\s]/g, "").toUpperCase().split(/\s+/)
    .filter((word) => word && !["EDIFICIO", "CONDOMINIO", "LOS", "LAS", "EL", "LA", "DE"].includes(word));
  return (words.at(0) ?? "").slice(0, 4);
}
