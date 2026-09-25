/**
 * Datos de prueba para construir el frontend sin backend.
 * Nombres y obras son ficticios. Se reemplazan por Server Actions en la Etapa 3.
 */
import type {
  Project, Ticket, TicketCategory, TicketStatusHistory, Unit, User, WorkCrew, Zone,
} from "@/types/domain";

export const zones: Zone[] = [
  { id: "z-norte", name: "Zona Norte", code: "N" },
  { id: "z-centro", name: "Zona Centro", code: "C" },
  { id: "z-sur", name: "Zona Sur", code: "S" },
  { id: "z-austral", name: "Zona Austral", code: "A" },
];

export const categories: TicketCategory[] = [
  { id: "c-sanitarias", name: "Sanitarias" },
  { id: "c-ceramicas", name: "Cerámicas" },
  { id: "c-ventanas", name: "Ventanas" },
  { id: "c-techo", name: "Techo" },
  { id: "c-pintura", name: "Pintura" },
  { id: "c-puertas", name: "Puertas" },
  { id: "c-pisos", name: "Pisos" },
  { id: "c-muros", name: "Muros y tabiques" },
  { id: "c-calefaccion", name: "Calefacción y gas" },
  { id: "c-otros", name: "Otros" },
];

export const users: User[] = [
  { id: "u-admin", name: "Carolina Fuentes", email: "admin@demo.cl", phone: "+56 9 1111 1111", role: "ADMIN", zoneIds: [], active: true },
  { id: "u-enc-centro", name: "Rodrigo Pérez", email: "rperez@demo.cl", phone: "+56 9 2222 2222", role: "ENCARGADO", zoneIds: ["z-centro"], active: true },
  { id: "u-enc-sur", name: "Valentina Rojas", email: "vrojas@demo.cl", phone: "+56 9 3333 3333", role: "ENCARGADO", zoneIds: ["z-sur", "z-norte"], active: true },
  { id: "u-prop-1", name: "Andrés Muñoz", email: "amunoz@correo.cl", phone: "+56 9 4444 4444", role: "PROPIETARIO", zoneIds: [], active: true },
  { id: "u-prop-2", name: "Francisca Soto", email: "fsoto@correo.cl", phone: "+56 9 5555 5555", role: "PROPIETARIO", zoneIds: [], active: true },
  { id: "u-prop-3", name: "Tomás Herrera", email: "therrera@correo.cl", phone: "+56 9 5656 5656", role: "PROPIETARIO", zoneIds: [], active: true },
  { id: "u-prop-4", name: "Camila Reyes", email: "creyes@correo.cl", phone: "+56 9 5757 5757", role: "PROPIETARIO", zoneIds: [], active: true },
  { id: "u-enc-austral", name: "Viviana Hernández", email: "vhernandez@demo.cl", phone: "+56 9 3434 3434", role: "ENCARGADO", zoneIds: ["z-austral"], active: true },
  { id: "u-prop-5", name: "Ignacio Vera", email: "ivera@correo.cl", phone: "+56 9 6161 6161", role: "PROPIETARIO", zoneIds: [], active: true },
  { id: "u-prop-6", name: "Paula Contreras", email: "pcontreras@correo.cl", phone: "+56 9 6262 6262", role: "PROPIETARIO", zoneIds: [], active: true },
  { id: "u-prop-7", name: "Martín Olivares", email: "molivares@correo.cl", phone: "+56 9 6363 6363", role: "PROPIETARIO", zoneIds: [], active: true },
];

export const projects: Project[] = [
  { id: "p-mirador", name: "Edificio Mirador Central", code: "MIR", zoneId: "z-centro", address: "Av. Ejemplo 1234", commune: "Santiago", location: { lat: -33.4489, lng: -70.6693 } },
  { id: "p-altobulnes", name: "Alto Bulnes III", code: "AB3", zoneId: "z-austral", address: "Av. Bulnes 3200", commune: "Punta Arenas", location: { lat: -53.1395, lng: -70.9138 } },
  { id: "p-bosque", name: "Condominio Los Robles", code: "ROB", zoneId: "z-sur", address: "Camino Demo 567", commune: "Puerto Montt", location: { lat: -41.4693, lng: -72.9424 } },
];

