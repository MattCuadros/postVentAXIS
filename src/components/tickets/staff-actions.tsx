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
import { formatDateAndTime, isValidTime, todayIso } from "@/lib/format";
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
    /** La fecha puede quedar vacía (ej. agendar la visita al asignar equipo). */
    optional?: boolean;
  };
  /** Hora junto a la fecha: "required" exige hora cuando hay fecha; "optional" la deja libre. */
  time?: "required" | "optional";
  /** Texto del historial que describe la fecha elegida, ej. "Visita agendada para el". */
  dateNote?: string;
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
    date: { label: "Agendar visita inspectiva (opcional)", field: "visitDate", notBeforeToday: true, optional: true },
    time: "required",
    dateNote: "Visita agendada para el",
    comment: { label: "Indicaciones para el equipo (opcional)", required: false },
    submitLabel: "Asignar equipo",
  },
  VISITA_INSPECTIVA: {
    title: "Registrar visita inspectiva",
    date: { label: "Fecha de la visita", field: "visitDate", notAfterToday: true },
    time: "optional",
    comment: { label: "Diagnóstico", required: true, placeholder: "Qué encontraste y qué hay que hacer." },
    photos: true,
    category: true,
    submitLabel: "Registrar visita",
  },
  PROGRAMADO: {
    title: "Programar trabajo",
    description: "Agenda la fecha con el propietario antes de registrarla.",
    date: { label: "Fecha del trabajo", field: "scheduledDate", notBeforeToday: true },
    time: "required",
    dateNote: "Trabajo programado para el",
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
  /** Se llama tras agendar o reagendar la visita, con el texto a mostrar. */
  onVisitScheduled?: (message: string) => void;
}

