## 1. Fuente, decisiones y dependencias

- [x] 1.1 Versionar `SYSTEM_DESIGN.md` del equipo como `docs/fuentes/system-design-frontend.md` (sin cambios de contenido) y crear `docs/system-design.md` con la versión adaptada: Tailwind 4 `@theme`, nombres en inglés (tabla D2), tokens `ambar-texto`/`carmin-texto`, desviaciones de D4; ejemplos solo con datos sintéticos (Req: Sistema de diseño institucional con tokens y contraste accesible; RNF-004)
- [x] 1.2 Crear `docs/adr/ADR-012-sistema-diseno-frontend.md` (Propuesto): Atomic Design, tokens, Fontsource, `lucide-react`, pruebas sin jsdom; añadir a ADR-006 la nota «punto 1 sustituido por ADR-012» (Req: Biblioteca de componentes por niveles; RNF-004)
- [x] 1.3 Registrar en `docs/preguntas-contraparte.md` una sección J con: paleta oficial de la Dirección de Cultura [SUPUESTO] y logotipo autorizado; nombres de tokens en español o inglés (pregunta al Arquitecto) (Req: Sistema de diseño institucional con tokens y contraste accesible)
- [x] 1.4 Consultar versiones estables vigentes e instalar en `apps/web`: `lucide-react`, `@fontsource-variable/inter`, `@fontsource/poppins`; verificar `npm run lint:web` y `npm run build:web` sin acceso a Google Fonts (Req: Tipografía e iconos disponibles sin internet; RNF-008)

## 2. Tokens y tipografía

- [x] 2.1 Declarar en `apps/web/src/app/globals.css` el bloque `@theme` con los 16 colores y `--font-heading`/`--font-sans` con respaldo `system-ui`; fondo `bg-crema` y texto `text-tinta` en `body` (Req: Sistema de diseño institucional con tokens y contraste accesible)
- [x] 2.2 Importar Inter variable y Poppins 600/700 (subconjunto latin) en `app/layout.tsx`, exponer `--font-inter`/`--font-poppins`; aplicar `font-heading` en encabezados; medir peso total de fuentes en `next build` (objetivo < 150 KB) (Req: Tipografía e iconos disponibles sin internet; RNF-005)
- [x] 2.3 Crear `src/lib/design/contrast.ts` (función pura de contraste WCAG) y `src/lib/design/contrast-pairs.ts` (pares de uso de D3); prueba `design-tokens.test.ts` que parsea `globals.css`, verifica que existen los 16 tokens y que cada par ≥ 4.5, y que `ambar-alerta`/`ambar-bg` queda fuera de los pares de texto (Req: Sistema de diseño institucional con tokens y contraste accesible — escenario «Par de colores sin contraste suficiente»)
- [x] 2.4 Ampliar `vitest.config.ts` a `src/**/*.test.{ts,tsx}` y crear `src/test/render.ts` con helper sobre `renderToStaticMarkup`; prueba trivial que lo ejercita (Req: Biblioteca de componentes por niveles)

## 3. Átomos (`components/ui/`)

- [x] 3.1 Crear `lib/cn.ts` (unión de clases, función pura con prueba) y `ui/Button.tsx` con `variant` (`primary`, `secondary`, `outline`, `danger`), `size` (`md`, `lg`), `icon`, `className` al final, `min-h-11`, foco visible y `aria-label` obligatorio por tipo cuando no hay `children`; pruebas de las 4 variantes, `disabled` e icono `aria-hidden` (Req: Biblioteca de componentes por niveles — escenario «Botón reutilizado en una pantalla nueva»; RNF-010)
- [x] 3.2 Crear `ui/Badge.tsx` con `intent` (`success`, `info`, `warning`, `danger`, `default`), `icon` opcional, `text-sm` y colores de D3 (`ambar-texto`, `carmin-texto`); pruebas: clases por intent, intent desconocido → `default`, siempre hay texto visible (Req: Representación uniforme de estados de pieza — escenario «Estado desconocido»)
- [x] 3.3 Crear `ui/Card.tsx` (contenedor con `as`, borde `borde`, variante interactiva) y pruebas (Req: Biblioteca de componentes por niveles)
- [x] 3.4 Crear `ui/Input.tsx`, `ui/Select.tsx`, `ui/Textarea.tsx` con `label` visible asociado por `id`, `hint` y `error` en español (`aria-invalid`, `aria-describedby`); pruebas de asociación de etiqueta y mensaje de error (Req: Biblioteca de componentes por niveles; RNF-010)
- [x] 3.5 Prueba de arquitectura `components-architecture.test.ts`: falla si `components/ui/**` importa de `components/domain`, `components/layout`, `lib/fixtures`, `lib/data` o `lib/auth`, con mensaje en español (Req: Biblioteca de componentes por niveles — escenario «Átomo que importa lógica del museo»)

