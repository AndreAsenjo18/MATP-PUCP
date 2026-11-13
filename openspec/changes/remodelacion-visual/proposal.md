## Why

La interfaz funciona, pero se ve como una plantilla genérica y no está pensada para el personal del museo, parte del cual tiene 60 años o más y usa el zoom del navegador. Hay letra de 14 px y botones de 32 a 36 px en varias pantallas, una franja superior que repite datos y un piloto visual que solo cambió el Inicio. El equipo eligió una dirección única, «B · Cabecera audaz», para todo el sistema.

## What Changes

- **Identidad visual «Cabecera audaz» en todas las pantallas:** cabeceras terracota en las pantallas principales y encabezado compacto en las de trabajo, títulos en Manrope 800 autoalojada, formas muy redondeadas, bordes arena, sombras suaves y una trama de rombos propia como acento.
- **Estructura:** menú lateral flotante y oscuro, con la cuenta de la persona y «Cerrar sesión» al pie, y sin franja superior. Bajo 1024 px se abre con un botón «Menú» y atrapa el foco.
- **Menú con nombres de tarea:** Inicio, Buscar, Cargar datos, Revisar pendientes, Reportes y Administración. «Revisar pendientes» reemplaza a «Duplicados» y «Sugerencias IA» y lleva a la bandeja `/pendientes`, como pide `revisar-pendientes-unificado`.
- **Mínimos en toda la interfaz:** letra de 16 px o más y controles de 44 px o más. Diseño fluido del 50 % al 300 % de zoom, con contenido centrado y ancho máximo.
- **BREAKING (visual):** desaparece la franja superior; el cierre de sesión pasa al pie del menú en todos los anchos; el botón compacto de 32 px deja de existir.
- **Reemplaza el piloto** `piloto-identidad-visual-inicio`, que no llegó a `main`: se retira Fraunces, la cenefa y su change.
- Solo diseño. No cambian la lógica, las rutas, los pasos de los flujos, el orden de las tareas ni los textos, salvo los nombres del menú y el Inicio, ya decididos.

## Capabilities

### New Capabilities

### Modified Capabilities

- `plataforma`: se modifican la navegación principal, la barra retraíble, la tipografía, los tokens, los botones adaptables y los controles de Administración; se retira el cierre de sesión en el encabezado; se añaden la cuenta al pie del menú, la identidad «Cabecera audaz» y el diseño fluido con el zoom.

## Impact

- Frontend (`apps/web`): `app/globals.css`, `app/layout.tsx`, `components/ui/*`, `components/layout/*`, `components/brand/*` y, por grupos, las pantallas y sus componentes de `components/domain/`.
- Dependencias: se añade `@fontsource-variable/manrope`; se retiran `@fontsource/poppins` y `@fontsource-variable/fraunces`.
- Sin cambios de API, contrato, base de datos ni migraciones.
- Coordinación: `inicio-guia-de-tareas` también modifica la navegación principal y propone «Buscar piezas» y «Configuración»; hay que alinear los nombres antes de archivar cualquiera de los dos.
- Requisitos: RNF-001 (responsive), RNF-008 (sin servicios externos), RNF-010 (baja alfabetización digital), RF-039 (visibilidad por rol).