export function StaffActions({
  ticket,
  role,
  userId,
  zoneId,
  projectId,
  onDone,
  onSpecialCase,
  onVisitScheduled,
}: StaffActionsProps) {
  const { transitionTicket, markSpecialCase } = useDataApi();
  const transitions = availableTransitions(ticket.status, role);
  const [open, setOpen] = useState<Transition | null>(null);
  const [running, setRunning] = useState<Transition | null>(null);
  const [markingSpecial, setMarkingSpecial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialOpen, setSpecialOpen] = useState(false);
  const [specialReason, setSpecialReason] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);

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
  const canScheduleVisit = ticket.status === "ASIGNADO" && role !== "PROPIETARIO";
  const busy = running !== null || markingSpecial;

  if (transitions.length === 0 && !canMarkSpecial && !canScheduleVisit) return null;

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
        {canScheduleVisit && (
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            disabled={busy}
            onClick={() => setScheduleOpen(true)}
          >
            {ticket.visitDate ? "Reagendar visita" : "Agendar visita"}
          </Button>
        )}
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

      <Dialog
        open={scheduleOpen}
        title={ticket.visitDate ? "Reagendar visita inspectiva" : "Agendar visita inspectiva"}
        onClose={() => setScheduleOpen(false)}
      >
        {scheduleOpen && (
          <ScheduleVisitForm
            ticket={ticket}
            userId={userId}
            onCancel={() => setScheduleOpen(false)}
            onSaved={(message) => {
              setScheduleOpen(false);
              onVisitScheduled?.(message);
            }}
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
  const initial = initialSchedule(spec, ticket, today);
  const [crewId, setCrewId] = useState("");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [categoryId, setCategoryId] = useState(ticket.categoryId);
  const [errors, setErrors] = useState<
    Partial<Record<"crew" | "date" | "time" | "comment" | "category", string>>
  >({});

  function buildSchema() {
    const commentField = spec.comment.required
      ? z.string().trim().min(10, spec.comment.label + ": escribe al menos 10 caracteres.")
      : z.string().trim();
    let dateField = spec.date?.optional ? z.string() : z.string().min(1, "Elige una fecha.");

    if (spec.date?.notAfterToday) {
      dateField = dateField.refine((value) => value === "" || value <= today, "La fecha no puede ser futura.");
    }
    if (spec.date?.notBeforeToday) {
      dateField = dateField.refine((value) => value === "" || value >= today, "La fecha no puede ser pasada.");
    }

    return z
      .object({
        crew: spec.crew ? z.string().min(1, "Elige un equipo.") : z.string(),
        date: spec.date ? dateField : z.string(),
        time: z.string().refine((value) => value === "" || isValidTime(value), "Hora no válida."),
        comment: commentField,
        category: spec.category ? z.string().min(1, "Confirma el origen de la falla.") : z.string(),
      })
      .superRefine((values, context) => {
        if (spec.time === "required" && values.date !== "" && values.time === "") {
          context.addIssue({ code: "custom", path: ["time"], message: "Indica la hora." });
        }
      });
  }

  function handleSubmit() {
    const result = buildSchema().safeParse({
      crew: crewId,
      date,
      time,
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
    let dateNote: string | undefined;
    if (spec.date && result.data.date !== "") {
      const selectedTime = result.data.time === "" ? null : result.data.time;
      changes[spec.date.field] = result.data.date;
      if (spec.date.field === "visitDate") changes.visitTime = selectedTime;
      else changes.scheduledTime = selectedTime;
      if (spec.dateNote) dateNote = spec.dateNote + " " + formatDateAndTime(result.data.date, selectedTime);
    }
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
    const text = [dateNote, result.data.comment || undefined, reclassified].filter(Boolean).join(" · ") || undefined;

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
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
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
          {spec.time && (
            <Input
              label={spec.time === "required" ? "Hora" : "Hora (opcional)"}
              name="transition-time"
              type="time"
              step={900}
              value={time}
              error={errors.time}
              onChange={(event) => {
                setTime(event.target.value);
                setErrors((current) => ({ ...current, time: undefined }));
              }}
            />
          )}
        </div>
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

interface ScheduleVisitFormProps {
  ticket: Ticket;
  userId: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

/** Agenda la visita inspectiva de un ticket ya asignado (fecha y hora obligatorias). */
function ScheduleVisitForm({ ticket, userId, onCancel, onSaved }: ScheduleVisitFormProps) {
  const { scheduleVisit } = useDataApi();
  const today = todayIso();
  const upcoming = ticket.visitDate !== null && ticket.visitDate >= today;
  const [date, setDate] = useState(upcoming && ticket.visitDate ? ticket.visitDate : "");
  const [time, setTime] = useState(upcoming ? (ticket.visitTime ?? "") : "");
  const [errors, setErrors] = useState<Partial<Record<"date" | "time", string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit() {
    const next: typeof errors = {};
    if (date === "") next.date = "Elige una fecha.";
    else if (date < today) next.date = "La fecha no puede ser pasada.";
    if (!isValidTime(time)) next.time = "Indica la hora.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    const verb = ticket.visitDate ? "Visita reagendada para el" : "Visita agendada para el";
    const message = verb + " " + formatDateAndTime(date, time);
    setSaving(true);
    setSaveError(null);
    try {
      await scheduleVisit(ticket.id, userId, date, time, message);
      onSaved(message + ".");
    } catch {
      setSaveError("No pudimos agendar la visita. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-secondary">Coordina la fecha con el propietario antes de registrarla.</p>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Input
          label="Fecha de la visita"
          name="visit-date"
          type="date"
          min={today}
          value={date}
          error={errors.date}
          onChange={(event) => {
            setDate(event.target.value);
            setErrors((current) => ({ ...current, date: undefined }));
          }}
        />
        <Input
          label="Hora"
          name="visit-time"
          type="time"
          step={900}
          value={time}
          error={errors.time}
          onChange={(event) => {
            setTime(event.target.value);
            setErrors((current) => ({ ...current, time: undefined }));
          }}
        />
      </div>
      {saveError && <p className="text-sm text-danger" role="alert">{saveError}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button>
        <Button disabled={saving} onClick={handleSubmit}>{saving ? "Guardando…" : "Guardar visita"}</Button>
      </div>
    </div>
  );
}

/**
 * Fecha y hora con que abre cada formulario: la visita registrada parte en la agendada (si ya
 * ocurrió) y la reprogramación de un trabajo parte en la fecha vigente (si no ha pasado).
 */
function initialSchedule(spec: FormSpec, ticket: Ticket, today: string): { date: string; time: string } {
  if (spec.date?.field === "visitDate" && spec.date.notAfterToday) {
    const agreed = ticket.visitDate !== null && ticket.visitDate <= today;
    return {
      date: agreed && ticket.visitDate ? ticket.visitDate : today,
      time: agreed ? (ticket.visitTime ?? "") : "",
    };
  }
  if (spec.date?.field === "scheduledDate" && ticket.scheduledDate !== null && ticket.scheduledDate >= today) {
    return { date: ticket.scheduledDate, time: ticket.scheduledTime ?? "" };
  }
  return { date: "", time: "" };
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