## 4. Estructura (`components/layout/`)

- [x] 4.1 Mover `NAV_ITEMS` a `layout/navigation.ts` con función pura `visibleNavItems(hasPermission)` e `isActive(pathname, href)`; pruebas por rol simulado (Req: Navegación principal con barra lateral responsive; RF-039)
- [x] 4.2 Crear `layout/Sidebar.tsx` (fondo `tinta`, texto `crema`, sección actual resaltada con `aria-current="page"`, iconos lucide por sección) y prueba de marcado (Req: Navegación principal con barra lateral responsive — escenario «Escritorio»)
- [x] 4.3 Crear `layout/MainLayout.tsx`: sin sesión devuelve `children`; con sesión, barra lateral en `md+`, botón «Menú» con texto en móvil que abre panel, cierre con Escape y al cambiar de ruta (lógica en reducer puro con prueba); encabezado con usuario · rol, «Cambiar de rol» y badge «Modo demostración»; mover `RequireSession` y `PermissionNotice` a `layout/` (Req: Navegación principal con barra lateral responsive — escenarios «Personal de depósito en móvil» y «Pantalla sin sesión»)
- [x] 4.4 Sustituir `AppShell` por `MainLayout` en `app/layout.tsx`; verificar manualmente a 360 px y en escritorio que no hay desplazamiento horizontal (Req: Navegación principal con barra lateral responsive; RNF-001)

## 5. Componentes de dominio (`components/domain/`)

- [x] 5.1 Crear `domain/status-intents.ts` (mapeos puros tenencia → intent, alerta → intent y texto, clasificación/decisión de importación → intent) y reescribir `TenureBadge`, `AlertBadge`, `LockBadge` (icono `Lock` de lucide, sin emoji) y `StatusBadge` sobre `Badge` en `domain/`; pruebas: comodato → `info`, préstamo temporal → `info`, sin foto → `warning`, conflicto → `danger`, valor no mapeado → `default` (Req: Representación uniforme de estados de pieza; RN-002, RN-003, RN-008)
- [x] 5.2 Mover `ConfirmButton` a `domain/` apoyado en `Button` (`tone` → `variant`) sin cambiar su comportamiento de confirmación y motivo; prueba de marcado y reexport temporal desde la ruta antigua (Req: Biblioteca de componentes por niveles — escenario «Acción irreversible con el botón de peligro»; RN-005, RNF-010)
- [x] 5.3 Crear `domain/PieceCard.tsx` (props de D2 a partir de `PieceSummary`, enlace a la ficha, código en `font-mono text-terracota`, «Sin foto» con icono) y pruebas: comodato, sin código I, sin foto, título largo truncado (Req: Representación uniforme de estados de pieza — escenarios «Pieza en comodato en búsqueda y ficha» y «Pieza sin foto»)
- [x] 5.4 Crear `domain/PieceSheet.tsx` extrayendo de `app/piezas/[id]/page.tsx` las secciones de datos, identificadores (con `LockBadge`), fotos y ubicación; prueba de marcado con una pieza sintética en comodato (Req: Representación uniforme de estados de pieza; RN-002, RN-003)
- [x] 5.5 Crear `domain/ImportConflictModal.tsx` (diálogo nativo, comparación valor actual/valor de la fila, decisiones aceptar/excluir/rechazar, botón «Cerrar» con `aria-label`) con la decisión en función pura; pruebas (Req: Representación uniforme de estados de pieza; Req: Tipografía e iconos disponibles sin internet — escenario «Botón solo con icono»)

