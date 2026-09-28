"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { canManageResponsibles, RESPONSIBLE_RELATION_LABEL, relationNeedsNote } from "@/lib/unit-access";
import type { ResponsibleRelation, Unit, UnitResponsible, User } from "@/types/domain";

const RELATIONS = Object.keys(RESPONSIBLE_RELATION_LABEL) as ResponsibleRelation[];

interface UnitResponsiblesProps {
  unit: Unit;
  actingUser: User;
}

/**
 * Responsables de una unidad, además del titular: quién puede ver/reportar y quién puede firmar
 * la conformidad. Gestionar (agregar, editar, quitar) es solo para superadministrador y el
 * encargado de la zona de la unidad; la capa de datos (`store.ts`) rechaza a cualquier otro,
 * aunque alguien intente llamarla directo.
 */
export function UnitResponsibles({ unit, actingUser }: UnitResponsiblesProps) {
  const api = useDataApi();
  const { data: allResponsibles } = useQuery(api.getUnitResponsibles);
  const { data: users } = useQuery(api.getUsers);
  const { data: projects } = useQuery(api.getProjects);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const responsibles = allResponsibles?.filter((item) => item.unitId === unit.id) ?? [];
  const titular = users?.find((item) => item.id === unit.ownerId);
  const canManage = !!projects && canManageResponsibles(actingUser, unit, projects);

  async function handleRemove(id: string) {
    setError(null);
    try {
      await api.deleteResponsible(id, actingUser.id);
    } catch {
      setError("No pudimos quitar el responsable. Intenta nuevamente.");
    }
  }

  async function handleToggleSign(responsible: UnitResponsible) {
    setError(null);
    try {
      await api.updateResponsible(responsible.id, { canSignConformity: !responsible.canSignConformity }, actingUser.id);
    } catch {
      setError("No pudimos guardar el cambio. Intenta nuevamente.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-bold text-ink-secondary">Titular</p>
        <p className="text-sm text-ink">{titular ? `${titular.name} · ${titular.email}` : "Sin propietario"}</p>
      </div>

      {responsibles.length > 0 && (
        <ul className="flex flex-col divide-y divide-line-soft">
          {responsibles.map((responsible) => {
            const person = users?.find((item) => item.id === responsible.userId);
            const label = RESPONSIBLE_RELATION_LABEL[responsible.relation];
            return (
              <li key={responsible.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{person?.name ?? "—"}</p>
                  <p className="text-xs text-ink-meta">
                    {relationNeedsNote(responsible.relation) && responsible.relationNote ? `${label} (${responsible.relationNote})` : label}
                    {" · "}
                    {responsible.canSignConformity ? "Puede firmar" : "No firma"}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <button type="button" className="font-bold text-accent hover:underline" onClick={() => void handleToggleSign(responsible)}>
                      {responsible.canSignConformity ? "Quitar firma" : "Permitir firma"}
                    </button>
                    <button type="button" className="font-bold text-danger hover:underline" onClick={() => void handleRemove(responsible.id)}>
                      Quitar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      {canManage && (
        adding ? (
          <AddResponsibleForm
            unit={unit}
            actingUser={actingUser}
            users={users ?? []}
            onDone={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <Button variant="secondary" onClick={() => setAdding(true)}>Agregar responsable</Button>
        )
      )}
    </div>
  );
}

function AddResponsibleForm({
  unit,
  actingUser,
  users,
  onDone,
  onCancel,
}: {
  unit: Unit;
  actingUser: User;
  users: User[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const api = useDataApi();
  const owners = users.filter((item) => item.role === "PROPIETARIO" && item.active);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [userId, setUserId] = useState("");
  const [newPerson, setNewPerson] = useState({ name: "", email: "", phone: "" });
  const [relation, setRelation] = useState<ResponsibleRelation>("FAMILIAR");
  const [relationNote, setRelationNote] = useState("");
  const [canSign, setCanSign] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (mode === "existing" && !userId) {
      setError("Elige a la persona, o crea una nueva.");
      return;
    }
    if (mode === "new" && (!newPerson.name.trim() || !newPerson.email.trim() || !newPerson.phone.trim())) {
      setError("Completa nombre, correo y teléfono de la persona nueva.");
      return;
    }
    if (relationNeedsNote(relation) && !relationNote.trim()) {
      setError(relation === "FAMILIAR" ? "Indica el parentesco (ej. hijo, madre)." : "Indica de qué se trata.");
      return;
    }
    setSaving(true);
    try {
      const personId = mode === "existing"
        ? userId
        : (await api.createUser({
            name: newPerson.name.trim(),
            email: newPerson.email.trim().toLowerCase(),
            phone: newPerson.phone.trim(),
            role: "PROPIETARIO",
            zoneIds: [],
            projectIds: [],
            active: true,
          })).id;
      await api.createResponsible(
        unit.id,
        { userId: personId, relation, relationNote: relationNeedsNote(relation) ? relationNote.trim() : null, canSignConformity: canSign },
        actingUser.id,
      );
      onDone();
    } catch {
      setError("No pudimos agregar el responsable. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md bg-surface-secondary p-4">
      <Select
        label="Persona"
        name="responsible-person"
        value={mode === "new" ? "__new" : userId}
        onChange={(event) => {
          if (event.target.value === "__new") setMode("new");
          else {
            setMode("existing");
            setUserId(event.target.value);
          }
        }}
      >
        <option value="">Busca por correo</option>
        {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} · {owner.email}</option>)}
        <option value="__new">+ Crear persona nueva</option>
      </Select>

      {mode === "new" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Input label="Nombre" name="responsible-name" value={newPerson.name} onChange={(event) => setNewPerson({ ...newPerson, name: event.target.value })} />
          <Input label="Correo" name="responsible-email" type="email" value={newPerson.email} onChange={(event) => setNewPerson({ ...newPerson, email: event.target.value })} />
          <Input label="Teléfono" name="responsible-phone" type="tel" value={newPerson.phone} onChange={(event) => setNewPerson({ ...newPerson, phone: event.target.value })} />
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Select label="Calidad" name="responsible-relation" value={relation} onChange={(event) => setRelation(event.target.value as ResponsibleRelation)}>
          {RELATIONS.map((item) => <option key={item} value={item}>{RESPONSIBLE_RELATION_LABEL[item]}</option>)}
        </Select>
        {relationNeedsNote(relation) && (
          <Input
            label={relation === "FAMILIAR" ? "Parentesco" : "Detalle"}
            name="responsible-note"
            placeholder={relation === "FAMILIAR" ? "hijo, madre, sobrina…" : ""}
            value={relationNote}
            onChange={(event) => setRelationNote(event.target.value)}
          />
        )}
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={canSign} onChange={(event) => setCanSign(event.target.checked)} />
        Puede firmar actas de conformidad
      </label>

      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}

      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button>
        <Button disabled={saving} onClick={handleSubmit}>{saving ? "Guardando…" : "Agregar"}</Button>
      </div>
    </div>
  );
}
