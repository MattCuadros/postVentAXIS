# Postventa · Etapa 0 (cimientos del frontend)

1. Crear el proyecto base:
   npx create-next-app@latest postventa --ts --tailwind --app --src-dir --import-alias "@/*"
2. Copiar encima las carpetas `src/` y el archivo `tailwind.config.ts` de este paquete.
3. En `tsconfig.json`, activar `"strict": true` (y opcionalmente `"noUncheckedIndexedAccess": true`).

Contenido:
- src/types/domain.ts        Tipos del dominio (espejo del futuro schema.prisma)
- src/lib/ticket-status.ts   Máquina de estados: etiquetas, transiciones y permisos por rol
- src/mocks/data.ts          Datos de prueba ficticios
- src/components/ui/*        Button, Card, StatusBadge, StatusTimeline
- tailwind.config.ts         Tokens de marca Axis (manual 2024 v3)
- src/components/brand/*     AxisLogo, AxisBand (huincha tricolor), Tagline
- public/brand/*             Logos oficiales
