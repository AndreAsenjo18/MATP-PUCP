# Sistema de diseño del frontend (MATP)

Versión adaptada del documento del equipo [`docs/fuentes/system-design-frontend.md`](fuentes/system-design-frontend.md) para el stack real de `apps/web` (Next.js App Router + Tailwind 4). Change de origen: `sistema-diseno-frontend`. Decisión: [ADR-012](adr/ADR-012-sistema-diseno-frontend.md).

Qué cambia respecto al documento del equipo:

| Documento del equipo | Implementación | Motivo |
|---|---|---|
| `tailwind.config.js` | Bloque `@theme` en `apps/web/src/app/globals.css` | Tailwind 4 no lee `tailwind.config.js` |
| Nombres en español (`CardPieza`, `denominacion`…) | Nombres en inglés (`PieceCard`, `title`…) | ADR-002: código en inglés; los textos visibles siguen en español |
| `ambar-alerta` / `carmin-peligro` como color de texto de badges | `ambar-texto` / `carmin-texto` | Los originales no llegan a contraste AA (2.7:1 y 3.6:1) |
| Badges `text-xs uppercase` | `text-sm`, sin mayúsculas forzadas | RNF-010: lectura para baja alfabetización digital |
| Barra lateral oculta en móvil | Botón «Menú» con panel desplegable | RNF-001: navegación también en el depósito |
| Fuentes cargadas desde `index.html` | Fontsource (archivos dentro del build) | RNF-008: funciona sin internet |
| `pages/`, `utils/` | `src/app/` y `src/lib/` | Convenciones de Next.js y del repo |

## 1. Niveles (Atomic Design)

| Nivel | Carpeta | Contiene | Puede importar |
|---|---|---|---|
| Átomos | `src/components/ui/` | `Button`, `Badge`, `Card`, `Input`, `Select`, `Textarea` | React, `lucide-react`, `@/lib/cn` |
| Moléculas | `src/components/domain/` | `PieceCard`, `PieceSheet`, `ImportConflictModal`, `ConfirmButton`, `TenureBadge`, `AlertBadge`, `LockBadge`, `StatusBadge`, `status-intents` | `ui/`, tipos de `@/lib/api`, funciones de `@/lib/data` |
| Estructura | `src/components/layout/` | `MainLayout`, `Sidebar`, `RequireSession`, `PermissionNotice`, `navigation` | `ui/`, `@/lib/auth` |
| Pantallas | `src/app/**/page.tsx` | Ensamblan todo lo anterior | Todo |

Reglas (verificadas por `components-architecture.test.ts`): `ui/` nunca importa de `domain/`, `layout/`, `lib/fixtures`, `lib/data` ni `lib/auth`; `layout/` no contiene reglas de inventario; las pantallas no definen estilos de color sueltos.

## 2. Tokens

Declarados en `apps/web/src/app/globals.css`. Generan clases como `bg-terracota`, `text-tinta`, `border-borde`, `font-heading`.

| Token | Valor | Uso |
|---|---|---|
| `terracota` / `terracota-dark` / `terracota-light` | `#A23C16` / `#852F0F` / `#F0DAD0` | Primario, hover, fondos suaves, badge `info` |
| `tinta` | `#0C0F14` | Texto principal, barra lateral |
| `crema` / `crema-light` | `#F5F0DA` / `#FAF7EE` | Fondo de la aplicación |
| `borde` | `#E3DECB` | Bordes, divisores, badge `default` |
| `gris-texto` | `#5B534C` | Texto secundario |
| `verde-exito` / `verde-bg` | `#007438` / `#E1EFD8` | Estado correcto |
| `ambar-alerta` / `ambar-bg` / `ambar-texto` | `#C8791E` / `#F5E4CC` / `#8A4F0C` | Advertencia: borde e icono / fondo / **texto** |
| `carmin-peligro` / `carmin-bg` / `carmin-texto` | `#DA2A4E` / `#F7D9DF` / `#A3183A` | Error: fondo sólido y borde / fondo suave / **texto** y hover |
| `font-heading` / `font-sans` | Poppins / Inter (respaldo `system-ui`) | Títulos / cuerpo |

Los pares de texto sobre fondo permitidos están en `apps/web/src/lib/design/contrast-pairs.ts` y la prueba `design-tokens.test.ts` exige contraste ≥ 4.5:1. Está **prohibido** usar la paleta genérica de Tailwind (`stone-*`, `red-*`, `amber-*`…) o colores hexadecimales en componentes: lo detecta `no-generic-palette.test.ts`. Se permiten `white`, `black` y `transparent`.

> [SUPUESTO] Los colores vienen del documento del equipo; no está confirmado que sean la identidad oficial de la Dirección de Cultura (pregunta J1 en `docs/preguntas-contraparte.md`).

## 3. Átomos

### `Button`

```tsx
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

<Button variant="primary" icon={Plus} onClick={createPiece}>Nueva pieza</Button>
<Button variant="outline" icon={X} aria-label="Cerrar" />   {/* solo icono: aria-label obligatorio */}
```

| Prop | Tipo | Default |
|---|---|---|
| `variant` | `"primary" \| "secondary" \| "outline" \| "danger"` | `"primary"` |
| `size` | `"md" \| "lg"` | `"md"` (`lg` para acciones grandes en depósito) |
| `icon` | `LucideIcon` | — |
| `className` | `string` (se aplica al final) | `""` |

Altura mínima 44 px, foco visible y estado deshabilitado atenuado.

### `Badge`

| `intent` | Significado en el museo |
|---|---|
| `success` | Ubicada, aprobada |
| `info` | Comodato, préstamo temporal |
| `warning` | Información incompleta, sin foto, pendiente de revisión |
| `danger` | Conflicto de importación, rechazada, alerta |
| `default` | Código, estado neutro o valor desconocido |

Siempre lleva texto visible; el color nunca es el único portador del significado. Los mapeos de estados del museo a `intent` están en `components/domain/status-intents.ts`.

### `Card`, `Input`, `Select`, `Textarea`

`Card` es el contenedor con borde `borde` y fondo blanco (`interactive` añade hover); `cardClassName()` permite aplicar el mismo estilo a un `Link`. Los campos llevan siempre `label` visible, `hint` opcional y `error` en español enlazado con `aria-describedby`.

## 4. Moléculas del museo

- `PieceCard`: tarjeta de resultado de búsqueda (título, colección, código I en `font-mono text-terracota`, ubicación, badge de tenencia, alertas y aviso «Sin foto»).
- `PieceSheet`: secciones de la ficha de pieza (datos, identificadores con candado del código I, fotos, ubicación).
- `ImportConflictModal`: comparación de una fila en conflicto con el catálogo y decisión aceptar / excluir / rechazar.
- `ConfirmButton`: toda acción irreversible o masiva pide confirmación explícita (RNF-010, RN-005).

## 5. Estructura

`MainLayout` envuelve todas las pantallas: sin sesión muestra solo la pantalla de acceso; con sesión muestra `Sidebar` (fondo `tinta`) en escritorio, un botón «Menú» con panel en móvil (se cierra con Escape o al elegir sección), y un encabezado con usuario, rol, «Cambiar de rol» y el aviso de modo demostración. Las secciones se filtran por permiso del rol (RF-039).

## 6. Convenciones

- Componentes en `PascalCase`, props y utilidades en `camelCase`, todo en inglés; textos de UI en español.
- Iconos solo de `lucide-react`, 16–20 px; decorativos con `aria-hidden`, y botones de solo icono con `aria-label` en español.
- `className` siempre al final para permitir ajustes.
- Datos de ejemplo solo sintéticos (RNF-014).
