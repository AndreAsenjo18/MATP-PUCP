# ADR-006 — Arquitectura de la maqueta navegable: modo mock, sesión simulada y store en memoria

- **Estado**: Propuesto (a ratificar por el Arquitecto de Software)
- **Fecha**: 2026-09-17
- **Change de origen**: `maqueta-ui-navegable`

## Contexto

La Fase 6 exige 11 pantallas navegables **sin backend**, con datos sintéticos, para validar alcance y flujos con Gabriela y Claudio antes de que exista una API completa. `setup-monorepo-base` (ADR-001/003) había sugerido, como propuestas técnicas todavía no comprometidas, Tailwind + shadcn/ui, TanStack Query, React Hook Form + Zod para el frontend. Al construir la maqueta, ninguna de esas librerías resultó necesaria para el objetivo de esta fase (navegabilidad con datos en memoria, sin peticiones de red reales), así que este ADR documenta qué se usó en su lugar y por qué, sin descartarlas para cuando el frontend consuma la API real.

## Decisión

1. **Sin librería de componentes ni de formularios todavía.** Tailwind 4 (ya instalado) + componentes propios pequeños (`ConfirmButton`, `Badges`, `AppShell`) y el elemento nativo `<dialog>` para confirmaciones. Los dos formularios con validación (login, editor de pieza) usan `useState` simple; no se instaló React Hook Form + Zod porque, con dos formularios cortos y sin pantallas adicionales previstas en esta fase, habría sido una dependencia nueva sin beneficio claro todavía.
2. **Sin TanStack Query ni ninguna librería de *fetching*.** En modo mock no hay red: los datos son constantes de `lib/fixtures/` importadas directamente (sin caché, sin *stale time*, sin *loading state*). El único punto que sí llama a una API real (fuera de esta fase) es `lib/api/client.ts`, ya generado por `contratos-api-borrador`; cuando una pantalla necesite datos en vivo con caché/revalidación, se evaluará TanStack Query en ese momento.
3. **Sesión simulada en `localStorage`**, leída con `useSyncExternalStore` (no con `useEffect` + `setState`, que el linter del proyecto — `react-hooks/set-state-in-effect`, parte de `eslint-config-next` — marca como error). No es autenticación real: no hay contraseña, no hay servidor, y se declara así en la propia pantalla de login. `autenticacion-y-matriz-permisos` la reemplaza.
4. **Estado mutable de la demo en un único `useReducer`** (`lib/data/mock-store.tsx`, con `React.Context`), no en Zustand/Redux ni en `localStorage`: las mutaciones (aprobar IA, fusionar duplicado, decidir fila, editar pieza, registrar movimiento, corregir código I) son intencionalmente efímeras (se pierden al recargar) para no simular una fuente de verdad que no existe; un solo store evita que dos pantallas (p. ej. Ficha y Sugerencias IA) muestren estados de la misma sugerencia desincronizados entre sí.
5. **`NEXT_PUBLIC_API_MODE`** (`mock` por defecto, `live` para apuntar a la API real) como *build arg* de Next.js, no como variable de runtime: las variables `NEXT_PUBLIC_*` se incrustan en el bundle del navegador al compilar (limitación de Next.js, no una elección de este ADR).
6. **Enmascarado de campos sensibles en el cliente** (`lib/data/masking.ts`), replicando en la maqueta la misma regla que ya implementa la API (`contratos-api-borrador`, ADR-005) para poder demostrar RF-041 sin backend. Cuando la pantalla consuma la API real, esta función deja de ser necesaria (el enmascarado ya viene aplicado en la respuesta) pero no estorba: es idempotente sobre datos ya enmascarados.

## Alternativas consideradas

- **Zustand o Redux Toolkit para el store de la demo**: una dependencia más para un store pequeño (7 tipos de acción); `useReducer` + Context alcanza y no compromete una elección de manejo de estado para cuando exista la API real.
- **React Hook Form + Zod desde ahora**: se pospone hasta que haya más formularios o validaciones cruzadas complejas; los dos formularios actuales no lo justifican.
- **`useEffect` + `useState` para leer `localStorage`** (el patrón más común): se probó primero y causó una corrida de datos real (una redirección incorrecta a `/inicio` al navegar directamente a una pantalla protegida, por una carrera entre el efecto de `RequireSession` y la sincronización de `useSyncExternalStore`); se corrigió leyendo `localStorage` de forma directa y síncrona dentro del efecto de redirección (ver `apps/web/src/components/RequireSession.tsx`), documentado también en `design.md` del change.
- **Un store por pantalla (sin compartir estado)**: más simple de entender pantalla por pantalla, pero rompe la coherencia entre Ficha ↔ Sugerencias IA y Ficha ↔ Duplicados que la demo necesita mostrar.

## Consecuencias

- Ninguna pantalla de esta fase es un Server Component puro (todas dependen, directa o indirectamente, del `SessionProvider`/`MockStoreProvider` del layout raíz, que son de cliente); aceptable con 14 piezas sintéticas, a revisar si el volumen de datos crece mucho antes de conectar la API real.
- Cuando lleguen más pantallas con formularios grandes (p. ej. el editor completo de identificadores o el mapeo de importación editable), se debe reabrir la decisión de React Hook Form + Zod en un ADR propio o una nota de actualización de este.
- Se preparó `apps/web/src/lib/data/pieces.ts` (`fetchPieces`, `fetchPieceDetail`), tipado contra el contrato real y con pruebas de su rama mock, para las **únicas** lecturas de piezas que `contratos-api-borrador` implementó de verdad (listado con `q` y ficha por id). **Ninguna pantalla lo consume todavía**: `app/busqueda` y `app/piezas/[id]` siguen leyendo `lib/fixtures` de forma directa (ver `design.md`, decisión D4) porque ya están verificadas en modo mock y conectarlas exige poder probarlas contra una API real con PostgreSQL (Docker no disponible en esta máquina). Es un pendiente explícito, no una limitación oculta. Cuando se conecten, las demás pantallas en modo `live` deben mostrar "función no disponible" en vez de simular datos silenciosamente (ver spec `plataforma`, requirement "Prototipo navegable en modo simulado").
