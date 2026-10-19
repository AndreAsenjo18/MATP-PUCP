## Why

El equipo definió un sistema de diseño para el frontend (`SYSTEM_DESIGN.md`: Atomic Design, colores institucionales Terracota/Tinta/Crema, tipografías Poppins e Inter, iconos `lucide-react`, componentes `Button`, `Badge`, `CardPieza`, `MainLayout`), pero la maqueta de `apps/web` se construyó antes con la paleta genérica `stone` de Tailwind, sin tokens, sin componentes base y con ~350 clases de color y 28 botones repetidos a mano en 11 pantallas. Conviene adoptarlo **ahora**, antes de que los changes del backlog (`ficha-pieza-crud`, `fotografias-multiples-por-pieza`, `importacion-pipeline-reconciliacion`, `busqueda-avanzada-y-exportacion`…) construyan pantallas reales sobre la base actual y multipliquen el costo de migrar.

## What Changes

- Versionar el documento del equipo como fuente en `docs/fuentes/system-design-frontend.md` y adaptarlo a las decisiones de este change (Tailwind 4, nombres en inglés, contraste AA).
- Declarar los **tokens institucionales** (colores y tipografías) en un único lugar: bloque `@theme` de `apps/web/src/app/globals.css` (Tailwind 4 ya no usa `tailwind.config.js`). Se agregan dos tokens de texto oscuro (`ambar-texto`, `carmin-texto`) porque el ámbar y el carmín del documento no alcanzan contraste AA sobre sus fondos.
- Organizar `apps/web/src/components/` en tres niveles: `ui/` (átomos sin negocio), `domain/` (moléculas con reglas del museo) y `layout/` (estructura de pantalla). Las pantallas siguen en `src/app/` (App Router).
- Crear los componentes, **con nombres y props en inglés** (ADR-002, decisión del equipo):
  - `ui/`: `Button`, `Badge`, `Card`, `Input` (con `Select` y `Textarea` del mismo estilo).
  - `layout/`: `Sidebar`, `MainLayout` (reemplaza a `AppShell`), con menú desplegable en móvil.
  - `domain/`: `PieceCard` (antes `CardPieza`), `PieceSheet` (antes `FichaPieza`), `ImportConflictModal` (antes `ModalImportacion`), y `TenureBadge`, `AlertBadge`, `LockBadge`, `StatusBadge` reescritos sobre `Badge`.
- Cargar Poppins e Inter **autoalojadas** (sin depender de Google Fonts en ejecución ni en build) e incorporar `lucide-react` como única librería de iconos (reemplaza el emoji 🔒).
- Migrar las 11 pantallas de la maqueta (y la de estado de servicios) a los tokens y componentes, sin cambiar flujos, textos ni reglas de negocio ya expresadas por `maqueta-ui-navegable`.
- Pruebas automáticas que protegen el sistema: contraste de los pares de tokens, prohibición de clases de paleta genérica (`stone-*`, `red-*`…) y de hex sueltos en componentes, dirección de dependencias entre niveles y renderizado de los componentes.
- ADR-012 (Propuesto): sistema de diseño y librerías de UI; **sustituye el punto 1 de ADR-006** («sin librería de componentes»).
- No hay cambios **BREAKING** de API ni de datos. Sí cambia la apariencia de toda la maqueta y se elimina `components/AppShell.tsx` (sustituido por `layout/MainLayout.tsx`).

## Capabilities

### New Capabilities
<!-- Ninguna: el sistema de diseño es un atributo transversal de la interfaz y se ubica en `plataforma`. -->

### Modified Capabilities
- `plataforma`: se **agregan** (solo `ADDED`, según ADR-010) requirements de sistema de diseño institucional con tokens y contraste accesible, biblioteca de componentes por niveles, representación uniforme de estados de pieza, navegación principal responsive con barra lateral y recursos tipográficos/iconográficos disponibles sin internet. Los requirements vigentes (`Interfaz responsive`, `Usabilidad para baja alfabetización digital`, `Prototipo navegable en modo simulado`) no se modifican; este change los refuerza.

## Impact

- **Requisitos cubiertos**: RNF-001 (responsive), RNF-004 (mantenible y documentado para terceros), RNF-008 (sin dependencias externas en ejecución), RNF-010 (usabilidad con baja alfabetización digital). Refuerza la expresión visual de RN-002 (candado del código I), RN-003/RN-008 (comodato) y RN-009 (sugerencias IA pendientes), sin cambiar su lógica.
- **Célula dueña (propuesta, a validar por el Líder de Proyecto)**: Consulta y control (frontend), con Yessica Ochante (Analista UX) como revisora de specs y José Ávalos (Integrador) como revisor de PR. El Arquitecto ratifica ADR-012.
- **Depende de**: `maqueta-ui-navegable` (implementado, pendiente de archivar). No depende de ningún change del backlog.
- **Coordinación**: todos los changes del backlog que tocan pantallas deben usar estos componentes; se recomienda mergear este change antes de que empiecen su frontend. Mientras tanto, los conflictos se resuelven en favor de los componentes nuevos.
- **Código afectado**: `apps/web/src/app/**` (12 rutas), `apps/web/src/components/**`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/package.json`, `apps/web/vitest.config.ts`. Sin cambios en `apps/api`, `services/ai`, OpenAPI ni cliente tipado.
- **Dependencias nuevas**: `lucide-react` (iconos) y paquetes de Fontsource para Poppins e Inter (fuentes autoalojadas). Justificación y contingencia en `design.md`.
- **Documentación**: `docs/fuentes/system-design-frontend.md`, `docs/adr/ADR-012-sistema-diseno-frontend.md`, nota en ADR-006, `apps/web/README.md` y `docs/maqueta/recorrido-demo.md` (capturas y nombres de pantallas si cambian).

### Fuera del alcance
- Nuevas pantallas, flujos o funcionalidades: solo cambia la presentación de las existentes.
- Conectar pantallas a la API real, TanStack Query, React Hook Form/Zod (siguen según ADR-006).
- Modo oscuro, internacionalización y un catálogo visual tipo Storybook (posibles changes futuros).
- Logotipo o marca oficial del museo/PUCP: no se usa ningún recurso gráfico institucional hasta que la contraparte lo entregue y autorice.
- Validación de los colores con la Dirección de Cultura: los valores vienen del documento del equipo; los dos tokens de texto oscuro son una decisión de accesibilidad de este change.
