"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { z } from "zod";
import { MediaPicker, type PickedMedia } from "@/components/tickets/media-picker";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { cn } from "@/lib/cn";
import { unitLabel } from "@/lib/format";

const STEPS = ["Vivienda", "Tipo de problema", "Descripción", "Confirmar"] as const;
const MAX_MEDIA = 5;

function mediaSummary(media: PickedMedia[]): string {
  if (media.length === 0) return "Sin fotos ni video";
  const photos = media.filter((item) => item.type === "IMAGE").length;
  const videos = media.length - photos;
  return [
    photos > 0 && `${photos} ${photos === 1 ? "foto" : "fotos"}`,
    videos > 0 && `${videos} ${videos === 1 ? "video" : "videos"}`,
  ].filter(Boolean).join(" y ");
}

const ROOMS = [
  "Baño principal",
  "Baño secundario",
  "Cocina",
  "Living",
  "Comedor",
  "Dormitorio principal",
  "Dormitorio 2",
  "Dormitorio 3",
  "Logia",
  "Terraza",
  "Exterior",
  "Otro",
];

/** Validación por paso: solo se revisan los campos del paso actual al presionar "Continuar". */
const STEP_SCHEMAS = [
  z.object({ unitId: z.string().min(1, "Elige la vivienda donde está el problema.") }),
  z.object({
    categoryId: z.string().min(1, "Elige el tipo de problema."),
    room: z.string().min(1, "Indica en qué recinto está."),
  }),
  z.object({
    description: z
      .string()
      .trim()
      .min(15, "Cuéntanos un poco más (mínimo 15 caracteres).")
      .max(1000, "La descripción no puede superar los 1.000 caracteres."),
  }),
  z.object({}),
];

interface FormState {
  unitId: string;
  categoryId: string;
  room: string;
  description: string;
  media: PickedMedia[];
}

type Errors = Partial<Record<keyof FormState, string>>;

