"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { buildDrafts, draftErrors, type DraftSources, type ImportDraft } from "@/components/tickets/import-draft";
import { ImportDraftCard } from "@/components/tickets/import-draft-card";
import { Button, buttonClassName } from "@/components/ui/button";
import { UploadIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDataApi, type ImportResult } from "@/data/api";
import { saveDocumentFile } from "@/data/document-store";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { cn } from "@/lib/cn";
import { extractPdf, previewFirstPage, type ExtractProgress } from "@/lib/document-import/extract";
import { detectDocumentType, parseDocument } from "@/lib/document-import/parsers";
import { DOCUMENT_LABEL, type ParsedDocument } from "@/lib/document-import/types";
import type { DocumentKind } from "@/types/domain";

const MAX_BYTES = 15 * 1024 * 1024;
const KINDS = Object.keys(DOCUMENT_LABEL) as DocumentKind[];

type Step =
  | { name: "upload" }
  | { name: "reading"; fileName: string; progress: ExtractProgress }
  | { name: "review" }
  | { name: "done"; results: ImportResult[] };

interface LoadedDocument {
  file: File;
  text: string;
  fromOcr: boolean;
  ocrConfidence: number | null;
  preview: string | null;
  kind: DocumentKind;
  parsed: ParsedDocument;
}

