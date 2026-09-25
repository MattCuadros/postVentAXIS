"use client";

import type { ImportDraft, DraftSources } from "@/components/tickets/import-draft";
import { AlertIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { DOCUMENT_PATH } from "@/lib/document-import/plan";
import { formatDateAndTime, formatLongDate, unitLabel } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/ticket-status";
import type { DocumentKind, Project, UnitType } from "@/types/domain";

interface ImportDraftCardProps {
  index: number;
  draft: ImportDraft;
  kind: DocumentKind;
  projects: Project[];
  sources: DraftSources;
  errors: Record<string, string>;
  onChange: (draft: ImportDraft) => void;
}

/** Revisión de un requerimiento leído del documento: todo editable antes de registrarlo. */
export function ImportDraftCard({ index, draft, kind, projects, sources, errors, onChange }: ImportDraftCardProps) {
  const linked = draft.linkedTicketId ? sources.tickets.find((ticket) => ticket.id === draft.linkedTicketId) : undefined;
  const projectUnits = sources.units.filter((unit) => unit.projectId === draft.projectId);
  const unit = sources.units.find((item) => item.id === draft.unitId);
  const owners = sources.users.filter((user) => user.role === "PROPIETARIO" && user.active);
  const unitOwner = unit ? sources.users.find((user) => user.id === unit.ownerId) : undefined;
  const target = DOCUMENT_PATH[kind][DOCUMENT_PATH[kind].length - 1];
  const parsed = draft.parsed;

  function update(changes: Partial<ImportDraft>) {
    onChange({ ...draft, ...changes });
  }

  const readDates = [
    parsed.requestDate ? `Solicitud: ${formatLongDate(parsed.requestDate)}` : null,
    parsed.visit ? `Visita: ${formatDateAndTime(parsed.visit.date, parsed.visit.time)}` : null,
    parsed.execution.length > 0
      ? `Ejecución: ${parsed.execution.map((item) => formatDateAndTime(item.date, item.time)).join(" · ")}`
      : null,
    parsed.repairDate ? `Reparación: ${formatLongDate(parsed.repairDate)}` : null,
  ].filter(Boolean);

  return (
    <section
      className={cn(
        "rounded-lg border bg-surface p-5 shadow-card transition-opacity",
        draft.include ? "border-line-soft" : "border-dashed border-line opacity-60",
      )}
      aria-label={`Requerimiento ${index + 1}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base text-ink">Requerimiento {index + 1}</h3>
          <p className="mt-0.5 text-xs text-ink-secondary">
            {linked
              ? `Se enlaza con ${linked.folio}: avanza hasta "${STATUS_LABEL[target]}".`
              : `Se crea un requerimiento en estado "${STATUS_LABEL[target]}".`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input type="checkbox" checked={draft.include} onChange={(event) => update({ include: event.target.checked })} />
          Incluir
        </label>
      </header>

      {parsed.warnings.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {parsed.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertIcon className="mt-px h-4 w-4 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      )}

      {draft.include && (
        <div className="mt-4 flex flex-col gap-4">
          {linked ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-ink">
              <span className="font-bold text-accent">{linked.folio}</span>
              <StatusBadge status={linked.status} />
              <span className="text-ink-secondary">
                {[projects.find((project) => project.id === draft.projectId)?.name, unit ? unitLabel(unit) : null].filter(Boolean).join(" · ")}
              </span>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Obra"
                  name={`project-${draft.key}`}
                  value={draft.projectId}
                  error={errors.project}
                  onChange={(event) => update({ projectId: event.target.value, unitId: "", unitMode: "existing" })}
                >
                  <option value="">{parsed.projectHint ? `Leído: "${parsed.projectHint}" · elige la obra` : "Elige la obra"}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </Select>
                <Select
                  label="Unidad"
                  name={`unit-${draft.key}`}
                  value={draft.unitMode === "new" ? "__new" : draft.unitId}
                  error={errors.unit}
                  disabled={!draft.projectId}
                  onChange={(event) =>
                    event.target.value === "__new"
                      ? update({ unitMode: "new", unitId: "" })
                      : update({ unitMode: "existing", unitId: event.target.value })
                  }
                >
                  <option value="">{parsed.unitHint ? `Leído: "${parsed.unitHint}" · elige la unidad` : "Elige la unidad"}</option>
                  {projectUnits.map((item) => (
                    <option key={item.id} value={item.id}>{unitLabel(item)}</option>
                  ))}
                  <option value="__new">+ Crear unidad nueva</option>
                </Select>
              </div>

              {draft.unitMode === "existing" && unitOwner && (
                <p className="-mt-2 text-xs text-ink-meta">Propietario registrado: {unitOwner.name}</p>
              )}

              {draft.unitMode === "new" && (
                <div className="rounded-md bg-surface-secondary p-4">
                  <p className="mb-3 text-xs font-bold text-ink-secondary">Unidad nueva en la obra</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Select
                      label="Tipo"
                      name={`unit-type-${draft.key}`}
                      value={draft.newUnit.type}
                      onChange={(event) => update({ newUnit: { ...draft.newUnit, type: event.target.value as UnitType } })}
                    >
                      <option value="CASA">Casa</option>
                      <option value="DEPARTAMENTO">Departamento</option>
                    </Select>
                    {draft.newUnit.type === "DEPARTAMENTO" && (
                      <Input
                        label="Torre"
                        name={`unit-tower-${draft.key}`}
                        value={draft.newUnit.tower}
                        onChange={(event) => update({ newUnit: { ...draft.newUnit, tower: event.target.value } })}
                      />
                    )}
                    <Input
                      label="Número"
                      name={`unit-number-${draft.key}`}
                      value={draft.newUnit.number}
                      onChange={(event) => update({ newUnit: { ...draft.newUnit, number: event.target.value } })}
                    />
                  </div>
                  <div className="mt-3">
                    <Select
                      label="Propietario"
                      name={`owner-${draft.key}`}
                      value={draft.ownerMode === "new" ? "__new" : draft.ownerId}
                      error={errors.owner}
                      onChange={(event) =>
                        event.target.value === "__new"
                          ? update({ ownerMode: "new", ownerId: "" })
                          : update({ ownerMode: "existing", ownerId: event.target.value })
                      }
                    >
                      <option value="">Elige el propietario</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>{owner.name} · {owner.email}</option>
                      ))}
                      <option value="__new">+ Crear propietario con los datos leídos</option>
                    </Select>
                  </div>
                  {draft.ownerMode === "new" && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Input
                        label="Nombre"
                        name={`owner-name-${draft.key}`}
                        value={draft.newOwner.name}
                        onChange={(event) => update({ newOwner: { ...draft.newOwner, name: event.target.value } })}
                      />
                      <Input
                        label="Correo"
                        name={`owner-email-${draft.key}`}
                        type="email"
                        value={draft.newOwner.email}
                        onChange={(event) => update({ newOwner: { ...draft.newOwner, email: event.target.value } })}
                      />
                      <Input
                        label="Teléfono"
                        name={`owner-phone-${draft.key}`}
                        type="tel"
                        value={draft.newOwner.phone}
                        onChange={(event) => update({ newOwner: { ...draft.newOwner, phone: event.target.value } })}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Recinto"
                  name={`room-${draft.key}`}
                  value={draft.room}
                  error={errors.room}
                  onChange={(event) => update({ room: event.target.value })}
                />
                <Select
                  label="Origen de la falla"
                  name={`category-${draft.key}`}
                  value={draft.categoryId}
                  error={errors.category}
                  onChange={(event) => update({ categoryId: event.target.value })}
                >
                  <option value="">Elige el origen</option>
                  {sources.categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </Select>
              </div>
              <Textarea
                label="Descripción"
                name={`description-${draft.key}`}
                value={draft.description}
                error={errors.description}
                maxLength={2000}
                onChange={(event) => update({ description: event.target.value })}
              />
            </>
          )}

          {(readDates.length > 0 || parsed.externalRefs.length > 0) && (
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-secondary">
              {readDates.map((line) => (
                <dd key={line}>{line}</dd>
              ))}
              {parsed.externalRefs.length > 0 && <dd>Referencias: {parsed.externalRefs.join(" · ")}</dd>}
            </dl>
          )}
        </div>
      )}
    </section>
  );
}
