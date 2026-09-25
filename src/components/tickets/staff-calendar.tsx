"use client";

import type { EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { buttonClassName } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { AGENDA_DURATION, agendaRange, buildAgenda, googleCalendarUrl, splitLocal, type AgendaItem } from "@/lib/calendar";
import { formatDateAndTime, todayIso, unitLabel } from "@/lib/format";
import type { Project, Unit, User, WorkCrew } from "@/types/domain";
import "./staff-calendar.css";

const KIND_LABEL = { VISITA: "Visita", TRABAJO: "Trabajo" } as const;

function subscribeToViewport(onChange: () => void): () => void {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Agenda del encargado: visitas inspectivas y trabajos programados de sus zonas. */
export function StaffCalendar() {
  const { user } = useSession();
  const api = useDataApi();
  const zoneIds = user?.zoneIds;
  const isMobile = useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );

  const { data: tickets } = useQuery(
    useCallback(async () => (zoneIds ? api.getTicketsByZones(zoneIds) : []), [api, zoneIds]),
  );
  const { data: units } = useQuery(api.getUnits);
  const { data: projects } = useQuery(api.getProjects);
  const { data: users } = useQuery(api.getUsers);
  const { data: crews } = useQuery(api.getCrews);

  const [projectFilter, setProjectFilter] = useState("");
  const [selected, setSelected] = useState<AgendaItem | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const zoneProjects = useMemo(
    () => (projects ?? []).filter((project) => zoneIds?.includes(project.zoneId)),
    [projects, zoneIds],
  );

  const items = useMemo(() => {
    if (!tickets || !units) return undefined;
    const today = todayIso();
    return buildAgenda(tickets, today).filter((item) => {
      if (!projectFilter) return true;
      return units.find((unit) => unit.id === item.ticket.unitId)?.projectId === projectFilter;
    });
  }, [tickets, units, projectFilter]);

  const events = useMemo<EventInput[]>(() => {
    if (!items || !units) return [];
    return items.map((item) => {
      const unit = units.find((candidate) => candidate.id === item.ticket.unitId);
      const range = agendaRange(item);
      return {
        id: item.id,
        title: `${KIND_LABEL[item.kind]} · ${item.ticket.folio}${unit ? ` · ${unitLabel(unit)}` : ""}`,
        start: range.start,
        end: range.end,
        allDay: item.time === null,
        editable: item.editable,
        classNames: [item.done ? "pv-event--done" : item.kind === "VISITA" ? "pv-event--visit" : "pv-event--work"],
        extendedProps: { item },
      };
    });
  }, [items, units]);

  function handleEventClick(info: EventClickArg) {
    info.jsEvent.preventDefault();
    setSelected(info.event.extendedProps.item as AgendaItem);
  }

  async function handleEventDrop(info: EventDropArg) {
    const item = info.event.extendedProps.item as AgendaItem;
    const start = info.event.start;
    if (!user || !start) {
      info.revert();
      return;
    }

    const next = splitLocal(start);
    const time = info.event.allDay ? null : next.time;
    if (next.date < todayIso()) {
      info.revert();
      setNotice({ tone: "danger", text: "No se puede reagendar para una fecha pasada." });
      return;
    }

    const when = formatDateAndTime(next.date, time);
    try {
      if (item.kind === "VISITA") {
        await api.scheduleVisit(item.ticket.id, user.id, next.date, time, `Visita reagendada para el ${when} (desde el calendario)`);
      } else {
        await api.transitionTicket(
          item.ticket.id,
          "PROGRAMADO",
          user.id,
          `Trabajo reprogramado para el ${when} (desde el calendario)`,
          { scheduledDate: next.date, scheduledTime: time },
        );
      }
      setNotice({ tone: "success", text: `${item.ticket.folio}: ${KIND_LABEL[item.kind].toLowerCase()} reagendada para el ${when}.` });
    } catch {
      info.revert();
      setNotice({ tone: "danger", text: "No pudimos reagendar. Intenta nuevamente." });
    }
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Calendario"
        subtitle="Visitas inspectivas y trabajos programados de tus zonas. Arrastra un evento pendiente para reagendarlo."
        actions={
          <div className="w-full sm:w-64">
            <Select label="Obra" name="calendar-project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="">Todas las obras</option>
              {zoneProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </Select>
          </div>
        }
      />

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-secondary" aria-label="Leyenda">
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-5 rounded-[3px] bg-accent-soft ring-1 ring-inset ring-accent/40" />
          Visita agendada
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-5 rounded-[3px] bg-accent" />
          Trabajo programado
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-5 rounded-[3px] bg-surface-secondary ring-1 ring-inset ring-line" />
          Realizado
        </li>
      </ul>

      {notice && (
        <Notice tone={notice.tone} className="mt-4" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {items === undefined ? (
        <div role="status" aria-label="Cargando calendario…" className="mt-5 rounded-lg border border-line-soft bg-surface p-4 shadow-card">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="mt-4 h-[28rem] w-full" />
        </div>
      ) : (
        <div className="pv-calendar mt-5 rounded-lg border border-line-soft bg-surface p-3 shadow-card sm:p-5">
          {items.length === 0 && (
            <p className="mb-3 text-sm text-ink-secondary">
              No hay visitas ni trabajos agendados{projectFilter ? " en esta obra" : " en tus zonas"}. Agéndalos desde el detalle de cada requerimiento.
            </p>
          )}
          <FullCalendar
            key={isMobile ? "mobile" : "desktop"}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            locale={esLocale}
            initialView={isMobile ? "listWeek" : "timeGridWeek"}
            headerToolbar={
              isMobile
                ? { left: "prev,next", center: "title", right: "listWeek,dayGridMonth" }
                : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }
            }
            titleFormat={isMobile ? { month: "short", day: "numeric" } : undefined}
            height="auto"
            firstDay={1}
            nowIndicator
            slotMinTime="07:00:00"
            slotMaxTime="20:00:00"
            scrollTime="08:00:00"
            businessHours={{ daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: "08:00", endTime: "18:00" }}
            slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            allDayText="Todo el día"
            noEventsText="Sin visitas ni trabajos en este período"
            eventInteractive
            eventDurationEditable={false}
            dayMaxEvents={3}
            events={events}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
          />
        </div>
      )}

      <Dialog
        open={selected !== null}
        title={selected ? `${KIND_LABEL[selected.kind]} · ${selected.ticket.folio}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <EventDetail
            item={selected}
            unit={units?.find((unit) => unit.id === selected.ticket.unitId)}
            projects={projects ?? []}
            users={users ?? []}
            crews={crews ?? []}
          />
        )}
      </Dialog>
    </div>
  );
}

interface EventDetailProps {
  item: AgendaItem;
  unit: Unit | undefined;
  projects: Project[];
  users: User[];
  crews: WorkCrew[];
}

function EventDetail({ item, unit, projects, users, crews }: EventDetailProps) {
  const ticket = item.ticket;
  const project = projects.find((candidate) => candidate.id === unit?.projectId);
  const owner = users.find((candidate) => candidate.id === unit?.ownerId);
  const crew = crews.find((candidate) => candidate.id === ticket.crewId);
  const place = [project?.name, unit ? unitLabel(unit) : null].filter(Boolean).join(" · ");
  const location = project ? `${project.address}, ${project.commune}` : "";
  const googleUrl = googleCalendarUrl({
    title: `${KIND_LABEL[item.kind]} postventa ${ticket.folio} · ${place}`,
    date: item.date,
    time: item.time,
    durationMinutes: AGENDA_DURATION[item.kind],
    details: `${ticket.folio} · ${ticket.room}\n${ticket.description}${owner ? `\nPropietario: ${owner.name} ${owner.phone}` : ""}`,
    location,
  });

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={ticket.status} />
        {item.done && <span className="text-ink-meta">Realizado</span>}
      </div>
      <dl className="grid gap-3">
        <DetailRow label="Cuándo" value={formatDateAndTime(item.date, item.time)} />
        <DetailRow label="Dónde" value={place || "—"} hint={location} />
        <DetailRow label="Falla" value={`${ticket.room} · ${ticket.description}`} />
        <DetailRow
          label="Propietario"
          value={owner?.name ?? "—"}
          hint={
            owner && (
              <a href={`tel:${owner.phone.replace(/\s/g, "")}`} className="text-accent hover:underline">{owner.phone}</a>
            )
          }
        />
        <DetailRow label="Equipo" value={crew ? `${crew.name} · ${crew.contactName}` : "Sin asignar"} />
      </dl>
      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={buttonClassName({ variant: "secondary" })}>
          Agregar a Google Calendar
        </a>
        <Link href={`/encargado/tickets/${ticket.id}`} className={buttonClassName()}>
          Ver requerimiento
        </Link>
      </div>
    </div>
  );
}

function DetailRow({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="text-xs font-bold text-ink-secondary sm:pt-0.5">{label}</dt>
      <dd className="text-ink">
        {value}
        {hint && <span className="block text-xs text-ink-meta">{hint}</span>}
      </dd>
    </div>
  );
}