/** Carga de un PDF (correo, OI, OT, OI firmada o informe AXIS) como requerimiento(s). Solo encargados. */
export function DocumentImport() {
  const { user } = useSession();
  const api = useDataApi();
  const zoneIds = user?.zoneIds;
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: projects } = useQuery(api.getProjects);
  const { data: units } = useQuery(api.getUnits);
  const { data: users } = useQuery(api.getUsers);
  const { data: categories } = useQuery(api.getCategories);
  const { data: tickets } = useQuery(
    useCallback(async () => (zoneIds ? api.getTicketsByZones(zoneIds) : []), [api, zoneIds]),
  );

  const [step, setStep] = useState<Step>({ name: "upload" });
  const [loaded, setLoaded] = useState<LoadedDocument | null>(null);
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const zoneProjects = useMemo(
    () => (projects ?? []).filter((project) => zoneIds?.includes(project.zoneId)),
    [projects, zoneIds],
  );
  const sources: DraftSources | null = useMemo(() => {
    if (!units || !users || !categories || !tickets) return null;
    return { projects: zoneProjects, units, users, categories, tickets };
  }, [zoneProjects, units, users, categories, tickets]);

  const included = drafts.filter((draft) => draft.include);
  const errorsByKey = new Map(drafts.map((draft) => [draft.key, draftErrors(draft)]));
  const hasErrors = included.some((draft) => Object.keys(errorsByKey.get(draft.key) ?? {}).length > 0);

  async function handleFile(file: File | undefined) {
    if (!file || !sources) return;
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("El archivo debe ser un PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("El PDF supera los 15 MB.");
      return;
    }

    setStep({ name: "reading", fileName: file.name, progress: { stage: "reading", progress: null, message: "Leyendo el PDF…" } });
    try {
      const extracted = await extractPdf(file, (progress) => setStep({ name: "reading", fileName: file.name, progress }));
      const detected = detectDocumentType(extracted.text, { fromOcr: extracted.fromOcr });
      const kind: DocumentKind = detected === "UNKNOWN" ? "EMAIL" : detected;
      const parsed = parseDocument(kind, extracted.text);
      const preview = await previewFirstPage(file).catch(() => null);
      setLoaded({
        file,
        text: extracted.text,
        fromOcr: extracted.fromOcr,
        ocrConfidence: extracted.ocrConfidence,
        preview,
        kind,
        parsed: detected === "UNKNOWN"
          ? { ...parsed, warnings: ["No reconocimos el tipo de documento: elige el tipo correcto y completa los datos.", ...parsed.warnings] }
          : parsed,
      });
      setDrafts(buildDrafts(parsed, sources));
      setShowErrors(false);
      setStep({ name: "review" });
    } catch {
      setError("No pudimos leer el PDF. Verifica que no esté protegido con contraseña.");
      setStep({ name: "upload" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function changeKind(kind: DocumentKind) {
    if (!loaded || !sources) return;
    const parsed = parseDocument(kind, loaded.text);
    setLoaded({ ...loaded, kind, parsed });
    setDrafts(buildDrafts(parsed, sources));
  }

  async function handleConfirm() {
    if (!loaded || !user) return;
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const documentId = crypto.randomUUID();
      await saveDocumentFile(documentId, loaded.file);
      const results = await api.importDocument({
        kind: loaded.kind,
        documentId,
        fileName: loaded.file.name,
        size: loaded.file.size,
        userId: user.id,
        requirements: included.map((draft) => ({
          row: {
            kind: loaded.kind,
            documentFolio: loaded.parsed.folio,
            externalRefs: draft.parsed.externalRefs,
            requestDate: draft.parsed.requestDate,
            issuedDate: loaded.parsed.issuedDate,
            visit: draft.parsed.visit,
            execution: draft.parsed.execution,
            repairDate: draft.parsed.repairDate,
            responsible: draft.parsed.responsible,
          },
          projectId: draft.projectId,
          unitId: draft.unitMode === "existing" ? draft.unitId : null,
          newUnit: draft.unitMode === "new"
            ? {
                type: draft.newUnit.type,
                tower: draft.newUnit.type === "DEPARTAMENTO" && draft.newUnit.tower.trim() ? draft.newUnit.tower.trim().toUpperCase() : null,
                floor: null,
                number: draft.newUnit.number.trim().toUpperCase(),
                deliveryDate: draft.parsed.requestDate ?? new Date().toISOString().slice(0, 10),
              }
            : null,
          ownerId: draft.ownerMode === "existing" ? draft.ownerId || null : null,
          newOwner: draft.unitMode === "new" && draft.ownerMode === "new"
            ? { name: draft.newOwner.name.trim(), email: draft.newOwner.email.trim().toLowerCase(), phone: draft.newOwner.phone.trim() }
            : null,
          categoryId: draft.categoryId,
          room: draft.room.trim(),
          description: draft.description.trim(),
        })),
      });
      setStep({ name: "done", results });
    } catch {
      setError("No pudimos registrar los requerimientos. Revisa los datos e intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setLoaded(null);
    setDrafts([]);
    setError(null);
    setStep({ name: "upload" });
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Cargar documento"
        subtitle="Registra requerimientos desde un correo, una OI, una OT o un informe de trabajo en PDF."
      />

      {error && (
        <Notice tone="danger" className="mt-5" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}

      {step.name === "upload" && !sources && <ContentSkeleton label="Cargando obras y unidades…" lines={1} />}

      {step.name === "upload" && sources && (
        <div className="mt-6 max-w-3xl">
          <input
            ref={inputRef}
            id="document-file"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <label
            htmlFor="document-file"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void handleFile(event.dataTransfer.files[0]);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-surface px-6 py-12 text-center shadow-card transition-colors",
              dragging ? "border-accent bg-accent-soft" : "border-line hover:border-accent hover:bg-accent-soft/50",
            )}
          >
            <UploadIcon className="h-8 w-8 text-accent" />
            <span className="font-bold text-accent">Elegir PDF o arrastrarlo aquí</span>
            <span className="text-sm text-ink-secondary">Correo impreso, OI, OI firmada, OT o informe de trabajo AXIS · hasta 15 MB</span>
          </label>
          <ul className="mt-5 grid gap-2 text-sm text-ink-secondary sm:grid-cols-2">
            <li><strong className="text-ink">Correo:</strong> crea el requerimiento (uno por fila o punto de la lista).</li>
            <li><strong className="text-ink">OI:</strong> queda en revisión con la visita agendada.</li>
            <li><strong className="text-ink">OT:</strong> queda con el trabajo programado.</li>
            <li><strong className="text-ink">OI firmada o informe AXIS:</strong> cierra el requerimiento con la conformidad firmada.</li>
          </ul>
          <p className="mt-5 text-xs text-ink-meta">
            El documento se procesa en este navegador; no se envía a servidores. Si es un escaneo, la lectura de imagen descarga
            su modelo de idioma español desde internet la primera vez.
          </p>
        </div>
      )}

      {step.name === "reading" && (
        <div className="mt-6 max-w-3xl rounded-lg border border-line-soft bg-surface p-6 shadow-card" role="status" aria-live="polite">
          <p className="font-bold text-ink">{step.fileName}</p>
          <p className="mt-1 text-sm text-ink-secondary">{step.progress.message}</p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-pill bg-accent-soft">
            <div
              className={cn("h-full rounded-pill bg-accent transition-[width] duration-300", step.progress.progress === null && "w-1/3 animate-pulse")}
              style={step.progress.progress === null ? undefined : { width: `${Math.round(step.progress.progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {step.name === "review" && loaded && sources && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--role-header-height,98px)+1rem)] lg:self-start">
            <div className="rounded-lg border border-line-soft bg-surface p-4 shadow-card">
              <p className="break-all text-sm font-bold text-ink">{loaded.file.name}</p>
              {loaded.parsed.folio && <p className="text-xs text-ink-secondary">Folio: {loaded.parsed.folio}</p>}
              {loaded.parsed.subject && <p className="text-xs text-ink-secondary">Asunto: {loaded.parsed.subject}</p>}
              {loaded.fromOcr && (
                <p className="mt-1 text-xs text-ink-meta">
                  Leído desde imagen (OCR){loaded.ocrConfidence !== null ? ` · confianza ${Math.round(loaded.ocrConfidence)}%` : ""}
                </p>
              )}
              <div className="mt-3">
                <Select label="Tipo de documento" name="document-kind" value={loaded.kind} onChange={(event) => changeKind(event.target.value as DocumentKind)}>
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>{DOCUMENT_LABEL[kind]}</option>
                  ))}
                </Select>
              </div>
            </div>
            <details className="rounded-lg border border-line-soft bg-surface p-4 text-sm shadow-card">
              <summary className="cursor-pointer font-bold text-accent">Ver texto leído</summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-xs text-ink-secondary">
                {loaded.text.trim() || "No se pudo leer texto del documento."}
              </pre>
            </details>
            {loaded.preview && (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa generada en el navegador
              <img src={loaded.preview} alt="Primera página del documento" className="hidden w-full rounded-lg border border-line-soft shadow-card lg:block" />
            )}
          </aside>

          <div className="flex min-w-0 flex-col gap-4">
            {loaded.parsed.warnings.map((warning) => (
              <Notice key={warning} tone="warning">{warning}</Notice>
            ))}
            {drafts.map((draft, index) => (
              <ImportDraftCard
                key={draft.key}
                index={index}
                draft={draft}
                kind={loaded.kind}
                projects={zoneProjects}
                sources={sources}
                errors={showErrors && draft.include ? (errorsByKey.get(draft.key) ?? {}) : {}}
                onChange={(next) => setDrafts((current) => current.map((item) => (item.key === next.key ? next : item)))}
              />
            ))}
            {showErrors && hasErrors && (
              <Notice tone="danger">Completa los campos marcados antes de registrar.</Notice>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" disabled={saving} onClick={reset}>Cancelar</Button>
              <Button disabled={saving || included.length === 0} onClick={handleConfirm}>
                {saving
                  ? "Registrando…"
                  : `Registrar ${included.length} ${included.length === 1 ? "requerimiento" : "requerimientos"}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step.name === "done" && (
        <div className="mt-6 max-w-3xl">
          <Notice tone="success">
            {step.results.length} {step.results.length === 1 ? "requerimiento registrado" : "requerimientos registrados"} desde el documento.
          </Notice>
          <ul className="mt-4 flex flex-col gap-2">
            {step.results.map(({ ticket, mode }) => (
              <li key={ticket.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft bg-surface px-4 py-3 shadow-card">
                <Link href={`/encargado/tickets/${ticket.id}`} className="font-bold text-accent hover:underline">{ticket.folio}</Link>
                <StatusBadge status={ticket.status} />
                <span className="text-sm text-ink-secondary">
                  {mode === "create" ? "Creado" : mode === "advance" ? "Avanzado" : "Documento adjuntado"} · {ticket.room}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-3">
            <Button onClick={reset}>Cargar otro documento</Button>
            <Link href="/encargado" className={buttonClassName({ variant: "secondary" })}>Ir a la bandeja</Link>
          </div>
        </div>
      )}
    </div>
  );
}
