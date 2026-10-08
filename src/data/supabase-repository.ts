import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Role, Ticket, TicketMedia, TicketStatus, User } from "@/types/domain";

/** La fuente remota se pide con NEXT_PUBLIC_USE_SUPABASE=true. */
export function isSupabaseRequested(): boolean {
  return process.env.NEXT_PUBLIC_USE_SUPABASE === "true";
}

/** Hay fuente remota solo si se pidió y las claves públicas están definidas. */
export function isSupabaseDataSourceEnabled(): boolean {
  return isSupabaseRequested() && isSupabaseConfigured() && supabase !== null;
}

/** Se pidió Supabase pero falta configuración: la app cae a datos simulados y lo avisa. */
export function isSupabaseFallback(): boolean {
  return isSupabaseRequested() && !isSupabaseDataSourceEnabled();
}

const time = (value: string | null) => (value ? value.slice(0, 5) : null);

type Row = Record<string, unknown>;
const str = (v: unknown) => v as string;
const strOrNull = (v: unknown) => (v ?? null) as string | null;

/** Devuelve null ante cualquier error para que el llamador use el store en memoria. */
export async function loadUsersFromSupabase(): Promise<User[] | null> {
  if (!supabase) return null;
  const [users, zones, projects] = await Promise.all([
    supabase.from("users").select("*"),
    supabase.from("user_zones").select("user_id, zone_id"),
    supabase.from("user_projects").select("user_id, project_id"),
  ]);
  if (users.error || zones.error || projects.error || !users.data) return null;

  return (users.data as Row[]).map((row) => ({
    id: str(row.id),
    name: str(row.name),
    email: str(row.email),
    phone: str(row.phone),
    role: row.role as Role,
    zoneIds: (zones.data as Row[]).filter((z) => z.user_id === row.id).map((z) => str(z.zone_id)),
    projectIds: (projects.data as Row[]).filter((p) => p.user_id === row.id).map((p) => str(p.project_id)),
    active: row.active as boolean,
  }));
}

export async function loadTicketsFromSupabase(): Promise<Ticket[] | null> {
  if (!supabase) return null;
  const [tickets, refs, media, docs, special] = await Promise.all([
    supabase.from("tickets").select("*").order("created_at", { ascending: false }),
    supabase.from("ticket_external_refs").select("ticket_id, ref"),
    supabase.from("ticket_media").select("*"),
    supabase.from("ticket_documents").select("*"),
    supabase.from("ticket_special_cases").select("*"),
  ]);
  if (tickets.error || refs.error || media.error || docs.error || special.error || !tickets.data) return null;

  return (tickets.data as Row[]).map((row) => {
    const id = str(row.id);
    const sc = (special.data as Row[]).find((s) => s.ticket_id === id);
    return {
      id,
      folio: str(row.folio),
      unitId: str(row.unit_id),
      categoryId: str(row.category_id),
      reportedCategoryId: str(row.reported_category_id),
      room: str(row.room),
      description: str(row.description),
      status: row.status as TicketStatus,
      media: (media.data as Row[]).filter((m) => m.ticket_id === id).map((m): TicketMedia => ({
        id: str(m.id),
        url: str(m.url),
        type: m.type as TicketMedia["type"],
        durationSeconds: (m.duration_seconds ?? null) as number | null,
        stage: m.stage as TicketMedia["stage"],
        uploadedById: str(m.uploaded_by_id),
        createdAt: str(m.created_at),
      })),
      createdById: str(row.created_by_id),
      encargadoId: strOrNull(row.encargado_id),
      crewId: strOrNull(row.crew_id),
      visitDate: strOrNull(row.visit_date),
      visitTime: time(strOrNull(row.visit_time)),
      scheduledDate: strOrNull(row.scheduled_date),
      scheduledTime: time(strOrNull(row.scheduled_time)),
      rejectionReason: strOrNull(row.rejection_reason),
      externalRefs: (refs.data as Row[]).filter((r) => r.ticket_id === id).map((r) => str(r.ref)),
      documents: (docs.data as Row[]).filter((d) => d.ticket_id === id).map((d) => ({
        id: str(d.id),
        kind: d.kind as Ticket["documents"][number]["kind"],
        fileName: str(d.file_name),
        size: Number(d.size),
        uploadedById: str(d.uploaded_by_id),
        uploadedAt: str(d.uploaded_at),
      })),
      specialCase: sc ? { reason: str(sc.reason), markedById: str(sc.marked_by_id), markedAt: str(sc.marked_at) } : null,
      createdAt: str(row.created_at),
      updatedAt: str(row.updated_at),
    };
  });
}

/**
 * Guarda el ticket y sus referencias. Es un best-effort: las escrituras definitivas irán por el
 * servidor con service role (docs/backend-supabase.md); aquí un error no rompe el flujo local.
 */
export async function saveTicketToSupabase(ticket: Ticket): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("tickets").upsert({
    id: ticket.id,
    folio: ticket.folio,
    unit_id: ticket.unitId,
    category_id: ticket.categoryId,
    reported_category_id: ticket.reportedCategoryId,
    room: ticket.room,
    description: ticket.description,
    status: ticket.status,
    created_by_id: ticket.createdById,
    encargado_id: ticket.encargadoId,
    crew_id: ticket.crewId,
    visit_date: ticket.visitDate,
    visit_time: ticket.visitTime,
    scheduled_date: ticket.scheduledDate,
    scheduled_time: ticket.scheduledTime,
    rejection_reason: ticket.rejectionReason,
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
  });
  if (error) return false;

  if (ticket.externalRefs.length > 0) {
    await supabase.from("ticket_external_refs").upsert(ticket.externalRefs.map((ref) => ({ ticket_id: ticket.id, ref })));
  }
  if (ticket.media.length > 0) {
    await supabase.from("ticket_media").upsert(ticket.media.map((m) => ({
      id: m.id,
      ticket_id: ticket.id,
      url: m.url,
      type: m.type,
      duration_seconds: m.durationSeconds,
      stage: m.stage,
      uploaded_by_id: m.uploadedById,
      created_at: m.createdAt,
    })));
  }
  return true;
}

export async function saveUserToSupabase(user: User): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("users").upsert({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    active: user.active,
  });
  if (error) return false;

  await supabase.from("user_zones").delete().eq("user_id", user.id);
  if (user.zoneIds.length > 0) {
    await supabase.from("user_zones").insert(user.zoneIds.map((zone_id) => ({ user_id: user.id, zone_id })));
  }
  await supabase.from("user_projects").delete().eq("user_id", user.id);
  if (user.projectIds.length > 0) {
    await supabase.from("user_projects").insert(user.projectIds.map((project_id) => ({ user_id: user.id, project_id })));
  }
  return true;
}
