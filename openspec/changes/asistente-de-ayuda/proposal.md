## Why

Parte del personal del museo tiene poca práctica con sistemas digitales. Aun con un Inicio que guíe por tareas, habrá momentos en que alguien esté dentro de una pantalla y no sepa cómo seguir («¿cómo cargo las fotos?», «¿dónde muevo una pieza?»). Hoy la única ayuda es el manual de usuario, que está fuera del sistema, y los textos explicativos que se acumulan dentro de cada pantalla —justo lo que la auditoría mostró como exceso de texto—.

Se pidió un asistente fijo en una esquina que le diga a la persona **exactamente adónde ir** para cada tarea. Este change construye la primera etapa, **sin inteligencia artificial**: un catálogo de tareas comunes que guía y lleva a la pantalla correcta. No es el asistente de consulta sobre el catálogo (RIA-05), que sigue desactivado y pendiente de priorización.

## What Changes

- **Botón fijo «¿Necesita ayuda?»** en la esquina inferior derecha de las pantallas autenticadas, con la etiqueta siempre visible y un tamaño táctil grande. No aparece en el acceso ni al imprimir.
- **Panel de ayuda** con las tareas más comunes, en palabras de la persona («Quiero buscar una pieza», «Quiero registrar una pieza nueva», «Quiero mover una pieza», «Quiero cargar un Excel o fotos», «Quiero sacar un reporte», «Quiero revisar lo pendiente»). Solo se listan las tareas que el rol puede hacer.
- **«Llévame»**: cada tarea lleva a la pantalla correcta y **resalta el botón o campo** por donde empezar, con una indicación de una línea. El resaltado respeta la preferencia de movimiento reducido.
- **Un cuadro de búsqueda** dentro del panel que filtra las tareas por palabras («foto», «mover», «código», «reporte») sin distinguir tildes ni mayúsculas.
- **Todo ocurre en el navegador**: el catálogo de tareas es una tabla del propio sistema. No se envía ninguna pregunta ni dato a servicios externos, no se leen datos del catálogo y no se guarda nada.
- **Usable con teclado y lector de pantalla**: se abre y se cierra con Escape, el foco entra y vuelve al botón, y el resaltado se anuncia.
- El catálogo de tareas es **el mismo** que usan el Inicio y el menú (`inicio-guia-de-tareas`), para que los nombres no se desfasen.

## Capabilities

### New Capabilities

- `ayuda-guiada`: botón de ayuda fijo, panel de tareas por rol, «Llévame» con resaltado y búsqueda de tareas, sin envío de datos a terceros.

### Modified Capabilities

## Impact

- **IDs cubiertos**: RNF-010, RF-039, RNF-001, RNF-014.
- **Célula dueña**: Consulta y control (con apoyo de UX). **Depende de**: `inicio-guia-de-tareas` (la tabla de tareas y los nombres), de preferencia aplicado antes; no bloquea nada.
- Solo frontend (`apps/web`) y manual. **Sin cambios de API, contrato, base de datos ni dependencias nuevas.**
- Archivos probablemente afectados: componente nuevo `components/layout/HelpAssistant.tsx` montado desde `MainLayout.tsx`, `lib/help/tasks.ts` (compartida) y un pequeño módulo de resaltado; pruebas de los tres.
- Se conservan: permisos por rol, direcciones actuales y la estructura de pantallas.

## Fuera del change

- **Un asistente con IA que responda preguntas** (etapa 2). Si el museo lo valora, requiere un ADR, la política de datos pendiente (B12) y que responda solo con el manual de usuario, sin datos del catálogo. No se implementa ni se prepara código para ello.
- El asistente de consulta sobre el catálogo (RIA-05, desactivado en fase 1).
- Que el asistente ejecute acciones (registrar, mover, borrar): solo lleva y señala.
- Un recorrido guiado paso a paso de varias pantallas.
- Buscar dentro del texto del manual de usuario (queda como mejora posible).
- Telemetría de uso del asistente.
