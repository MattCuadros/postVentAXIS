"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import type { Unit } from "@/types/domain";

interface AssignOwnerDialogProps {
  open: boolean;
  unit: Unit;
  personLabel: string;
  onClose: () => void;
  onAssigned: (ownerName: string) => void;
}

/** Asigna el titular de una unidad que no tiene propietario: uno existente, o uno nuevo. */
export function AssignOwnerDialog({ open, unit, personLabel, onClose, onAssigned }: AssignOwnerDialogProps) {
  const api = useDataApi();
  const { data: users } = useQuery(api.getUsers);
  const owners = users?.filter((user) => user.role === "PROPIETARIO" && user.active) ?? [];
  const person = personLabel.toLocaleLowerCase("es");

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [ownerId, setOwnerId] = useState("");
  const [newOwner, setNewOwner] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setMode("existing");
    setOwnerId("");
    setNewOwner({ name: "", email: "", phone: "" });
    setError(null);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function handleSubmit() {
    setError(null);
    if (mode === "existing") {
      if (!ownerId) {
        setError(`Elige ${person}.`);
        return;
      }
      setSaving(true);
      try {
        await api.updateUnit(unit.id, { ownerId });
        const owner = owners.find((item) => item.id === ownerId);
        reset();
        onAssigned(owner?.name ?? "Propietario asignado");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!newOwner.name.trim() || !newOwner.email.trim() || !newOwner.phone.trim()) {
        setError(`Completa nombre, correo y tel\u00e9fono del ${person} nuevo.`);
      return;
    }
    setSaving(true);
    try {
      const created = await api.createUser({
        name: newOwner.name.trim(),
        email: newOwner.email.trim().toLowerCase(),
        phone: newOwner.phone.trim(),
        role: "PROPIETARIO",
        zoneIds: [],
        projectIds: [],
        active: true,
      });
      await api.updateUnit(unit.id, { ownerId: created.id });
      reset();
      onAssigned(created.name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} title={`Asignar ${person}`} onClose={handleClose}>
      <div className="flex flex-col gap-4">
        <Select
          label={personLabel}
          name="assign-owner"
          value={mode === "new" ? "__new" : ownerId}
          onChange={(event) => {
            if (event.target.value === "__new") {
              setMode("new");
            } else {
              setMode("existing");
              setOwnerId(event.target.value);
            }
          }}
        >
          <option value="">Elige {person}</option>
          {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} · {owner.email}</option>)}
          <option value="__new">+ Crear {person} nuevo</option>
        </Select>
        {mode === "new" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Nombre" name="assign-owner-name" value={newOwner.name} onChange={(event) => setNewOwner({ ...newOwner, name: event.target.value })} />
            <Input label="Correo" name="assign-owner-email" type="email" value={newOwner.email} onChange={(event) => setNewOwner({ ...newOwner, email: event.target.value })} />
            <Input label="Teléfono" name="assign-owner-phone" type="tel" value={newOwner.phone} onChange={(event) => setNewOwner({ ...newOwner, phone: event.target.value })} />
          </div>
        )}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={saving} onClick={handleClose}>Cancelar</Button>
          <Button disabled={saving} onClick={handleSubmit}>{saving ? "Guardando…" : "Asignar"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
