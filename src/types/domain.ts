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
}

export interface TicketPhoto {
  id: string;
  url: string;
  uploadedById: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  /** Correlativo legible, ej. PV-000123. */
  folio: string;
  unitId: string;
  categoryId: string;
  /** Recinto donde está la falla: baño, cocina, dormitorio, etc. */
  room: string;
  description: string;
  status: TicketStatus;
  photos: TicketPhoto[];
  createdById: string;
  encargadoId: string | null;
  crewId: string | null;
  visitDate: string | null;
  scheduledDate: string | null;
  /** Motivo obligatorio cuando status = NO_PROCEDE. */
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Datos que una transición puede registrar además del cambio de estado. */
export interface TicketChanges {
  encargadoId?: string;
  crewId?: string;
  visitDate?: string;
  scheduledDate?: string;
  rejectionReason?: string;
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
