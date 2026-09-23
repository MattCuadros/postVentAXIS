# PostventAXIS

Sistema de postventa/garantías inmobiliarias para Axis Desarrollos Constructivos. Frontend en Next.js sobre datos mock en memoria (sin backend en esta etapa).

## Stack

- Next.js 16 (App Router, `src/` dir, alias `@/*`), React 19, TypeScript `strict: true`.
- Tailwind **v3** (no v4 — el `tailwind.config.ts` y `globals.css` del proyecto usan sintaxis v3: `@tailwind`, `theme.extend`, `@apply`). No cambiar a v4 sin migrar también esos archivos.
- Sin librerías de UI de terceros (sin Radix, sin shadcn, etc.): los primitivos (`Dialog`, `Tabs`, `Select`, etc.) se construyen a mano en `src/components/ui/` con Tailwind + elementos nativos del navegador (ej. `<dialog>`).
- Validación de formularios: `zod`. Gráficos (solo en `/admin`): `recharts`. Parseo de Excel (solo en importador de usuarios): `xlsx`.
- Sin Prisma, sin backend real: todo el estado vive en `src/data/` (store en memoria).

## Marca Axis

Antes de tocar cualquier UI, lee `public/brand/formato-axis/SKILL.md` y `public/brand/formato-axis/references/aplicaciones.md`. Resumen: azul `#003399` dominante, naranjo `#FF6600` solo como acento puntual (nunca como texto informativo ni fondo grande), gris `#CCCCCC` para bandas/contenedores. Tokens ya mapeados en `tailwind.config.ts` (`accent`, `brand.orange`, `surface`, `ink`, `line`, `success/warning/danger`). Componentes de marca ya existentes: `src/components/brand/{axis-logo,axis-band,tagline}.tsx` — no recrearlos, no alterar el logo.

## Dominio

- Tipos: `src/types/domain.ts` (espejo del futuro `schema.prisma`).
- Máquina de estados de tickets: `src/lib/ticket-status.ts` (`TRANSITIONS`, `availableTransitions`, `canTransition`, `STATUS_LABEL`, `STATUS_TONE`, `MAIN_FLOW`).
- Datos semilla: `src/mocks/data.ts` (zones, categories, users, projects, units, crews, tickets, statusHistory).

## Capa de datos (`src/data/`)

Store en memoria por `Context + useReducer`, sembrado desde `src/mocks/data.ts`:

- `store.ts` — estado + reducer puro (sin efectos secundarios).
- `store-context.tsx` — `DataProvider` (envuelve la app en `src/app/layout.tsx`).
- `api.ts` — funciones async (`getTickets`, `getTicket`, `createTicket`, `transitionTicket`, etc.) que envuelven `dispatch` con una latencia simulada corta (`src/lib/delay.ts`) y devuelven la entidad ya resuelta (el `id`/`folio` se genera antes de despachar, no se re-lee del estado tras el dispatch).
- `session-context.tsx` — usuario actual simulado, persistido en cookie `pv_user_id` para que `src/middleware.ts` pueda leerla server-side.

## Sesión y roles

- `/login`: selector de usuario mock (propietario, encargado o admin) → guarda cookie de sesión → redirige a la home de su rol.
- `src/middleware.ts` redirige según la cookie: sin sesión → `/login`; con sesión, cada rol solo accede a su propio route group (`(propietario)`, `(encargado)`, `(admin)`).
- Conmutador de usuario visible solo en desarrollo (`process.env.NODE_ENV === "development"`), en el header de cada layout por rol.

## Convenciones de componentes

- Componentes de dominio (tickets, transiciones) en `src/components/tickets/`; de admin en `src/components/admin/`; primitivos genéricos en `src/components/ui/`.
- Reutilizar siempre `Card`, `Button`, `StatusBadge`, `StatusTimeline`, `cn` ya existentes antes de crear algo nuevo equivalente.
- Mobile-first para `(propietario)` y `(encargado)`; desktop-first para `(admin)`.

## Verificación

Tras cada fase: `npx tsc --noEmit` y `npm run lint`. Antes de dar una fase por cerrada, correr `npm run build`.