## 6. Migración de pantallas

- [x] 6.1 Migrar `/` (acceso) y `/estado` a tokens y átomos; verificar sin clases genéricas con la función de 7.1 filtrada por archivo (Req: Sistema de diseño institucional con tokens y contraste accesible)
- [x] 6.2 Migrar `/inicio` y `/reportes` (tarjetas de KPI con `Card`, badges con `status-intents`) (Req: Representación uniforme de estados de pieza)
- [x] 6.3 Migrar `/busqueda` usando `PieceCard`, `Select`/`Input` y estado vacío con `Card` (Req: Representación uniforme de estados de pieza — escenario «Pieza en comodato en búsqueda y ficha»)
- [x] 6.4 Migrar `/piezas/[id]` (usa `PieceSheet`) y `/piezas/[id]/editar` (usa `Input`/`Select`/`Textarea` y `Button`, candado del código I intacto) (Req: Representación uniforme de estados de pieza; RN-002)
- [x] 6.5 Migrar `/importacion` usando `ImportConflictModal` para filas en conflicto y `ConfirmButton` para aprobar el lote, conservando el aviso de escritorio en móvil (Req: Biblioteca de componentes por niveles; RNF-001, RNF-010) — Nota de implementación: la maqueta nunca tuvo el aviso de «use escritorio» en móvil, así que no había nada que conservar; queda pendiente de decisión (spec base `plataforma`, escenario «Función de escritorio en móvil»).
- [x] 6.6 Migrar `/duplicados` e `/ia/sugerencias` (sugerencias siempre `warning` hasta revisión humana, RN-009) (Req: Representación uniforme de estados de pieza)
- [x] 6.7 Migrar `/administracion` y `/deposito` (acciones grandes con `Button size="lg"`) (Req: Navegación principal con barra lateral responsive; RNF-001)

## 7. Protecciones y cierre

- [x] 7.1 Crear `no-generic-palette.test.ts` (D8) que recorre `src/**/*.tsx` y falla con archivo, línea y token sugerido ante clases de paleta genérica o hex literales; activarlo sobre todo `src/` al terminar la sección 6 (Req: Sistema de diseño institucional con tokens y contraste accesible — escenario «Clase de paleta genérica en un componente»)
- [x] 7.2 Eliminar `components/AppShell.tsx`, `components/Badges.tsx`, `components/ConfirmButton.tsx`, `components/RequireSession.tsx` y los reexports temporales; `npm run lint:web` y `npm run build:web` en verde (Req: Biblioteca de componentes por niveles)
- [x] 7.3 Verificar sin internet: `next build` + `next start` con la red desconectada y comprobar en DevTools que no hay peticiones a dominios externos y que se ven Poppins, Inter e iconos (Req: Tipografía e iconos disponibles sin internet — escenario «Demo sin conexión»; RNF-008)
- [x] 7.4 Recorrer `docs/maqueta/recorrido-demo.md` en escritorio y a 360 px (sin desplazamiento horizontal, menú móvil con teclado); actualizar el guion si cambian nombres o ubicaciones de elementos (Req: Navegación principal con barra lateral responsive; RNF-001)
- [ ] 7.5 Tests requeridos: `npm test` y `npm run lint` en verde (sin cambios en API ni IA, por lo que no requiere verificación en PostgreSQL); OpenAPI y cliente tipado sin cambios: confirmar `npm run openapi:check` en verde
- [x] 7.6 Actualizar `apps/web/README.md` (estructura de componentes y cómo usar tokens) y añadir a `docs/manual-usuario/README.md` una nota sobre la nueva navegación (barra lateral y menú móvil)
- [ ] 7.7 `openspec validate sistema-diseno-frontend --strict` en verde y, tras aprobar el PR, `openspec archive sistema-diseno-frontend -y` (o `/opsx:archive sistema-diseno-frontend`), después de archivar `maqueta-ui-navegable`
