"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { StaffActions } from "@/components/tickets/staff-actions";
import { TicketHistory } from "@/components/tickets/ticket-history";
import { AlertIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDataApi } from "@/data/api";
import { loadDocumentFile } from "@/data/document-store";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { daysOpen, formatDateAndTime, formatLongDate, unitLabel } from "@/lib/format";
import { mapsUrl } from "@/lib/geo";
import { DOCUMENT_LABEL } from "@/lib/document-import/types";
import { STATUS_LABEL, type Transition } from "@/lib/ticket-status";
import type { Ticket, TicketDocument, TicketPhoto, TicketStatusHistory } from "@/types/domain";

const DONE_MESSAGE: Partial<Record<Ticket["status"], string>> = {
  EN_REVISION: "Revisión iniciada.",
  ASIGNADO: "Equipo asignado. El propietario ya lo ve en su teléfono.",
  VISITA_INSPECTIVA: "Visita registrada con tu diagnóstico.",
  PROGRAMADO: "Trabajo programado. El propietario verá la fecha.",
  EN_EJECUCION: "Trabajo en ejecución.",
  EN_RECEPCION: "Le pedimos al propietario que confirme su conformidad.",
  NO_PROCEDE: "Marcado como no procede. El propietario verá el motivo.",
};

/** Si el propietario rechazó la recepción, su comentario más reciente. */
function ownerRejection(history: TicketStatusHistory[]): TicketStatusHistory | undefined {
  const last = history.at(-1);
  return last?.from === "EN_RECEPCION" && last.to === "PROGRAMADO" ? last : undefined;
}

interface StaffTicketDetailProps {
  ticketId: string;
  /** Vuelta a la bandeja del rol, ej. "/encargado". */
  backHref: string;
}

