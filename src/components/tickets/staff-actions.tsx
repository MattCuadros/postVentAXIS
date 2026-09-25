"use client";

import { useCallback, useState } from "react";
import { z } from "zod";
import { PhotoPicker, type PickedPhoto } from "@/components/tickets/photo-picker";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/format";
import { availableTransitions, type Transition } from "@/lib/ticket-status";
import type { Role, Ticket, TicketChanges, TicketStatus, WorkCrew, WorkCrewType } from "@/types/domain";

const MAX_PHOTOS = 5;

interface FormSpec {
  title: string;
  description?: string;
  crew?: boolean;
  date?: {
    label: string;
    field: "visitDate" | "scheduledDate";
    notAfterToday?: boolean;
    notBeforeToday?: boolean;
  };
  comment: { label: string; required: boolean; placeholder?: string };
  photos?: boolean;
  category?: boolean;
  rejection?: boolean;
  submitLabel: string;
}

const FORMS: Partial<Record<TicketStatus, FormSpec>> = {
  ASIGNADO: {
    title: "Asignar equipo",
    crew: true,
    comment: { label: "Indicaciones para el equipo (opcional)", required: false },
    submitLabel: "Asignar equipo",
  },
  VISITA_INSPECTIVA: {
    title: "Registrar visita inspectiva",
    date: { label: "Fecha de la visita", field: "visitDate", notAfterToday: true },
    comment: { label: "Diagnóstico", required: true, placeholder: "Qué encontraste y qué hay que hacer." },
    photos: true,
    category: true,
    submitLabel: "Registrar visita",
  },
  PROGRAMADO: {
    title: "Programar trabajo",
    description: "Agenda la fecha con el propietario antes de registrarla.",
    date: { label: "Fecha del trabajo", field: "scheduledDate", notBeforeToday: true },
    comment: { label: "Nota para el propietario (opcional)", required: false, placeholder: "Ej.: llegaremos entre 9:00 y 11:00." },
    submitLabel: "Programar",
  },
  EN_RECEPCION: {
    title: "Solicitar recepción",
    description: "El propietario verá el aviso para dar su conformidad.",
    comment: { label: "Trabajo realizado", required: true, placeholder: "Qué se hizo y con qué materiales." },
    photos: true,
    submitLabel: "Solicitar recepción",
  },
  NO_PROCEDE: {
    title: "Marcar como no procede",
    description: "El propietario leerá este motivo. Explica si es por mal uso o está fuera de garantía.",
    comment: { label: "Motivo", required: true },
    rejection: true,
    submitLabel: "Confirmar: no procede",
  },
};

const CREW_TYPE_LABEL: Record<WorkCrewType, string> = {
  INTERNO: "Cuadrilla interna",
  SUBCONTRATO: "Subcontrato",
};

interface StaffActionsProps {
  ticket: Ticket;
  role: Role;
  userId: string;
  zoneId: string;
  projectId: string;
  onDone?: (transition: Transition) => void;
  onSpecialCase?: () => void;
}

