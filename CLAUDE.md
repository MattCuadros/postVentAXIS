# PostventAXIS

Sistema de postventa/garantías inmobiliarias para Axis Desarrollos Constructivos. Frontend en Next.js sobre datos mock en memoria (sin backend en esta etapa).

## Stack

- Next.js 16 (App Router, `src/` dir, alias `@/*`), React 19, TypeScript `strict: true`.
- Tailwind **v3** (no v4 — el `tailwind.config.ts` y `globals.css` del proyecto usan sintaxis v3: `@tailwind`, `theme.extend`, `@apply`). No cambiar a v4 sin migrar también esos archivos.
- Sin librerías de UI de terceros (sin Radix, sin shadcn, etc.): los primitivos (`Dialog`, `Tabs`, `Select`, etc.) se construyen a mano en `src/components/ui/` con Tailwind + elementos nativos del navegador (ej. `<dialog>`).
- Excepción: el calendario del encargado usa FullCalendar 6.1 (`@fullcalendar/*`), con estilos propios en `src/components/tickets/staff-calendar.css` (tokens de marca).
- Validación de formularios: `zod`. Gráficos (solo en `/admin`): `recharts`. Parseo de Excel (solo en importador de usuarios): `xlsx`.
- Sin Prisma, sin backend real: todo el estado vive en `src/data/` (store en memoria).

## Marca Axis

Antes de tocar cualquier UI, lee `public/brand/formato-axis/SKILL.md` y `public/brand/formato-axis/references/aplicaciones.md`. Resumen: azul `#003399` dominante, naranjo `#FF6600` solo como acento puntual (nunca como texto informativo ni fondo grande), gris `#CCCCCC` para bandas/contenedores. Tokens ya mapeados en `tailwind.config.ts` (`accent`, `brand.orange`, `surface`, `ink`, `line`, `success/warning/danger`). Componentes de marca ya existentes: `src/components/brand/{axis-logo,axis-band,tagline}.tsx` — no recrearlos, no alterar el logo.

## Dominio

- Tipos: `src/types/domain.ts` (espejo del futuro `schema.prisma`). Zonas tienen código y las obras un código único para folios `<OBRA>-<NNNN>-<ZONA>`; los tickets conservan origen reportado/confirmado y pueden marcarse como caso especial por personal.
- Máquina de estados de tickets: `src/lib/ticket-status.ts` (`TRANSITIONS`, `availableTransitions`, `canTransition`, `STATUS_LABEL`, `STATUS_TONE`, `MAIN_FLOW`).
- Datos semilla: `src/mocks/data.ts` (zones, categories, users, projects, units, crews, tickets, statusHistory).

## Capa de datos (`src/data/`)

Store en memoria por `Context + useReducer`, sembrado desde `src/mocks/data.ts`:

- `store.ts` — estado + reducer puro (sin efectos secundarios).
- `store-context.tsx` — `DataProvider` (envuelve la app en `src/app/layout.tsx`).
- `api.ts` — funciones async (`getTickets`, `getTicket`, `createTicket`, `transitionTicket`, etc.) que envuelven `dispatch` con una latencia simulada corta (`src/lib/delay.ts`) y devuelven la entidad ya resuelta (el `id`/`folio` se genera antes de despachar, no se re-lee del estado tras el dispatch).
- `session-context.tsx` — usuario actual simulado, persistido en cookie `pv_user_id` para que `src/proxy.ts` (el "middleware" de Next 16) pueda leerla server-side.

## Sesión y roles

- `/login`: selector de usuario mock (propietario, encargado o admin) → guarda cookie de sesión → redirige a la home de su rol.
- `src/proxy.ts` (el "middleware" de Next 16) redirige según la cookie: sin sesión → `/login`; con sesión, cada rol solo accede a su propio route group (`(propietario)`, `(encargado)`, `(admin)`).
- Conmutador de usuario visible solo en desarrollo (`process.env.NODE_ENV === "development"`), en el header de cada layout por rol.

## Convenciones de componentes

- Componentes de dominio (tickets, transiciones) en `src/components/tickets/`; de admin en `src/components/admin/`; primitivos genéricos en `src/components/ui/`.
- Reutilizar siempre `Card`, `Button`, `StatusBadge`, `StatusTimeline`, `cn` ya existentes antes de crear algo nuevo equivalente.
- Mobile-first para `(propietario)` y `(encargado)`; desktop-first para `(admin)`.

## Verificación

Tras cada fase: `npx tsc --noEmit` y `npm run lint`. Antes de dar una fase por cerrada, correr `npm run build`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Flujo de trabajo

- **Codex (OpenAI) implementa; Claude planifica y revisa.** Claude arma el encargo (contexto, archivos, criterios de aceptación), lo delega a Codex, revisa el diff, corre `tsc`/`lint`/`build`, prueba en el navegador y reporta. Claude no implementa las fases directamente.
- Excepción vigente (desde 2026-09-25): sin cupo de Codex, Claude implementa hasta que haya un plan pagado.

## Carga de documentos (encargados)

- `/encargado/documentos`: PDF de correo, OI, OI firmada, OT o informe AXIS → revisión → crea o avanza tickets (`importDocument` en `api.ts`, acción `IMPORT_DOCUMENT`).
- Lectura en el navegador (`src/lib/document-import/`): `extract.ts` (pdfjs; OCR con tesseract.js si es escaneo), `parsers.ts` y `match.ts` (puros), `plan.ts` (estados e historial por tipo de documento).
- El worker de pdfjs se sirve desde `public/pdf.worker.min.mjs`: al actualizar `pdfjs-dist`, volver a copiarlo desde `node_modules/pdfjs-dist/build/`.
- Los PDF se guardan en IndexedDB (`src/data/document-store.ts`); el ticket guarda solo la metadata.
- Ejemplos reales de documentos en `examples/` (fuera del repo); textos anonimizados en `examples/textos/`. Nunca subir datos reales de clientes al repo.

## Persistencia local (sin backend)

- `src/data/persistence.ts` guarda el estado completo en `localStorage` (`postventaxis:datos`, versionado; cada versión migra la anterior: v1→v2 folios por obra, v2→v3 horas de visita/trabajo, v3→v4 referencias y documentos de tickets). `DataProvider` lo carga al montar, guarda en cada cambio y sincroniza entre pestañas. "Restablecer datos de ejemplo" (menú de usuario) vuelve a `createSeedState()`.
- La sesión usa dos cookies: `pv_user_id` y `pv_role`. `src/proxy.ts` rutea solo por rol; el cliente valida que el usuario exista y esté activo.
