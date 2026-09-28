"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { fieldErrors, unitSchema } from "@/lib/schemas";
import type { Unit, UnitType } from "@/types/domain";

interface UnitFormProps {
  projectId: string;
  /** En modo edición, se precarga con esta unidad y se guarda con updateUnit en vez de crear. */
  unit?: Unit;
  onCreated: (unit: Unit) => void;
  onCancel: () => void;
}

/** Alta o edición de una vivienda dentro de una obra. El propietario es opcional: se puede completar después. */
export function UnitForm({ projectId, unit, onCreated, onCancel }: UnitFormProps) {
  const api = useDataApi();
  const { data: users } = useQuery(api.getUsers);
  const owners = users?.filter((user) => user.role === "PROPIETARIO" && user.active) ?? [];

  const [values, setValues] = useState({
    type: unit?.type ?? ("DEPARTAMENTO" as UnitType),
    tower: unit?.tower ?? "",
    floor: unit?.floor?.toString() ?? "",
    number: unit?.number ?? "",
    ownerId: unit?.ownerId ?? "",
    deliveryDate: unit?.deliveryDate ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  async function handleSubmit() {
    const result = unitSchema.safeParse(values);
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    const isHouse = result.data.type === "CASA";
    const fields = {
      type: result.data.type,
      tower: isHouse || result.data.tower === "" ? null : result.data.tower,
      floor: isHouse || result.data.floor === "" ? null : Number(result.data.floor),
      number: result.data.number,
      ownerId: result.data.ownerId || null,
      deliveryDate: result.data.deliveryDate,
    };
    setSaving(true);
    try {
      const saved = unit ? await api.updateUnit(unit.id, fields) : await api.createUnit({ projectId, ...fields });
      onCreated(saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Select label="Tipo" name="unit-type" value={values.type} onChange={(event) => set("type", event.target.value as UnitType)}>
        <option value="DEPARTAMENTO">Departamento</option>
        <option value="CASA">Casa</option>
      </Select>
      <div className="grid grid-cols-3 gap-4">
        {values.type === "DEPARTAMENTO" && (
          <>
            <Input label="Torre" name="unit-tower" placeholder="A" value={values.tower} error={errors.tower} onChange={(event) => set("tower", event.target.value)} />
            <Input label="Piso" name="unit-floor" inputMode="numeric" value={values.floor} error={errors.floor} onChange={(event) => set("floor", event.target.value)} />
          </>
        )}
        <Input label="Número" name="unit-number" value={values.number} error={errors.number} onChange={(event) => set("number", event.target.value)} />
      </div>
      <Select label="Propietario" name="unit-owner" value={values.ownerId} error={errors.ownerId} onChange={(event) => set("ownerId", event.target.value)}>
        <option value="">Sin propietario (se completa después)</option>
        {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} · {owner.email}</option>)}
      </Select>
      <p className="-mt-2 text-xs text-ink-meta">¿No aparece? Créalo primero en Usuarios.</p>
      <Input label="Fecha de entrega" name="unit-delivery" type="date" value={values.deliveryDate} error={errors.deliveryDate} onChange={(event) => set("deliveryDate", event.target.value)} />

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button>
        <Button disabled={saving} onClick={handleSubmit}>{saving ? "Guardando…" : unit ? "Guardar cambios" : "Agregar unidad"}</Button>
      </div>
    </div>
  );
}
