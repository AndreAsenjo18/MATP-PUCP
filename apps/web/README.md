# apps/web — Interfaz web del MATP (Next.js)

Next.js (App Router) + TypeScript + Tailwind CSS. Generado con `create-next-app` y adaptado al monorepo
(npm workspaces; las dependencias se instalan desde la raíz con `npm install`).

- `npm run dev -w apps/web` — servidor de desarrollo en http://localhost:3000
- `npm run lint -w apps/web` · `npm run test -w apps/web` · `npm run build -w apps/web`

Variables: `API_INTERNAL_URL` (URL de la API vista desde el servidor Next) y `AI_MOUNT_PATH` (ruta donde la API monta la IA, `/ai` por defecto).
Antes de escribir código lee `AGENTS.md`: la versión instalada de Next.js puede diferir de lo que conoces.

## Sistema de diseño

Referencia completa: [`docs/system-design.md`](../../docs/system-design.md) (decisión: ADR-012).

```
src/components/
  ui/       átomos sin reglas del museo: Button, Badge, Card, Input, Select, Textarea
  domain/   moléculas del museo: PieceCard, PieceSheet, ImportConflictModal, ConfirmButton,
            TenureBadge, AlertBadge, LockBadge, StatusBadge y status-intents.ts (estado -> intent)
  layout/   estructura: MainLayout, Sidebar, RequireSession, PermissionNotice, navigation.ts
```

- **Colores y tipografías solo con tokens** de `src/app/globals.css` (`bg-terracota`, `text-tinta`, `border-borde`, `text-gris-texto`, `font-heading`...). Está prohibido usar la paleta genérica de Tailwind (`stone-*`, `red-*`, `amber-*`...) o colores hexadecimales: lo detecta `src/lib/design/no-generic-palette.test.ts`.
- Texto sobre fondo: use solo los pares de `src/lib/design/contrast-pairs.ts` (contraste AA verificado). Para advertencias y errores el texto va en `ambar-texto` / `carmin-texto`, no en `ambar-alerta` / `carmin-peligro`.
- `components/ui` no importa de `domain`, `layout` ni datos del museo (`components-architecture.test.ts`).
- Estados del museo siempre con `status-intents.ts` (p. ej. comodato → `info`, sin foto → `warning`, conflicto → `danger`).
- Iconos solo de `lucide-react`; un botón sin texto necesita `aria-label` (lo exige el tipo de `Button`).
- Fuentes Poppins e Inter autoalojadas con Fontsource (sin Google Fonts): la app compila y funciona sin internet.
- Pruebas de componentes con `renderToStaticMarkup` (`src/test/render.ts`), sin jsdom.
