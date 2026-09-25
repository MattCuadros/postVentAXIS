/**
 * Tipos del dominio de Postventa.
 * Espejo 1:1 del futuro schema.prisma: el frontend se construye contra estos
 * tipos y, al llegar el backend, solo cambia la fuente de datos.
 */

export type Role = "ADMIN" | "ENCARGADO" | "PROPIETARIO";

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

export interface TicketPhoto {
  id: string;
  url: string;
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
  photos: TicketPhoto[];
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
  /** Fotos de terreno: se agregan a las existentes. */
  photos?: TicketPhoto[];
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
