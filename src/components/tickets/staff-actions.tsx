"use client";

import { useCallback, useState } from "react";
import { z } from "zod";
import { PhotoPicker, type PickedPhoto } from "@/components/tickets/photo-picker";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDataApi } from "@/data/api";
import { useQuery } from "@/data/use-query";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/format";
import { availableTransitions, type Transition } from "@/lib/ticket-status";
import type { Role, Ticket, TicketChanges, TicketStatus, WorkCrewType } from "@/types/domain";

const MAX_PHOTOS = 5;

interface FormSpec {
  title: string;
  description?: string;
  /** Pide elegir un equipo de la zona de la obra. */
  crew?: boolean;
  date?: { label: string; field: "visitDate" | "scheduledDate"; notAfterToday?: boolean; notBeforeToday?: boolean };
  comment: { label: string; required: boolean; placeholder?: string };
  photos?: boolean;
  /** El comentario se guarda además como `rejectionReason` (lo lee el propietario). */
  rejection?: boolean;
  submitLabel: string;
}

/**
 * Formulario de cada transición del equipo Axis, por estado destino.
 * Las transiciones sin entrada aquí ("Iniciar revisión", "Iniciar trabajo") se ejecutan directo.
 */
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
    description: "El propietario va a leer este motivo. Explica con claridad si es por mal uso o si está fuera de garantía.",
    comment: { label: "Motivo", required: true },
    rejection: true,
    submitLabel: "Confirmar: no procede",
  },
};

const CREW_TYPE_LABEL: Record<WorkCrewType, string> = { INTERNO: "Cuadrilla interna", SUBCONTRATO: "Subcontrato" };

interface StaffActionsProps {
  ticket: Ticket;
  role: Role;
  userId: string;
  /** Zona de la obra: define qué equipos se pueden asignar. */
  zoneId: string;
  onDone?: (transition: Transition) => void;
}

/** Acciones del encargado (o admin) sobre un ticket, según su estado. */
export function StaffActions({ ticket, role, userId, zoneId, onDone }: StaffActionsProps) {
  const { transitionTicket } = useDataApi();
  const transitions = availableTransitions(ticket.status, role);
  const [open, setOpen] = useState<Transition | null>(null);
  const [running, setRunning] = useState<Transition | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(transition: Transition, comment?: string, changes: TicketChanges = {}) {
    setRunning(transition);
    setError(null);
    try {
      // Quien mueve el ticket por primera vez queda como su encargado.
      const withOwner = ticket.encargadoId === null ? { ...changes, encargadoId: userId } : changes;
      await transitionTicket(ticket.id, transition.to, userId, comment, withOwner);
      setOpen(null);
      onDone?.(transition);
    } catch {
      setError("No pudimos guardar el cambio. Intenta nuevamente.");
    } finally {
      setRunning(null);
    }
  }

  if (transitions.length === 0) return null;

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
            disabled={running !== null}
            onClick={() => (FORMS[transition.to] ? setOpen(transition) : void run(transition))}
          >
            {running === transition && !open ? "Guardando…" : transition.action}
          </Button>
        ))}
        {error && !open && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>

      <Dialog open={open !== null} title={spec?.title} onClose={() => running === null && setOpen(null)}>
        {open && spec && (
          <TransitionForm
            key={open.to}
            spec={spec}
            zoneId={zoneId}
            userId={userId}
            busy={running !== null}
            error={error}
            onCancel={() => setOpen(null)}
            onSubmit={(comment, changes) => run(open, comment, changes)}
          />
        )}
      </Dialog>
    </>
  );
}

interface TransitionFormProps {
  spec: FormSpec;
  zoneId: string;
  userId: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (comment: string | undefined, changes: TicketChanges) => void;
}

function TransitionForm({ spec, zoneId, userId, busy, error, onCancel, onSubmit }: TransitionFormProps) {
  const { getCrewsByZone } = useDataApi();
  const { data: crews } = useQuery(useCallback(() => getCrewsByZone(zoneId), [getCrewsByZone, zoneId]));
  const today = todayIso();

  const [crewId, setCrewId] = useState("");
  const [date, setDate] = useState(spec.date?.notAfterToday ? today : "");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [errors, setErrors] = useState<Partial<Record<"crew" | "date" | "comment", string>>>({});

  function buildSchema() {
    const commentField = spec.comment.required
      ? z.string().trim().min(10, `${spec.comment.label}: escribe al menos 10 caracteres.`)
      : z.string().trim();
    let dateField = z.string().min(1, "Elige una fecha.");
    if (spec.date?.notAfterToday) dateField = dateField.refine((value) => value <= today, "La fecha no puede ser futura.");
    if (spec.date?.notBeforeToday) dateField = dateField.refine((value) => value >= today, "La fecha no puede ser pasada.");

    return z.object({
      crew: spec.crew ? z.string().min(1, "Elige un equipo.") : z.string(),
      date: spec.date ? dateField : z.string(),
      comment: commentField,
    });
  }

  function handleSubmit() {
    const result = buildSchema().safeParse({ crew: crewId, date, comment });
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
    if (spec.date) changes[spec.date.field] = result.data.date;
    if (spec.photos && photos.length > 0) {
      changes.photos = photos.map((photo) => ({ id: photo.id, url: photo.url, uploadedById: userId, createdAt: now }));
    }
    const text = result.data.comment || undefined;
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
            <p className="text-sm text-ink-secondary" role="status">Cargando equipos…</p>
          ) : crews.length === 0 ? (
            <p className="text-sm text-ink-secondary">No hay equipos registrados en esta zona.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {crews.map((crew) => (
                <label
                  key={crew.id}
                  className={cn(
                    "block cursor-pointer rounded-md border p-3 transition-colors focus-within:ring-2 focus-within:ring-accent",
                    crewId === crew.id ? "border-accent bg-accent-soft" : "border-line-soft hover:border-accent/40",
                  )}
                >
                  <input
                    type="radio"
                    name="crew"
                    className="sr-only"
                    checked={crewId === crew.id}
                    onChange={() => {
                      setCrewId(crew.id);
                      setErrors((current) => ({ ...current, crew: undefined }));
                    }}
                  />
                  <span className="block font-bold text-ink">{crew.name}</span>
                  <span className="block text-xs text-ink-secondary">
                    {CREW_TYPE_LABEL[crew.type]} · {crew.contactName} · {crew.phone}
                  </span>
                </label>
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
        <Button variant={spec.rejection ? "danger" : "primary"} disabled={busy} onClick={handleSubmit}>
          {busy ? "Guardando…" : spec.submitLabel}
        </Button>
      </div>
    </div>
  );
}
