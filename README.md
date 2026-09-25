# PostventAXIS

Sistema de postventa y garantías inmobiliarias para **Axis Desarrollos Constructivos**.

**Demo publicada:** https://post-vent-axis.vercel.app

> Prototipo funcional sin backend: los datos son de ejemplo y se guardan solo en el navegador de cada persona (`localStorage`). El inicio de sesión es simulado: se elige un usuario de la lista. No ingresar datos reales de clientes.

## Qué hace cada rol

- **Propietario** (móvil): ve sus requerimientos, ingresa uno nuevo en 4 pasos (vivienda, tipo de problema, descripción con fotos, confirmación) y da su conformidad o la rechaza con un motivo.
- **Encargado zonal**: bandeja de su zona, detalle con historial, y registro de cada paso: asignar equipo, visita inspectiva, programación, ejecución, solicitud de recepción o "no procede".
- **Superadministrador**: indicadores con exportación a Excel, requerimientos de todas las zonas, usuarios (alta, edición, desactivación e importación desde Excel), obras con su ubicación y unidades (con importación CSV) y equipos de trabajo.

Usuarios de ejemplo: Carolina Fuentes (superadmin), Rodrigo Pérez (encargado Zona Centro), Andrés Muñoz (propietario). El menú de usuario permite restablecer los datos de ejemplo.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npx tsc --noEmit && npm run lint && npm run build   # verificación antes de cada commit
```

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 3, zod, recharts, SheetJS. Marca según el Manual de Uso de Marca Axis 2024 (`public/brand/formato-axis/`).

Cada push a `master` se publica automáticamente en Vercel.