export function NewTicketWizard() {
  const router = useRouter();
  const { user } = useSession();
  const api = useDataApi();
  const ownerId = user?.id;

  const { data: units } = useQuery(
    useCallback(async () => (ownerId ? api.getUnitsByOwner(ownerId) : []), [api, ownerId]),
  );
  const { data: projects } = useQuery(api.getProjects);
  const { data: categories } = useQuery(api.getCategories);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    unitId: "",
    categoryId: "",
    room: "",
    description: "",
    media: [],
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Con una sola vivienda no hace falta elegir: se preselecciona.
  const unitId = form.unitId || (units?.length === 1 ? units[0].id : "");
  const unit = units?.find((item) => item.id === unitId);
  const project = projects?.find((item) => item.id === unit?.projectId);
  const category = categories?.find((item) => item.id === form.categoryId);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validateStep(): boolean {
    const result = STEP_SCHEMAS[step].safeParse({ ...form, unitId });
    if (result.success) {
      setErrors({});
      return true;
    }
    const nextErrors: Errors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FormState;
      nextErrors[field] ??= issue.message;
    }
    setErrors(nextErrors);
    return false;
  }

  function handleContinue() {
    if (validateStep()) setStep((current) => current + 1);
  }

  function handleBack() {
    setErrors({});
    setStep((current) => current - 1);
  }

  async function handleSubmit() {
    if (user === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const now = new Date().toISOString();
      const ticket = await api.createTicket({
        unitId,
        categoryId: form.categoryId,
        room: form.room,
        description: form.description.trim(),
        media: form.media.map((item) => ({ ...item, stage: "PROBLEMA", uploadedById: user.id, createdAt: now })),
        createdById: user.id,
        encargadoId: null,
        crewId: null,
        visitDate: null,
        scheduledDate: null,
        rejectionReason: null,
      });
      router.replace(`/propietario/tickets/${ticket.id}?creado=1`);
    } catch {
      setSubmitError("No pudimos enviar tu requerimiento. Intenta nuevamente.");
      setSubmitting(false);
    }
  }

  const context = [unit && unitLabel(unit), category?.name].filter(Boolean).join(" · ");

  return (
    <>
      <header className="-mx-4 -mt-6 border-b border-line-soft bg-surface px-4 pb-4 pt-4 sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          {step === 0 ? (
            <Link href="/propietario" aria-label="Volver a mis requerimientos" className="flex h-9 w-9 items-center justify-center rounded-md text-accent hover:bg-accent-soft">
              <ChevronLeftIcon />
            </Link>
          ) : (
            <button type="button" aria-label="Paso anterior" onClick={handleBack} className="flex h-9 w-9 items-center justify-center rounded-md text-accent hover:bg-accent-soft">
              <ChevronLeftIcon />
            </button>
          )}
          <p className="font-bold text-ink">Nuevo requerimiento</p>
        </div>
        <ol className="mt-4 flex gap-1.5" aria-label={`Paso ${step + 1} de ${STEPS.length}: ${STEPS[step]}`}>
          {STEPS.map((label, index) => (
            <li key={label} aria-hidden className={cn("h-1 flex-1 rounded-pill", index <= step ? "bg-accent" : "bg-line")} />
          ))}
        </ol>
        <p className="mt-2 text-xs text-ink-secondary">
          Paso {step + 1} de {STEPS.length}
          {context && ` · ${context}`}
        </p>
      </header>

      <section className="pt-6" aria-live="polite">
        {step === 0 && (
          <StepBody title="¿Dónde está el problema?">
            {units === undefined ? (
              <Loading />
            ) : units.length === 0 ? (
              <p className="text-sm text-ink-secondary">
                No tienes viviendas asociadas. Escríbenos a postventa para revisar tu registro.
              </p>
            ) : (
              <fieldset>
                <legend className="mb-3 text-sm font-bold text-ink">Vivienda</legend>
                <div className="flex flex-col gap-3">
                  {units.map((item) => (
                    <ChoiceCard key={item.id} name="unit" checked={unitId === item.id} onChange={() => update("unitId", item.id)}>
                      <span className="block font-bold text-ink">{unitLabel(item)}</span>
                      <span className="block text-sm text-ink-secondary">
                        {projects?.find((p) => p.id === item.projectId)?.name}
                      </span>
                    </ChoiceCard>
                  ))}
                </div>
                <FieldError message={errors.unitId} />
              </fieldset>
            )}
          </StepBody>
        )}

        {step === 1 && (
          <StepBody title="¿Qué tipo de problema es?">
            {categories === undefined ? (
              <Loading />
            ) : (
              <fieldset>
                <legend className="mb-3 text-sm font-bold text-ink">Tipo de problema</legend>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map((item) => (
                    <ChoiceCard key={item.id} name="category" checked={form.categoryId === item.id} onChange={() => update("categoryId", item.id)}>
                      <span className="block font-bold text-ink">{item.name}</span>
                    </ChoiceCard>
                  ))}
                </div>
                <FieldError message={errors.categoryId} />
              </fieldset>
            )}
            <div className="mt-6">
              <Select label="Recinto" name="room" value={form.room} error={errors.room} onChange={(event) => update("room", event.target.value)}>
                <option value="" disabled>Selecciona el recinto</option>
                {ROOMS.map((room) => <option key={room} value={room}>{room}</option>)}
              </Select>
            </div>
          </StepBody>
        )}

        {step === 2 && (
          <StepBody title="Cuéntanos qué pasa">
            <Textarea
              label="Descripción"
              name="description"
              placeholder="Ejemplo: hay una filtración bajo el lavamanos y se moja el mueble."
              value={form.description}
              error={errors.description}
              maxLength={1000}
              onChange={(event) => update("description", event.target.value)}
            />
            {!errors.description && (
              <p className="mt-1.5 text-xs text-ink-meta">Mientras más detalle, menos visitas necesitamos.</p>
            )}
            <p className="mb-3 mt-6 text-sm font-bold text-ink">Fotos o video</p>
            <MediaPicker
              items={form.media}
              max={MAX_MEDIA}
              onAdd={(added) => update("media", [...form.media, ...added])}
              onRemove={(id) => update("media", form.media.filter((item) => item.id !== id))}
            />
          </StepBody>
        )}

        {step === 3 && (
          <StepBody title="Revisa y envía">
            <dl className="divide-y divide-line-soft rounded-md border border-line-soft bg-surface">
              <SummaryRow label="Vivienda" value={unit ? `${unitLabel(unit)} · ${project?.name ?? ""}` : "—"} onEdit={() => setStep(0)} />
              <SummaryRow label="Tipo de problema" value={`${category?.name ?? "—"} · ${form.room}`} onEdit={() => setStep(1)} />
              <SummaryRow label="Descripción" value={form.description.trim()} onEdit={() => setStep(2)} />
              <SummaryRow
                label="Fotos o video"
                value={mediaSummary(form.media)}
                onEdit={() => setStep(2)}
              />
            </dl>
            {submitError && <p className="mt-4 text-sm text-danger" role="alert">{submitError}</p>}
          </StepBody>
        )}
      </section>

      <BottomBar>
        {step > 0 && (
          <Button variant="secondary" size="lg" className="w-1/3" disabled={submitting} onClick={handleBack}>
            Atrás
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button size="lg" className="flex-1" onClick={handleContinue} disabled={step === 0 && units?.length === 0}>
            Continuar
          </Button>
        ) : (
          <Button size="lg" className="flex-1" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Enviando…" : "Enviar requerimiento"}
          </Button>
        )}
      </BottomBar>
    </>
  );
}

function StepBody({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h1 className="mb-5 text-xl">{title}</h1>
      {children}
    </>
  );
}

function ChoiceCard({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label
      className={cn(
        "block cursor-pointer rounded-md border bg-surface p-4 transition duration-150 ease-axis-out focus-within:ring-2 focus-within:ring-accent active:scale-[0.99]",
        checked ? "border-accent bg-accent-soft" : "border-line-soft shadow-card hover:border-accent/40",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <dt className="text-xs font-bold text-ink-secondary">{label}</dt>
        <dd className="mt-0.5 break-words text-sm text-ink">{value}</dd>
      </div>
      <button type="button" className="shrink-0 text-sm font-bold text-accent hover:underline" onClick={onEdit}>
        Editar
      </button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-2 text-sm text-danger" role="alert">{message}</p> : null;
}

function Loading() {
  return (
    <div role="status" aria-label="Cargando…" className="flex flex-col gap-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
