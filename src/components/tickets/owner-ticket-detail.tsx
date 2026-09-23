"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { TransitionActions } from "@/components/tickets/transition-actions";
import { BottomBar } from "@/components/ui/bottom-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { formatLongDate, unitLabel } from "@/lib/format";
import { OWNER_STATUS_LABEL, type Transition } from "@/lib/ticket-status";
import type { Ticket } from "@/types/domain";

const DONE_MESSAGE: Partial<Record<Ticket["status"], string>> = {
  CERRADO: "¡Gracias! Registramos tu conformidad y cerramos el requerimiento.",
  PROGRAMADO: "Registramos tu observación. El encargado coordinará un nuevo trabajo contigo.",
};

const COMMENT_COPY = {
  PROGRAMADO: {
    title: "¿Qué quedó pendiente?",
    hint: "Describe qué no quedó bien para que el equipo lo corrija en la próxima visita.",
  },
};

interface OwnerTicketDetailProps {
  ticketId: string;
  justCreated: boolean;
}

export function OwnerTicketDetail({ ticketId, justCreated }: OwnerTicketDetailProps) {
  const { user } = useSession();
  const api = useDataApi();
  const [notice, setNotice] = useState<string | null>(
    justCreated ? "Recibimos tu requerimiento. Te avisaremos cada avance." : null,
  );

  const { data: ticket, loading } = useQuery(useCallback(() => api.getTicket(ticketId), [api, ticketId]));
  const { data: history } = useQuery(useCallback(() => api.getTicketHistory(ticketId), [api, ticketId]));
  const { data: units } = useQuery(api.getUnits);
  const { data: projects } = useQuery(api.getProjects);
  const { data: categories } = useQuery(api.getCategories);
  const { data: crews } = useQuery(api.getCrews);

  const unit = units?.find((item) => item.id === ticket?.unitId);

  if (user === null || (ticket === undefined && loading) || units === undefined) {
    return <p className="text-sm text-ink-secondary" role="status">Cargando requerimiento…</p>;
  }

  // Un propietario solo ve los tickets de sus viviendas.
  if (ticket === undefined || unit?.ownerId !== user.id) {
    return (
      <div className="rounded-lg border border-line-soft bg-surface p-6 text-center">
        <p className="font-bold text-ink">No encontramos este requerimiento</p>
        <Link href="/propietario" className="mt-3 inline-block text-sm font-bold text-accent hover:underline">
          Volver a mis requerimientos
        </Link>
      </div>
    );
  }

  const project = projects?.find((item) => item.id === unit.projectId);
  const category = categories?.find((item) => item.id === ticket.categoryId);
  const crew = crews?.find((item) => item.id === ticket.crewId);
  const meta = [category?.name, ticket.room, unitLabel(unit), `Ingresado el ${formatLongDate(ticket.createdAt)}`]
    .filter(Boolean)
    .join(" · ");

  function handleDone(transition: Transition) {
    setNotice(DONE_MESSAGE[transition.to] ?? "Listo, registramos tu respuesta.");
  }

  return (
    <>
      <header className="-mx-4 -mt-6 flex items-center gap-3 border-b border-line-soft bg-surface px-4 py-4 sm:-mx-6 sm:px-6">
        <Link href="/propietario" aria-label="Volver a mis requerimientos" className="flex h-9 w-9 items-center justify-center rounded-md text-accent hover:bg-accent-soft">
          <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.5 15 7.5 10l5-5" />
          </svg>
        </Link>
        <p className="font-bold text-ink">{ticket.folio}</p>
      </header>

      {notice && (
        <div className="mt-5 flex items-start justify-between gap-3 rounded-md bg-success/10 p-4 text-sm text-success" role="status">
          <p>{notice}</p>
          <button type="button" aria-label="Cerrar aviso" className="shrink-0 font-bold" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}

      <section className="pt-6">
        <StatusBadge status={ticket.status} label={OWNER_STATUS_LABEL[ticket.status]} />
        <h1 className="mt-3 text-xl">{ticket.description}</h1>
        <p className="mt-2 text-sm text-ink-secondary">{meta}</p>
        {project && <p className="text-sm text-ink-secondary">{project.name}</p>}

        <ScheduleInfo ticket={ticket} crewName={crew?.name} />

        {ticket.photos.length > 0 && (
          <div className="mt-5 flex gap-3 overflow-x-auto">
            {ticket.photos.map((photo, index) => (
              // eslint-disable-next-line @next/next/no-img-element -- fotos mock (object URLs), next/image no aplica
              <img key={photo.id} src={photo.url} alt={`Foto ${index + 1} del requerimiento`} className="h-24 w-24 shrink-0 rounded-md object-cover" />
            ))}
          </div>
        )}

        <hr className="my-6 border-line-soft" />

        <h2 className="sr-only">Avance</h2>
        <StatusTimeline status={ticket.status} history={history ?? []} labels={OWNER_STATUS_LABEL} />
      </section>

      {ticket.status === "EN_RECEPCION" ? (
        <BottomBar>
          <TransitionActions
            ticket={ticket}
            role="PROPIETARIO"
            userId={user.id}
            onDone={handleDone}
            commentCopy={COMMENT_COPY}
          />
        </BottomBar>
      ) : (
        <div className="pb-8" />
      )}
    </>
  );
}

/** Fecha (YYYY-MM-DD) de hoy o futura: una fecha pasada ya no sirve de aviso (ej. tras "No estoy conforme"). */
function isUpcoming(date: string): boolean {
  return date.slice(0, 10) >= new Date().toLocaleDateString("sv-SE");
}

function ScheduleInfo({ ticket, crewName }: { ticket: Ticket; crewName?: string }) {
  const lines: string[] = [];
  if ((ticket.status === "ASIGNADO" || ticket.status === "VISITA_INSPECTIVA") && ticket.visitDate && isUpcoming(ticket.visitDate)) {
    lines.push(`Visita inspectiva: ${formatLongDate(ticket.visitDate)}`);
  }
  if ((ticket.status === "PROGRAMADO" || ticket.status === "EN_EJECUCION") && ticket.scheduledDate && isUpcoming(ticket.scheduledDate)) {
    lines.push(`Trabajo programado para el ${formatLongDate(ticket.scheduledDate)}`);
  }
  if (crewName && ticket.status !== "CERRADO") lines.push(`Equipo: ${crewName}`);

  if (lines.length === 0) return null;

  return (
    <div className="mt-5 rounded-md bg-accent-soft p-4 text-sm text-ink">
      {lines.map((line) => <p key={line}>{line}</p>)}
    </div>
  );
}