export const units: Unit[] = [
  { id: "un-1", projectId: "p-mirador", type: "DEPARTAMENTO", tower: "A", floor: 7, number: "704", ownerId: "u-prop-1", deliveryDate: "2026-03-15" },
  { id: "un-2", projectId: "p-bosque", type: "CASA", tower: null, floor: null, number: "12", ownerId: "u-prop-2", deliveryDate: "2025-11-02" },
  { id: "un-3", projectId: "p-mirador", type: "DEPARTAMENTO", tower: "B", floor: 3, number: "302", ownerId: "u-prop-3", deliveryDate: "2026-03-15" },
  { id: "un-ab-g26", projectId: "p-altobulnes", type: "CASA", tower: null, floor: null, number: "G26", ownerId: "u-prop-5", deliveryDate: "2025-12-26" },
  { id: "un-ab-f3", projectId: "p-altobulnes", type: "CASA", tower: null, floor: null, number: "F3", ownerId: "u-prop-6", deliveryDate: "2022-12-01" },
  { id: "un-ab-f35", projectId: "p-altobulnes", type: "CASA", tower: null, floor: null, number: "F35", ownerId: "u-prop-7", deliveryDate: "2023-07-14" },
  { id: "un-4", projectId: "p-mirador", type: "DEPARTAMENTO", tower: "C", floor: 1, number: "105", ownerId: "u-prop-4", deliveryDate: "2026-04-10" },
];

export const crews: WorkCrew[] = [
  { id: "w-int-centro", name: "Cuadrilla Postventa Centro", type: "INTERNO", contactName: "Jaime Lagos", phone: "+56 9 6666 6666", zoneId: "z-centro", projectIds: ["p-mirador"] },
  { id: "w-sub-ventanas", name: "Ventanas del Pacífico Ltda.", type: "SUBCONTRATO", contactName: "Marcela Vidal", phone: "+56 9 7777 7777", zoneId: "z-centro", projectIds: ["p-mirador"] },
  { id: "w-int-austral", name: "Cuadrilla Postventa Austral", type: "INTERNO", contactName: "Rodrigo Barría", phone: "+56 9 9191 9191", zoneId: "z-austral", projectIds: ["p-altobulnes"] },
  { id: "w-int-sur", name: "Cuadrilla Postventa Sur", type: "INTERNO", contactName: "Pablo Cárdenas", phone: "+56 9 8888 8888", zoneId: "z-sur", projectIds: ["p-bosque"] },
];

