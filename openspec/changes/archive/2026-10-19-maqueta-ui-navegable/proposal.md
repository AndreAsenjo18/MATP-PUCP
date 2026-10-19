## Why

Gabriela y Claudio (contraparte MATP) necesitan validar el alcance y los flujos del sistema antes de que exista una API completa: sin un prototipo clicable, la próxima reunión de validación (S7/S8) se quedaría en diapositivas y no permitiría contrastar con datos reales del "caos de codificación" (códigos sucios, comodato, duplicados, sugerencias de IA). Este change entrega las 11 pantallas del MVP navegables en `apps/web`, funcionando **sin backend** con datos sintéticos tipados según el contrato OpenAPI ya exportado (`contratos-api-borrador`), para poder demostrar y recoger feedback ya mismo, y sin bloquear a las células que sigan implementando los endpoints reales.

## What Changes

- Modo de datos conmutable en `apps/web` mediante `NEXT_PUBLIC_API_MODE` (`mock` por defecto en desarrollo local de la maqueta, `live` para apuntar a la API real cuando exista): una capa de acceso a datos única que sirve fixtures tipados (`schema.d.ts`) en modo mock y usa el cliente `client.ts` (openapi-fetch) en modo live, sin que las pantallas conozcan la diferencia.
- Fixtures sintéticos coherentes con el dominio (piezas con códigos sucios y sin normalizar, ~50 % sin código I, piezas en comodato, duplicados probables, épocas en texto libre, lote de importación con filas clasificadas, sugerencias de IA pendientes, auditoría de ejemplo) que **no dependen del seed real de `apps/api`** para poder ejecutarse sin Python ni base de datos.
- Las 11 pantallas navegables: login con selector de rol simulado, tablero de KPIs, búsqueda con filtros combinados, ficha de pieza con 7 pestañas, editor de pieza con validación en tiempo real, asistente de importación en pasos, cola de duplicados, revisión de sugerencias de IA, reportes con exportación, administración (usuarios/roles/vocabularios/tipos de identificador/ubicaciones) y vista móvil de depósito.
- Componentes y confirmaciones que expresan las reglas de negocio en la interfaz: candado visual e imposibilidad de editar el código I; badge de "Comodato" con advertencia de que nunca recibe I; toda acción destructiva se presenta como "marcar como..."/"fusionar"/"rechazar" con diálogo de confirmación (nunca "eliminar" definitivo); estado de sugerencias de IA con aprobar/editar/rechazar antes de cualquier persistencia.
- `docs/maqueta/recorrido-demo.md`: guion de ~10 minutos para la reunión con la contraparte, con las preguntas a validar en cada pantalla (referencia cruzada a `docs/preguntas-contraparte.md`, sin duplicar preguntas ya registradas).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `plataforma`: se añade el requirement "Prototipo navegable en modo simulado (mock)" (RNF-002, RNF-008, RNF-010, RNF-001): la interfaz web MUST poder ejecutarse y demostrarse completa sin backend ni base de datos, con datos sintéticos que expresan las reglas de negocio (RN-001..RN-010) sin persistirlas.

## Impact

- **IDs cubiertos**: RNF-002, RNF-008, RNF-010, RNF-001 (principal, requirement nuevo de `plataforma`); expresión en UI (sin cambio de contrato) de RF-001..RF-044, RIA-01..RIA-05 y RN-001..RN-010 relevantes a cada pantalla — ver detalle de cobertura por pantalla en `design.md`.
- **Célula dueña**: Frontend / Maqueta, con insumos del contrato ya fijado por `contratos-api-borrador` (tipos `schema.d.ts`, cliente `client.ts`).
- **Depende de**: `setup-monorepo-base` (apps/web), `contratos-api-borrador` (tipos y cliente tipado). **Habilita**: la validación de alcance con la contraparte (S7/S8) y sirve de referencia de UI para los changes de backlog de Fase 7.
- **Afecta**: `apps/web/src/app/**` (rutas por pantalla), `apps/web/src/lib/data/` (capa de acceso a datos mock/live nueva), `apps/web/src/lib/fixtures/` (datos sintéticos nuevos), `apps/web/src/components/**`, `apps/web/.env.example` o `.env.local.example` (`NEXT_PUBLIC_API_MODE`), `docs/maqueta/recorrido-demo.md` (nuevo), posible ADR nuevo sobre librería de componentes/manejo de estado del frontend.
- **Dependencias nuevas**: solo si se decide una librería de componentes UI (p. ej. shadcn/ui, sugerida en `setup-monorepo-base`) o manejo de formularios (React Hook Form + Zod, ya sugeridos); versión estable vigente a consultar al instalar. Contingencia: componentes propios con Tailwind si la instalación falla.
- **Fuera de este change**: integración real contra `apps/api` (se preparó `lib/data/pieces.ts`, tipado contra el contrato real, pero ninguna pantalla lo consume todavía ni se probó contra Postgres, igual que en Fases 3-5, por el daemon de Docker caído — ver design.md D4), autenticación real (JWT), persistencia de cualquier acción realizada en modo mock, subida real de archivos, cálculo real de duplicados/KPI (se simulan con fixtures), pulido visual fino (prioridad: navegabilidad funcional).
