## Why

El sistema funciona, pero la interfaz se percibe como una plantilla genérica y poco cercana para el personal del museo, parte del cual tiene 60 años o más. Antes de cambiar todas las pantallas se prueba una renovación visual en una sola, el Inicio, para decidir con el resultado a la vista.

## What Changes

- El Inicio (`/inicio`) recibe una identidad cálida y artesanal sobre la paleta crema y terracota vigente: jerarquía entre tareas, iconos en círculos de color por tipo de tarea, nombre del museo, motivo textil propio en SVG, título con tipografía con carácter y resumen del catálogo en fichas en lenguaje llano.
- Se añaden tokens reutilizables (color por tipo de tarea, tipografía de título, espaciado, radios y sombras) en `apps/web/src/app/globals.css`, y componentes reutilizables.
- Se documenta en `docs/guia-visual.md`.
- No cambia el menú lateral, el encabezado ni ninguna otra pantalla. No cambia la API ni los datos.

## Impact

- Frontend: `apps/web/src/app/inicio/page.tsx`, `components/domain/HomeGuide.tsx`, componentes nuevos en `components/ui/` y `components/brand/`, `globals.css`, `lib/help/tasks.ts`.
- Dependencia nueva autoalojada: `@fontsource-variable/fraunces`.
- Requisitos: RNF-010 (usabilidad), RNF-001 (responsive), RNF-008 (sin servicios externos).