export const tickets: Ticket[] = [
  {
    id: "t-1", folio: "MIR-0001-C", unitId: "un-1", categoryId: "c-sanitarias", reportedCategoryId: "c-sanitarias", room: "Baño principal",
    description: "Filtración bajo el lavamanos, se moja el mueble.", status: "PROGRAMADO",
    photos: [], createdById: "u-prop-1", encargadoId: "u-enc-centro", crewId: "w-int-centro",
    visitDate: "2026-09-10", visitTime: null, scheduledDate: "2026-09-25", scheduledTime: null, rejectionReason: null, specialCase: null, externalRefs: [], documents: [],
    createdAt: "2026-09-02T10:15:00Z", updatedAt: "2026-09-12T16:40:00Z",
  },
  {
    id: "t-2", folio: "MIR-0002-C", unitId: "un-1", categoryId: "c-ventanas", reportedCategoryId: "c-ventanas", room: "Living",
    description: "La ventana corredera no cierra completamente.", status: "EN_RECEPCION",
    photos: [], createdById: "u-prop-1", encargadoId: "u-enc-centro", crewId: "w-sub-ventanas",
    visitDate: "2026-08-20", visitTime: null, scheduledDate: "2026-09-05", scheduledTime: null, rejectionReason: null, specialCase: null, externalRefs: [], documents: [],
    createdAt: "2026-08-14T09:00:00Z", updatedAt: "2026-09-18T12:00:00Z",
  },
  {
    id: "t-3", folio: "ROB-0001-S", unitId: "un-2", categoryId: "c-pintura", reportedCategoryId: "c-pintura", room: "Dormitorio 2",
    description: "Pintura descascarada en muro exterior del dormitorio.", status: "INGRESADO",
    photos: [], createdById: "u-prop-2", encargadoId: null, crewId: null,
    visitDate: null, visitTime: null, scheduledDate: null, scheduledTime: null, rejectionReason: null, specialCase: null, externalRefs: [], documents: [],
    createdAt: "2026-09-21T18:30:00Z", updatedAt: "2026-09-21T18:30:00Z",
  },
  {
    id: "t-4", folio: "MIR-0003-C", unitId: "un-3", categoryId: "c-sanitarias", reportedCategoryId: "c-sanitarias", room: "Cocina",
    description: "Gotea la llave del lavaplatos aunque esté cerrada.", status: "EN_REVISION",
    photos: [], createdById: "u-prop-3", encargadoId: "u-enc-centro", crewId: null,
    visitDate: null, visitTime: null, scheduledDate: null, scheduledTime: null, rejectionReason: null, specialCase: null, externalRefs: [], documents: [],
    createdAt: "2026-09-21T13:10:00Z", updatedAt: "2026-09-22T09:00:00Z",
  },
  {
    id: "t-5", folio: "MIR-0004-C", unitId: "un-4", categoryId: "c-ceramicas", reportedCategoryId: "c-ceramicas", room: "Baño principal",
    description: "Cerámica del piso de la ducha suelta y con fisura.", status: "ASIGNADO",
    photos: [], createdById: "u-prop-4", encargadoId: "u-enc-centro", crewId: "w-int-centro",
    visitDate: null, visitTime: null, scheduledDate: null, scheduledTime: null, rejectionReason: null, specialCase: null, externalRefs: [], documents: [],
    createdAt: "2026-09-17T20:45:00Z", updatedAt: "2026-09-19T10:00:00Z",
  },
  {
    id: "t-6", folio: "MIR-0005-C", unitId: "un-3", categoryId: "c-puertas", reportedCategoryId: "c-puertas", room: "Dormitorio principal",
    description: "La puerta roza el piso y cuesta cerrarla.", status: "CERRADO",
    photos: [], createdById: "u-prop-3", encargadoId: "u-enc-centro", crewId: "w-int-centro",
    visitDate: "2026-08-25", visitTime: null, scheduledDate: "2026-09-01", scheduledTime: null, rejectionReason: null, specialCase: null, externalRefs: [], documents: [],
    createdAt: "2026-08-20T11:00:00Z", updatedAt: "2026-09-08T17:00:00Z",
  },
];

