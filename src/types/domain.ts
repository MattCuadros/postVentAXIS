/**
 * Tipos del dominio de Postventa.
 * Espejo 1:1 del futuro schema.prisma: el frontend se construye contra estos
 * tipos y, al llegar el backend, solo cambia la fuente de datos.
 */

/**
 * ADMIN_OBRA: administrador de obra, solo lectura de indicadores de fallas de sus obras (incluidas
 * las ya entregadas). No participa en la máquina de estados de los tickets.
 */
export type Role = "ADMIN" | "ENCARGADO" | "PROPIETARIO" | "ADMIN_OBRA";

export type TicketStatus =
  | "INGRESADO"
  | "EN_REVISION"
  | "ASIGNADO"
  | "VISITA_INSPECTIVA"
  | "PROGRAMADO"
  | "EN_EJECUCION"
  | "EN_RECEPCION"
  | "CERRADO"
  | "NO_PROCEDE";

export type UnitType = "DEPARTAMENTO" | "CASA";
export type WorkCrewType = "INTERNO" | "SUBCONTRATO";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Zone {
  id: string;
  name: string;
  code: "N" | "C" | "S" | "A";
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  /** Solo ENCARGADO: zonas bajo su responsabilidad. */
  zoneIds: string[];
  /** Solo ADMIN_OBRA: obras que administra (en construcción o ya entregadas). */
  projectIds: string[];
  active: boolean;
}

export interface Project {
  id: string;
  name: string;
  /** Sigla única de 2 a 4 letras usada en el folio. */
  code: string;
  zoneId: string;
  address: string;
  commune: string;
  location: GeoPoint;
}

export interface Unit {
  id: string;
  projectId: string;
  type: UnitType;
  /** Torre o bloque; null en casas. */
  tower: string | null;
  floor: number | null;
  number: string;
  ownerId: string;
  deliveryDate: string; // ISO date
}

export interface TicketCategory {
  id: string;
  name: string;
}

export interface WorkCrew {
  id: string;
  name: string;
  type: WorkCrewType;
  contactName: string;
  phone: string;
  zoneId: string;
  /** Obras que atiende el equipo dentro de su zona base. */
  projectIds: string[];
}

/** Límites de captura, validados en el cliente antes de subir (y luego en el backend). */
export const MAX_VIDEO_SECONDS = 5;
export const MAX_IMAGE_MB = 3;
export const MAX_VIDEO_MB = 15;

export type TicketMediaType = "IMAGE" | "VIDEO";
/** Paso del flujo en que se capturó: ingreso del propietario, visita inspectiva o solución. */
export type TicketMediaStage = "PROBLEMA" | "VISITA" | "SOLUCION";

/**
 * Foto o video corto de un ticket. `url` es hoy un data URL (fotos) o una referencia local
 * "local-media:<id>" (videos en IndexedDB); con backend será la clave del objeto en Cloudflare R2.
 */
export interface TicketMedia {
  id: string;
  url: string;
  type: TicketMediaType;
  /** Solo VIDEO; null en imágenes. */
  durationSeconds: number | null;
  stage: TicketMediaStage;
  uploadedById: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  /** Correlativo legible por obra y zona, ej. MIR-0012-C. */
  folio: string;
  unitId: string;
  categoryId: string;
  /** Categoría elegida originalmente por el propietario. */
  reportedCategoryId: string;
  /** Recinto donde está la falla: baño, cocina, dormitorio, etc. */
  room: string;
  description: string;
  status: TicketStatus;
  /**
   * Registro completo de fotos y videos. Se conserva siempre (no hay borrado al cerrar el ticket):
   * es el historial de fallas que usa el Administrador de Obra para prevenir en obras siguientes.
   */
  media: TicketMedia[];
  createdById: string;
  encargadoId: string | null;
  crewId: string | null;
  /** Fecha de la visita inspectiva (agendada mientras está ASIGNADO; efectiva después). */
  visitDate: string | null;
  /** Hora "HH:mm" de la visita; null si no se definió. */
  visitTime: string | null;
  scheduledDate: string | null;
  /** Hora "HH:mm" del trabajo programado; null si no se definió. */
  scheduledTime: string | null;
  /** Motivo obligatorio cuando status = NO_PROCEDE. */
  rejectionReason: string | null;
  /** Referencias de documentos externos (folios de OI/OT, n° de requerimiento) para enlazar cargas posteriores. */
  externalRefs: string[];
  documents: TicketDocument[];
  /** Atención excepcional fuera de garantía, visible solo para el equipo Axis. */
  specialCase: { reason: string; markedById: string; markedAt: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** Datos que una transición puede registrar además del cambio de estado. */
/** Tipos de documento que el encargado puede cargar para registrar o avanzar un requerimiento. */
export type DocumentKind = "EMAIL" | "OI" | "OI_FIRMADA" | "OT" | "INFORME_AXIS";

/** PDF adjunto a un ticket. El archivo vive en IndexedDB del navegador (src/data/document-store.ts). */
export interface TicketDocument {
  id: string;
  kind: DocumentKind;
  fileName: string;
  size: number;
  uploadedById: string;
  uploadedAt: string;
}

export interface TicketChanges {
  encargadoId?: string;
  crewId?: string;
  visitDate?: string;
  visitTime?: string | null;
  scheduledDate?: string;
  scheduledTime?: string | null;
  rejectionReason?: string;
  categoryId?: string;
  /** Fotos y videos de terreno: se agregan a los existentes. */
  media?: TicketMedia[];
}

export interface TicketStatusHistory {
  id: string;
  ticketId: string;
  from: TicketStatus | null;
  to: TicketStatus;
  changedById: string;
  comment: string | null;
  createdAt: string;
}