export function StaffTicketDetail({ ticketId, backHref }: StaffTicketDetailProps) {
  const { user } = useSession();
  const api = useDataApi();
  const [notice, setNotice] = useState<string | null>(null);

  const { data: ticket, loading } = useQuery(useCallback(() => api.getTicket(ticketId), [api, ticketId]));
  const { data: history } = useQuery(useCallback(() => api.getTicketHistory(ticketId), [api, ticketId]));
  const { data: units } = useQuery(api.getUnits);
  const { data: projects } = useQuery(api.getProjects);
  const { data: categories } = useQuery(api.getCategories);
  const { data: crews } = useQuery(api.getCrews);
  const { data: users } = useQuery(api.getUsers);
  const { data: zones } = useQuery(api.getZones);

  const unit = units?.find((item) => item.id === ticket?.unitId);
  const project = projects?.find((item) => item.id === unit?.projectId);

  if (user === null || (ticket === undefined && loading) || units === undefined || projects === undefined) {
    return <ContentSkeleton label="Cargando requerimiento…" />;
  }

  // El encargado solo accede a tickets de obras en sus zonas; el admin, a todos.
  const allowed = user.role === "ADMIN" || (project !== undefined && user.zoneIds.includes(project.zoneId));
  if (ticket === undefined || unit === undefined || project === undefined || !allowed) {
    return (
      <div className="mx-auto mt-6 w-full max-w-lg rounded-lg border border-line-soft bg-surface p-6 text-center shadow-card">
        <p className="font-bold text-ink">No encontramos este requerimiento en tus zonas</p>
        <Link href={backHref} className="mt-3 inline-block text-sm font-bold text-accent hover:underline">
          Volver a la bandeja
        </Link>
      </div>
    );
  }

  const owner = users?.find((item) => item.id === unit.ownerId);
  const category = categories?.find((item) => item.id === ticket.categoryId);
  const crew = crews?.find((item) => item.id === ticket.crewId);
  const zone = zones?.find((item) => item.id === project.zoneId);
  const rejection = history ? ownerRejection(history) : undefined;
  const ownerPhotos = ticket.photos.filter((photo) => photo.uploadedById === unit.ownerId);
  const fieldPhotos = ticket.photos.filter((photo) => photo.uploadedById !== unit.ownerId);
  const days = daysOpen(ticket);

  function handleDone(transition: Transition) {
    setNotice(DONE_MESSAGE[transition.to] ?? "Cambio guardado.");
  }

  function handleSpecialCase() {
    setNotice("Registrado como caso especial. El flujo continúa normalmente.");
  }

  return (
    <div className="pb-8">
      <PageHeader
        back={{ href: backHref, label: "Bandeja" }}
        title={ticket.folio}
        aside={
          <>
            <StatusBadge status={ticket.status} />
            {ticket.specialCase && (
              <span className="inline-flex items-center rounded-sm bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                Caso especial
              </span>
            )}
            <span className="text-sm text-ink-meta">
              {days} {days === 1 ? "día" : "días"} {ticket.status === "CERRADO" || ticket.status === "NO_PROCEDE" ? "en total" : "abierto"}
            </span>
          </>
        }
      />

      {notice && (
        <Notice tone="success" className="mt-5" onDismiss={() => setNotice(null)}>{notice}</Notice>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Columna lateral primero en móvil: lo que hay que hacer y a quién llamar. */}
        <aside className="flex flex-col gap-4 lg:order-2">
          <Panel title="Próximo paso">
            {rejection && (
              <div className="mb-4 rounded-md bg-brand-orange-soft p-3 text-sm">
                <p className="flex items-center gap-2 font-bold text-brand-orange-ink"><AlertIcon className="h-4 w-4" />El propietario no quedó conforme</p>
                {rejection.comment && <p className="mt-1 text-ink-secondary">{rejection.comment}</p>}
              </div>
            )}
            <NextStepInfo ticket={ticket} />
            <div className="mt-4">
              <StaffActions
                ticket={ticket}
                role={user.role}
                userId={user.id}
                zoneId={project.zoneId}
                projectId={project.id}
                onDone={handleDone}
                onSpecialCase={handleSpecialCase}
                onVisitScheduled={setNotice}
              />
            </div>
          </Panel>

          <Panel title="Propietario">
            {owner ? (
              <dl className="flex flex-col gap-1 text-sm">
                <dt className="sr-only">Nombre</dt>
                <dd className="font-bold text-ink">{owner.name}</dd>
                <dt className="sr-only">Teléfono</dt>
                <dd><a href={`tel:${owner.phone.replace(/\s/g, "")}`} className="text-accent hover:underline">{owner.phone}</a></dd>
                <dt className="sr-only">Correo</dt>
                <dd><a href={`mailto:${owner.email}`} className="break-all text-accent hover:underline">{owner.email}</a></dd>
              </dl>
            ) : (
              <p className="text-sm text-ink-secondary">Sin datos del propietario.</p>
            )}
          </Panel>

          <Panel title="Vivienda">
            <p className="text-sm font-bold text-ink">{unitLabel(unit)} · {project.name}</p>
            <p className="text-sm text-ink-secondary">{project.address}, {project.commune}</p>
            {zone && <p className="text-sm text-ink-secondary">{zone.name}</p>}
            <p className="mt-1 text-xs text-ink-meta">Entregada el {formatLongDate(unit.deliveryDate)}</p>
            <a href={mapsUrl(project.location)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-bold text-accent hover:underline">
              Ver obra en el mapa
            </a>
          </Panel>

          <Panel title="Equipo y fechas">
            <InfoRow label="Equipo" value={crew ? `${crew.name} · ${crew.contactName} · ${crew.phone}` : "Sin asignar"} />
            <InfoRow label="Visita inspectiva" value={ticket.visitDate ? formatDateAndTime(ticket.visitDate, ticket.visitTime) : "—"} />
            <InfoRow label="Trabajo programado" value={ticket.scheduledDate ? formatDateAndTime(ticket.scheduledDate, ticket.scheduledTime) : "—"} />
          </Panel>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 lg:order-1">
          <Panel title="Requerimiento">
            <p className="text-sm text-ink-secondary">
              {[category?.name, ticket.room, `Ingresado el ${formatLongDate(ticket.createdAt)}`].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-2 whitespace-pre-line text-ink">{ticket.description}</p>
            {ticket.reportedCategoryId !== ticket.categoryId && (
              <p className="mt-3 text-sm text-ink-secondary">
                Origen reportado por el propietario:{" "}
                {categories?.find((item) => item.id === ticket.reportedCategoryId)?.name ?? "—"}
              </p>
            )}
            {ticket.specialCase && (
              <div className="mt-4 rounded-md bg-accent-soft p-3 text-sm">
                <p className="font-bold text-accent">Caso especial</p>
                <p className="mt-1 text-ink-secondary">{ticket.specialCase.reason}</p>
              </div>
            )}
            {ticket.status === "NO_PROCEDE" && ticket.rejectionReason && (
              <div className="mt-4 rounded-md bg-danger/5 p-3 text-sm">
                <p className="font-bold text-danger">Motivo de no procede</p>
                <p className="mt-1 text-ink-secondary">{ticket.rejectionReason}</p>
              </div>
            )}
            <PhotoStrip title="Fotos del propietario" photos={ownerPhotos} />
            <PhotoStrip title="Fotos de terreno" photos={fieldPhotos} />
          </Panel>

          {ticket.documents.length > 0 && (
            <Panel title="Documentos">
              <DocumentList documents={ticket.documents} />
            </Panel>
          )}

          <Panel title="Historial">
            {history === undefined || users === undefined ? (
              <ContentSkeleton label="Cargando historial…" lines={2} />
            ) : (
              <TicketHistory history={history} users={users} />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** PDFs cargados para el ticket; el archivo se abre desde IndexedDB de este navegador. */
function DocumentList({ documents }: { documents: TicketDocument[] }) {
  const [missing, setMissing] = useState<string | null>(null);

  async function open(document: TicketDocument) {
    setMissing(null);
    const file = await loadDocumentFile(document.id);
    if (!file) {
      setMissing(document.id);
      return;
    }
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {documents.map((document) => (
        <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="break-all text-sm font-bold text-ink">{document.fileName}</p>
            <p className="text-xs text-ink-meta">
              {DOCUMENT_LABEL[document.kind]} · {formatLongDate(document.uploadedAt)} · {Math.max(1, Math.round(document.size / 1024))} KB
            </p>
            {missing === document.id && (
              <p className="text-xs text-warning">El archivo no está disponible en este navegador (se cargó desde otro equipo).</p>
            )}
          </div>
          <button type="button" className="text-sm font-bold text-accent hover:underline" onClick={() => open(document)}>
            Abrir
          </button>
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line-soft bg-surface p-5 shadow-card">
      <h2 className="mb-3 text-base">{title}</h2>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col py-1.5 text-sm">
      <span className="text-xs font-bold text-ink-secondary">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function PhotoStrip({ title, photos }: { title: string; photos: TicketPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-bold text-ink-secondary">{title}</p>
      <div className="flex gap-3 overflow-x-auto">
        {photos.map((photo, index) => (
          <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- fotos mock (object URLs), next/image no aplica */}
            <img src={photo.url} alt={`${title}, ${index + 1}`} className="h-24 w-24 rounded-md object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}

const NEXT_STEP: Partial<Record<Ticket["status"], string>> = {
  INGRESADO: "Revisa si el requerimiento procede.",
  EN_REVISION: "Asigna una cuadrilla o subcontrato de la zona, o márcalo como no procede.",
  ASIGNADO: "Agenda la visita con el propietario y, tras visitar la vivienda, registra el diagnóstico el mismo día.",
  VISITA_INSPECTIVA: "Agenda el trabajo con el propietario, o márcalo como no procede.",
  PROGRAMADO: "Cuando el equipo llegue a la vivienda, inicia el trabajo. Si cambia la fecha, reprograma.",
  EN_EJECUCION: "Al terminar, registra el trabajo realizado y pide la recepción.",
  EN_RECEPCION: "Esperando que el propietario confirme su conformidad.",
  CERRADO: "Requerimiento cerrado con la conformidad del propietario.",
  NO_PROCEDE: "Requerimiento cerrado como no procede.",
};

function NextStepInfo({ ticket }: { ticket: Ticket }) {
  return (
    <p className="text-sm text-ink-secondary">
      <span className="sr-only">Estado actual: {STATUS_LABEL[ticket.status]}. </span>
      {NEXT_STEP[ticket.status]}
    </p>
  );
}