export const statusHistory: TicketStatusHistory[] = [
  { id: "h-1", ticketId: "t-1", from: null, to: "INGRESADO", changedById: "u-prop-1", comment: null, createdAt: "2026-09-02T10:15:00Z" },
  { id: "h-2", ticketId: "t-1", from: "INGRESADO", to: "EN_REVISION", changedById: "u-enc-centro", comment: null, createdAt: "2026-09-03T08:30:00Z" },
  { id: "h-3", ticketId: "t-1", from: "EN_REVISION", to: "ASIGNADO", changedById: "u-enc-centro", comment: "Cuadrilla interna.", createdAt: "2026-09-03T09:00:00Z" },
  { id: "h-4", ticketId: "t-1", from: "ASIGNADO", to: "VISITA_INSPECTIVA", changedById: "u-enc-centro", comment: "Sifón mal sellado.", createdAt: "2026-09-10T11:20:00Z" },
  { id: "h-5", ticketId: "t-1", from: "VISITA_INSPECTIVA", to: "PROGRAMADO", changedById: "u-enc-centro", comment: "Coordinado con propietario.", createdAt: "2026-09-12T16:40:00Z" },
  { id: "h-6", ticketId: "t-2", from: null, to: "INGRESADO", changedById: "u-prop-1", comment: null, createdAt: "2026-08-14T09:00:00Z" },
  { id: "h-7", ticketId: "t-2", from: "INGRESADO", to: "EN_REVISION", changedById: "u-enc-centro", comment: null, createdAt: "2026-08-16T10:00:00Z" },
  { id: "h-8", ticketId: "t-2", from: "EN_REVISION", to: "ASIGNADO", changedById: "u-enc-centro", comment: "Subcontrato de ventanas.", createdAt: "2026-08-18T11:30:00Z" },
  { id: "h-9", ticketId: "t-2", from: "ASIGNADO", to: "VISITA_INSPECTIVA", changedById: "u-enc-centro", comment: "Riel desalineado.", createdAt: "2026-08-20T15:00:00Z" },
  { id: "h-10", ticketId: "t-2", from: "VISITA_INSPECTIVA", to: "PROGRAMADO", changedById: "u-enc-centro", comment: null, createdAt: "2026-09-02T09:00:00Z" },
  { id: "h-11", ticketId: "t-2", from: "PROGRAMADO", to: "EN_EJECUCION", changedById: "u-enc-centro", comment: null, createdAt: "2026-09-05T08:30:00Z" },
  { id: "h-12", ticketId: "t-2", from: "EN_EJECUCION", to: "EN_RECEPCION", changedById: "u-enc-centro", comment: "Riel cambiado y regulado.", createdAt: "2026-09-18T12:00:00Z" },
  { id: "h-13", ticketId: "t-3", from: null, to: "INGRESADO", changedById: "u-prop-2", comment: null, createdAt: "2026-09-21T18:30:00Z" },
  { id: "h-14", ticketId: "t-4", from: null, to: "INGRESADO", changedById: "u-prop-3", comment: null, createdAt: "2026-09-21T13:10:00Z" },
  { id: "h-15", ticketId: "t-4", from: "INGRESADO", to: "EN_REVISION", changedById: "u-enc-centro", comment: null, createdAt: "2026-09-22T09:00:00Z" },
  { id: "h-16", ticketId: "t-5", from: null, to: "INGRESADO", changedById: "u-prop-4", comment: null, createdAt: "2026-09-17T20:45:00Z" },
  { id: "h-17", ticketId: "t-5", from: "INGRESADO", to: "EN_REVISION", changedById: "u-enc-centro", comment: null, createdAt: "2026-09-18T08:40:00Z" },
  { id: "h-18", ticketId: "t-5", from: "EN_REVISION", to: "ASIGNADO", changedById: "u-enc-centro", comment: null, createdAt: "2026-09-19T10:00:00Z" },
  { id: "h-19", ticketId: "t-6", from: null, to: "INGRESADO", changedById: "u-prop-3", comment: null, createdAt: "2026-08-20T11:00:00Z" },
  { id: "h-20", ticketId: "t-6", from: "INGRESADO", to: "EN_REVISION", changedById: "u-enc-centro", comment: null, createdAt: "2026-08-21T09:00:00Z" },
  { id: "h-21", ticketId: "t-6", from: "EN_REVISION", to: "ASIGNADO", changedById: "u-enc-centro", comment: null, createdAt: "2026-08-21T09:30:00Z" },
  { id: "h-22", ticketId: "t-6", from: "ASIGNADO", to: "VISITA_INSPECTIVA", changedById: "u-enc-centro", comment: "Bisagras descolgadas, requiere cepillar la hoja.", createdAt: "2026-08-25T15:00:00Z" },
  { id: "h-23", ticketId: "t-6", from: "VISITA_INSPECTIVA", to: "PROGRAMADO", changedById: "u-enc-centro", comment: null, createdAt: "2026-08-26T10:00:00Z" },
  { id: "h-24", ticketId: "t-6", from: "PROGRAMADO", to: "EN_EJECUCION", changedById: "u-enc-centro", comment: null, createdAt: "2026-09-01T09:00:00Z" },
  { id: "h-25", ticketId: "t-6", from: "EN_EJECUCION", to: "EN_RECEPCION", changedById: "u-enc-centro", comment: "Puerta cepillada y bisagras reguladas.", createdAt: "2026-09-01T16:00:00Z" },
  { id: "h-26", ticketId: "t-6", from: "EN_RECEPCION", to: "CERRADO", changedById: "u-prop-3", comment: null, createdAt: "2026-09-08T17:00:00Z" },
];
