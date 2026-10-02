# PostventAXIS

Sistema de postventa y garantías inmobiliarias para **Axis Desarrollos Constructivos**.

**Demo publicada:** https://post-vent-axis.vercel.app

> Prototipo funcional sin backend: los datos son de ejemplo y se guardan solo en el navegador de cada persona (`localStorage`). La entrada (`/login`) es un formulario de correo y contraseña que todavía no tiene backend; mientras dure la etapa de pruebas hay un botón hacia `/pruebas`, donde se elige un usuario de la lista (inicio de sesión simulado). No ingresar datos reales de clientes.

## Qué hace cada rol

- **Propietario** (móvil): ve sus requerimientos, ingresa uno nuevo en 4 pasos (vivienda, tipo de problema, descripción con fotos, confirmación) y da su conformidad o la rechaza con un motivo.
- **Encargado zonal**: bandeja de su zona, detalle con historial, y registro de cada paso: asignar equipo, visita inspectiva, programación, ejecución, solicitud de recepción o "no procede".
- **Superadministrador**: indicadores con exportación a Excel, requerimientos de todas las zonas, usuarios (alta, edición, desactivación e importación desde Excel), obras con su ubicación y unidades (con importación CSV) y equipos de trabajo.

Usuarios de ejemplo: Carolina Fuentes (superadmin), Rodrigo Pérez (encargado Zona Centro), Andrés Muñoz (propietario). El menú de usuario permite restablecer los datos de ejemplo.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck && npm run lint && npm run build
```

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 3, zod, recharts, SheetJS. Marca según el Manual de Uso de Marca Axis 2024 (`public/brand/formato-axis/`).

Cada push a `master` se publica automáticamente en Vercel.

## Prototipo local del agente de autogestión

El agente conversa con el propietario antes de crear un requerimiento. Si los pasos seguros resuelven el problema, no crea ticket; si no, prepara un borrador editable en el formulario actual y espera que el propietario confirme el envío. Las urgencias se derivan con instrucciones fijas, sin diagnóstico de garantía ni reparaciones peligrosas.

Esta es una prueba local, no habilitada en producción. Usa solo usuarios y datos sintéticos de la demo; no escribas nombres, direcciones, teléfonos, números de unidad ni información real. La conversación se procesa en memoria dentro de Next.js, con reglas locales y las dos fichas de referencia incluidas en el código. No requiere Python, otro servicio, claves ni conexión a un proveedor externo. No hay notificación real a personal de guardia. El ranking de 15–20 fallas queda pendiente de historial anonimizado y validado por postventa.

Inicia PostventAXIS con `npm run dev`, ingresa a `/pruebas` como propietario y abre **Autogestión guiada** en `/propietario`. Ejecuta las pruebas con `npm run test`.

La ruta del agente está limitada a `development`; las conversaciones viven temporalmente en memoria del proceso y se pierden al reiniciar Next.js. Este prototipo usa reglas y plantillas acotadas (no un modelo generativo) y ofrece derivación al formulario cuando no reconoce una consulta. Antes de cualquier piloto compartido se necesitan autenticación real, una base de conocimiento más amplia y aprobada, evaluación conversacional, política de retención, revisión de seguridad y una ruta operativa de escalamiento humano.

### Modo pruebas

`NEXT_PUBLIC_MODO_PRUEBAS` controla el botón "Entrar a la pantalla de pruebas" y la ruta `/pruebas`. Está activo salvo que valga exactamente `false`, así que el despliegue actual funciona sin configurar nada. Para salir de la etapa de pruebas, configúrala como `false` en Vercel y vuelve a desplegar (las variables `NEXT_PUBLIC_` se fijan al compilar).