export function StaffActions({
  ticket,
  role,
  userId,
  zoneId,
  projectId,
  onDone,
  onSpecialCase,
}: StaffActionsProps) {
  const { transitionTicket, markSpecialCase } = useDataApi();
  const transitions = availableTransitions(ticket.status, role);
  const [open, setOpen] = useState<Transition | null>(null);
  const [running, setRunning] = useState<Transition | null>(null);
  const [markingSpecial, setMarkingSpecial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialOpen, setSpecialOpen] = useState(false);
  const [specialReason, setSpecialReason] = useState("");

  async function run(transition: Transition, comment?: string, changes: TicketChanges = {}) {
    setRunning(transition);
    setError(null);
    try {
      const withOwner = ticket.encargadoId === null
        ? { ...changes, encargadoId: userId }
        : changes;
      await transitionTicket(ticket.id, transition.to, userId, comment, withOwner);
      setOpen(null);
      onDone?.(transition);
    } catch {
      setError("No pudimos guardar el cambio. Intenta nuevamente.");
    } finally {
      setRunning(null);
    }
  }

  function closeSpecialDialog() {
    if (markingSpecial) return;
    setSpecialOpen(false);
    setSpecialReason("");
    setError(null);
  }

  async function handleMarkSpecial() {
    setMarkingSpecial(true);
    setError(null);
    try {
      await markSpecialCase(ticket.id, userId, specialReason.trim());
      setSpecialOpen(false);
      setSpecialReason("");
      onSpecialCase?.();
    } catch {
      setError("No pudimos guardar el caso especial. Intenta nuevamente.");
    } finally {
      setMarkingSpecial(false);
    }
  }

  const canMarkSpecial =
    ticket.specialCase === null &&
    ["EN_REVISION", "VISITA_INSPECTIVA"].includes(ticket.status) &&
    role !== "PROPIETARIO";
  const busy = running !== null || markingSpecial;

  if (transitions.length === 0 && !canMarkSpecial) return null;

  const spec = open ? FORMS[open.to] : undefined;

  return (
    <>
      <div className="flex flex-col gap-3">
        {transitions.map((transition, index) => (
          <Button
            key={transition.to}
            fullWidth
            size="lg"
            variant={transition.to === "NO_PROCEDE" ? "danger" : index === 0 ? "primary" : "secondary"}
            disabled={busy}
            onClick={() => (FORMS[transition.to] ? setOpen(transition) : void run(transition))}
          >
            {running === transition && !open ? "Guardando…" : transition.action}
          </Button>
        ))}
        {canMarkSpecial && (
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            disabled={busy}
            onClick={() => setSpecialOpen(true)}
          >
            Atender como caso especial
          </Button>
        )}
        {error && !open && !specialOpen && (
          <p className="text-sm text-danger" role="alert">{error}</p>
        )}
      </div>

      <Dialog
        open={open !== null}
        title={spec?.title}
        onClose={() => running === null && setOpen(null)}
      >
        {open && spec && (
          <TransitionForm
            key={open.to}
            spec={spec}
            zoneId={zoneId}
            projectId={projectId}
            ticket={ticket}
            userId={userId}
            busy={busy}
            error={error}
            onCancel={() => setOpen(null)}
            onSubmit={(comment, changes) => run(open, comment, changes)}
          />
        )}
      </Dialog>

      <Dialog open={specialOpen} title="Atender como caso especial" onClose={closeSpecialDialog}>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-ink-secondary">
            Axis atenderá este requerimiento aunque no califique por garantía. El flujo se mantiene sin cambios.
          </p>
          <Textarea
            label="Motivo"
            name="special-case-reason"
            value={specialReason}
            maxLength={1000}
            error={
              specialReason.trim().length > 0 && specialReason.trim().length < 10
                ? "Escribe al menos 10 caracteres."
                : undefined
            }
            onChange={(event) => setSpecialReason(event.target.value)}
          />
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={markingSpecial} onClick={closeSpecialDialog}>
              Cancelar
            </Button>
            <Button
              disabled={markingSpecial || specialReason.trim().length < 10}
              onClick={handleMarkSpecial}
            >
              {markingSpecial ? "Guardando…" : "Confirmar caso especial"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

interface TransitionFormProps {
  spec: FormSpec;
  zoneId: string;
  projectId: string;
  ticket: Ticket;
  userId: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (comment: string | undefined, changes: TicketChanges) => void;
}

function TransitionForm({
  spec,
  zoneId,
  projectId,
  ticket,
  userId,
  busy,
  error,
  onCancel,
  onSubmit,
}: TransitionFormProps) {
  const { getCrewsByZone, getCategories } = useDataApi();
  const { data: crews } = useQuery(
    useCallback(() => getCrewsByZone(zoneId), [getCrewsByZone, zoneId]),
  );
  const { data: categories } = useQuery(
    useCallback(() => (spec.category ? getCategories() : Promise.resolve([])), [getCategories, spec.category]),
  );
  const today = todayIso();
  const projectCrews = crews?.filter((crew) => crew.projectIds.includes(projectId)) ?? [];
  const otherCrews = crews?.filter((crew) => !crew.projectIds.includes(projectId)) ?? [];
  const [crewId, setCrewId] = useState("");
  const [date, setDate] = useState(spec.date?.notAfterToday ? today : "");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [categoryId, setCategoryId] = useState(ticket.categoryId);
  const [errors, setErrors] = useState<
    Partial<Record<"crew" | "date" | "comment" | "category", string>>
  >({});

  function buildSchema() {
    const commentField = spec.comment.required
      ? z.string().trim().min(10, spec.comment.label + ": escribe al menos 10 caracteres.")
      : z.string().trim();
    let dateField = z.string().min(1, "Elige una fecha.");

    if (spec.date?.notAfterToday) {
      dateField = dateField.refine((value) => value <= today, "La fecha no puede ser futura.");
    }
    if (spec.date?.notBeforeToday) {
      dateField = dateField.refine((value) => value >= today, "La fecha no puede ser pasada.");
    }

    return z.object({
      crew: spec.crew ? z.string().min(1, "Elige un equipo.") : z.string(),
      date: spec.date ? dateField : z.string(),
      comment: commentField,
      category: spec.category ? z.string().min(1, "Confirma el origen de la falla.") : z.string(),
    });
  }

  function handleSubmit() {
    const result = buildSchema().safeParse({
      crew: crewId,
      date,
      comment,
      category: categoryId,
    });

    if (!result.success) {
      const next: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof typeof errors;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    const now = new Date().toISOString();
    const changes: TicketChanges = {};

    if (spec.crew) changes.crewId = result.data.crew;
    if (spec.category) changes.categoryId = result.data.category;
    if (spec.date) changes[spec.date.field] = result.data.date;
    if (spec.photos && photos.length > 0) {
      changes.photos = photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        uploadedById: userId,
        createdAt: now,
      }));
    }

    const previous = categories?.find((item) => item.id === ticket.categoryId)?.name;
    const confirmed = categories?.find((item) => item.id === result.data.category)?.name;
    const reclassified = spec.category && result.data.category !== ticket.categoryId
      ? "Origen reclasificado: " + (previous ?? "—") + " → " + (confirmed ?? "—")
      : undefined;
    const text = [result.data.comment || undefined, reclassified].filter(Boolean).join(" · ") || undefined;

    if (spec.rejection && text) changes.rejectionReason = text;
    onSubmit(text, changes);
  }

  return (
    <div className="flex flex-col gap-5">
      {spec.description && <p className="text-sm text-ink-secondary">{spec.description}</p>}

      {spec.crew && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">Equipo de trabajo</legend>
          {crews === undefined ? (
            <div role="status" aria-label="Cargando equipos…" className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : crews.length === 0 ? (
            <p className="text-sm text-ink-secondary">No hay equipos registrados en esta zona.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {projectCrews.length > 0 && (
                <p className="text-xs font-bold text-ink-secondary">Equipos de esta obra</p>
              )}
              {projectCrews.map((crew) => (
                <CrewOption
                  key={crew.id}
                  crew={crew}
                  checked={crewId === crew.id}
                  onChange={() => {
                    setCrewId(crew.id);
                    setErrors((current) => ({ ...current, crew: undefined }));
                  }}
                />
              ))}
              {otherCrews.length > 0 && (
                <p className="pt-2 text-xs font-bold text-ink-secondary">Otros equipos de la zona</p>
              )}
              {otherCrews.map((crew) => (
                <CrewOption
                  key={crew.id}
                  crew={crew}
                  checked={crewId === crew.id}
                  onChange={() => {
                    setCrewId(crew.id);
                    setErrors((current) => ({ ...current, crew: undefined }));
                  }}
                />
              ))}
            </div>
          )}
          {errors.crew && <p className="mt-2 text-sm text-danger" role="alert">{errors.crew}</p>}
        </fieldset>
      )}

      {spec.date && (
        <Input
          label={spec.date.label}
          name="transition-date"
          type="date"
          value={date}
          min={spec.date.notBeforeToday ? today : undefined}
          max={spec.date.notAfterToday ? today : undefined}
          error={errors.date}
          onChange={(event) => {
            setDate(event.target.value);
            setErrors((current) => ({ ...current, date: undefined }));
          }}
        />
      )}

      {spec.category && (
        <Select
          label="Origen de la falla"
          name="transition-category"
          value={categoryId}
          error={errors.category}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setErrors((current) => ({ ...current, category: undefined }));
          }}
        >
          <option value="" disabled>Selecciona el origen</option>
          {categories?.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </Select>
      )}

      <Textarea
        label={spec.comment.label}
        name="transition-comment"
        placeholder={spec.comment.placeholder}
        value={comment}
        maxLength={1000}
        error={errors.comment}
        onChange={(event) => {
          setComment(event.target.value);
          setErrors((current) => ({ ...current, comment: undefined }));
        }}
      />

      {spec.photos && (
        <div>
          <p className="mb-2 text-sm font-bold text-ink">Fotos de terreno (opcional)</p>
          <PhotoPicker
            photos={photos}
            max={MAX_PHOTOS}
            onAdd={(added) => setPhotos((current) => [...current, ...added])}
            onRemove={(id) => setPhotos((current) => current.filter((photo) => photo.id !== id))}
          />
        </div>
      )}

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>Cancelar</Button>
        <Button
          variant={spec.rejection ? "danger" : "primary"}
          disabled={busy}
          onClick={handleSubmit}
        >
          {busy ? "Guardando…" : spec.submitLabel}
        </Button>
      </div>
    </div>
  );
}

function CrewOption({
  crew,
  checked,
  onChange,
}: {
  crew: WorkCrew;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "block cursor-pointer rounded-md border p-3 transition-colors focus-within:ring-2 focus-within:ring-accent",
        checked ? "border-accent bg-accent-soft" : "border-line-soft hover:border-accent/40",
      )}
    >
      <input
        type="radio"
        name="crew"
        className="sr-only"
        checked={checked}
        onChange={onChange}
      />
      <span className="block font-bold text-ink">{crew.name}</span>
      <span className="block text-xs text-ink-secondary">
        {CREW_TYPE_LABEL[crew.type]} · {crew.contactName} · {crew.phone}
      </span>
    </label>
  );
}
