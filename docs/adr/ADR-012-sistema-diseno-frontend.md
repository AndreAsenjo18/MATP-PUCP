# ADR-012 — Sistema de diseño del frontend: Atomic Design, tokens institucionales, Fontsource y lucide-react

- **Estado**: Aceptado (ratificado por el Arquitecto de Software, 2026-09-26)
- **Fecha**: 2026-09-23
- **Change de origen**: `sistema-diseno-frontend`
- **Sustituye**: el punto 1 de [ADR-006](ADR-006-maqueta-arquitectura-frontend.md) («sin librería de componentes»). Los puntos 2 a 6 de ADR-006 siguen vigentes.

## Contexto

El equipo entregó un sistema de diseño (`docs/fuentes/system-design-frontend.md`): niveles Atomic Design, colores institucionales Terracota/Tinta/Crema, tipografías Poppins e Inter, iconos `lucide-react` y componentes `Button`, `Badge`, `CardPieza`, `MainLayout`. La maqueta de `apps/web` usaba la paleta genérica `stone` de Tailwind, ~350 clases de color repetidas y 4 componentes planos. El documento está escrito para Tailwind 3 y con nombres en español; el proyecto usa Tailwind 4 y código en inglés (ADR-002).

## Decisión

1. **Componentes propios en tres niveles** dentro de `apps/web/src/components/`: `ui/` (átomos sin reglas del museo), `domain/` (moléculas con reglas del museo) y `layout/` (estructura). `ui/` no puede importar de `domain/`, `layout/` ni de los datos del dominio; lo verifica una prueba Vitest.
2. **Nombres de componentes y props en inglés** (`PieceCard`, `PieceSheet`, `ImportConflictModal`, `title`, `hasPhoto`…). Los nombres de los tokens de color se conservan como en el documento (`terracota`, `tinta`, `crema`…) porque nombran la identidad visual, no conceptos de dominio [pendiente de confirmación del Arquitecto].
3. **Tokens en `@theme` de `globals.css`** (Tailwind 4), con dos tokens añadidos (`ambar-texto`, `carmin-texto`) para que todo texto alcance contraste AA (≥ 4.5:1). Prohibidas las clases de paleta genérica y los hex en componentes; lo verifican pruebas.
4. **Fuentes autoalojadas con Fontsource** (`@fontsource-variable/inter`, `@fontsource/poppins` pesos 600 y 700), sin Google Fonts ni en build ni en ejecución (RNF-008). Contingencia: `next/font/local` con los mismos `.woff2`.
5. **`lucide-react` como única librería de iconos** (licencia ISC, un componente por icono). Contingencia: los iconos entran por las props `icon` de `Button`/`Badge`, así que cambiar de librería afecta pocos puntos.
6. **Pruebas de componentes sin jsdom**: `renderToStaticMarkup` de `react-dom/server` en el entorno `node` de Vitest; la lógica interactiva (menú móvil, decisión del modal) vive en funciones puras con prueba. Se reevaluará `jsdom` + Testing Library cuando lleguen formularios reales.

## Alternativas consideradas

- **shadcn/ui** (propuesto en ADR-003): trae Radix y su propio sistema de variables; más código generado del que necesita una maqueta y no calza directo con los tokens del documento. Se puede adoptar después sobre los mismos tokens.
- **`next/font/google`**: descarga las fuentes al compilar; falla en builds sin internet (VM o CI restringidos).
- **Nombres en español como en el documento**: contradice ADR-002.
- **`tailwind.config.js` como en el documento**: Tailwind 4 lo ignora salvo con `@config`, que es un modo de compatibilidad.

## Consecuencias

- Todas las pantallas nuevas del backlog deben usar estos componentes y tokens; las pruebas de paleta y arquitectura fallan si no.
- Cambiar un color institucional es editar un bloque de `globals.css`.
- Dos dependencias de runtime nuevas (`lucide-react`, Fontsource); peso de fuentes acotado a Inter variable y Poppins 600/700, con `font-display: swap`.
- Referencia de uso: [`docs/system-design.md`](../system-design.md).
