# Tasks — Ficha de piezas unificada (P1)

**Responsable:** Manuel · **Change:** `ficha-edicion-unificada` · **Rama:** `feat/ficha-edicion-unificada`  
**Alcance:** HU-12, HU-13, HU-15, HU-16, HU-17, HU-18 y HU-19; C3, C8, C9, C20 y C19 solo dentro de la ficha.  
**Entrega:** commits incrementales en una sola rama y un único Pull Request hacia `main`.

> **Regla de cierre:** marcar una tarea con `[x]` solo cuando el cambio esté realizado y verificado. Una HU solo se considera **«Revisada por un humano»** cuando alguien la completa sin manual, se aplican las correcciones encontradas y se repite la prueba. Usar únicamente datos sintéticos en desarrollo. En staging, solo lectura salvo autorización del equipo.

## 1. Preparación, límites y evidencia inicial

- [ ] 1.1 Confirmar `git status`, rama actual y referencia a `main`; revisar `CLAUDE.md`, sección 1 de `docs/historias-de-usuario.md`, `proposal.md`, ambos `spec.md` y `design.md`. Ejecutar `npx openspec list` y `npx openspec validate ficha-edicion-unificada --strict`. **No modificar funcionalidades fuera de este change.** (HU-12–19; C3/C8/C9/C20)
- [ ] 1.2 Revisar el estado actual de `apps/web/src/app/piezas/[id]/page.tsx`, `nueva/page.tsx`, `editar/page.tsx` y componentes reutilizables (`PieceSheet`, `PieceForm`, `PieceGallery`, `ConservationPanel`, `LivePieceActions`, `PieceActionDialogs`, `AuditTrailPanel`). Identificar pruebas existentes antes de extraer componentes. (HU-12–19; C9/C20)
- [ ] 1.3 Guardar capturas **antes** con datos sintéticos de alta, ficha en modo `mock`, ficha en modo `live` y edición; anotar qué partes son demasiado extensas, contienen textos internos o generan acciones confusas. Registrar el estado inicial y la cantidad de pasos de tareas frecuentes. (HU-12, HU-15; C3/C8/C9/C20)
- [ ] 1.4 Coordinar los límites de integración: **P3** es dueño de ubicación/historial; **P4**, de IA en la ficha; **P5**, del aviso de foto repetida; **Base**, de menú lateral y legibilidad global. Confirmar con el líder/JP el alcance de «un solo Guardar» antes de implementar guardado multi-recurso; si no hay confirmación, mantener el guardado real de datos generales claramente identificado. (HU-15; C3/C20)

## 2. Refactorización inicial de la ficha — primer commit

- [ ] 2.1 Extraer responsabilidades de la ruta de detalle hacia componentes pequeños (cabecera, composición y secciones), reutilizando los componentes existentes y evitando un segundo `PieceForm`, galería o panel de auditoría. Dejar la ruta principal centrada en `params`, sesión y selección de modo. **Sin cambios funcionales en este paso.** (HU-15–19; C9/C20)
- [ ] 2.2 Definir interfaces/puntos de integración estables para ubicación (P3), IA (P4) y aviso de foto repetida (P5), sin implementar sus comportamientos ni editar el menú lateral. Coordinar nombres y props antes de que otras ramas modifiquen la ficha. (HU-15–17; C20)
- [ ] 2.3 Ejecutar lint, typecheck y pruebas existentes del frontend; comprobar que la ficha sigue abriendo en `mock` y `live`, que los permisos se respetan y que las acciones funcionan como antes. Registrar el commit de refactorización separado de las mejoras visuales. (HU-12–19; C9/C20)

## 3. Organización visual, consulta y lectura — segundo commit

- [ ] 3.1 Unificar el orden, títulos y navegación de secciones entre `mock` y `live` (datos generales, identificadores, fotografías, conservación, datos de origen y auditoría según disponibilidad/permisos), evitando que `live` muestre fixtures o acciones de demostración. Reservar la integración de ubicación e IA para sus responsables. Comprobar que cambiar de sección no descarta datos escritos sin guardar. (HU-15–17; C8/C9/C20)
- [ ] 3.2 Mostrar datos de origen en **solo lectura** usando el endpoint existente `/api/v1/pieces/{piece_id}/source-records`, con estados claros de carga, vacío, error y acceso no autorizado; no inventar valores ni mostrar JSON crudo como vista principal. (HU-15; C20; RN-005/RN-008)
- [ ] 3.3 Reutilizar `AuditTrailPanel` y la consulta de auditoría existente dentro de la ficha conectada, condicionado al permiso correspondiente; no exponer registros a usuarios sin autorización. (HU-15; C20; RN-005/RN-008)
- [ ] 3.4 Retirar de las pantallas de P1 los textos para desarrolladores (por ejemplo, referencias visibles a `RN-002` o avisos sobre APIs pendientes), sustituyéndolos por lenguaje comprensible y sin alterar las reglas de negocio. (HU-15, HU-18; C8/C19)
- [ ] 3.5 Agregar o adaptar pruebas para la estructura común `mock`/`live`, secciones ausentes, datos de origen, auditoría, permisos y ausencia de textos internos. Registrar el commit de consulta y organización. (HU-15–17; C8/C9/C20)

## 4. Registro y edición — tercer commit

- [ ] 4.1 Simplificar el alta con `PieceForm`: mostrar primero los campos esenciales, agrupar progresivamente los adicionales, hacer evidentes los obligatorios y conservar validaciones, borradores y mensajes de error claros. No asumir como confirmada una preferencia no validada por el museo. (HU-12; C3/C20; RF-006/RNF-010)
- [ ] 4.2 Revisar «Guardar y registrar otra» y «Registrar a partir de esta pieza»: mostrar qué información se reutiliza para revisión; no trasladar identificadores, fotografías, conservación ni movimientos a la nueva pieza. (HU-13; RF-043)
- [ ] 4.3 Mejorar la edición para que «Guardar» tenga un alcance explícito sobre los **datos generales**; conservar `updatePiece`, validación, borradores, versión/`If-Match` y manejo de conflictos. Mantener separadas y claramente rotuladas las operaciones de fotografías, identificadores y conservación mientras no exista decisión y contrato de guardado conjunto. (HU-15; C3/C20)
- [ ] 4.4 Añadir pruebas para campos obligatorios, alta, registros consecutivos, datos reutilizados, borrador, errores de validación, guardado general y conflicto de edición. Registrar el commit de alta y edición. (HU-12, HU-13, HU-15; RF-006/RF-043)

## 5. Identificadores, fotografías, conservación y acciones sensibles — cuarto commit

- [ ] 5.1 Resolver nombres visibles de tipos de identificador desde `GET /api/v1/identifier-types` cuando esté disponible; reutilizar la utilidad existente o crear una compartida con respaldo para `I`, `COLECCION`, `INC_RN`, `PUCP`, `PROPIETARIO` y `OTRO`. Aplicarla en la ficha y diálogos de P1; preservar los códigos almacenados y no inventar nombres para tipos desconocidos. (HU-18; C19; RN-010)
- [ ] 5.2 Revisar que el código I vigente no aparezca como edición ordinaria y que la corrección auditada solo esté disponible con `identifiers.correct_inventory_code`, motivo obligatorio y confirmación comprensible. Mantener la autorización del backend. (HU-18; RN-002/RN-005)
- [ ] 5.3 Reorganizar la presentación de fotografías y conservación mediante `PieceGallery` y los componentes existentes: varias vistas fotográficas, evaluaciones e historial, estados vacíos y etiquetas claras. No implementar la detección de repetidos (C6, P5). (HU-16, HU-17; C20)
- [ ] 5.4 Revisar los diálogos de baja lógica y restauración: explicar que la información **no se elimina físicamente**, mantener motivos, confirmación, permisos y registro de auditoría; mostrar errores recuperables con una acción comprensible. (HU-19; RN-005)
- [ ] 5.5 Ampliar pruebas de nombres de identificadores (API, respaldo y tipo desconocido), permisos y corrección del código I, fotografías, conservación, baja y restauración. Registrar el commit correspondiente. (HU-16–19; C19/C20)

## 6. Prueba humana, regresión y cierre — commit final y PR único

- [ ] 6.1 Preparar un entorno local con **datos sintéticos**. Pedir a otra persona que realice **sin manual** los guiones de HU-12, 13, 15, 16, 17, 18 y 19 de `historias-de-usuario.md`, pensando en alguien que no conoce el sistema. Registrar clics, tareas completadas, dudas, errores y frases confusas; incluir prueba con teclado y zoom al 150 %, y en 1366×768 cuando sea posible. **No declarar «Revisada por un humano» antes de esta prueba.**
- [ ] 6.2 Corregir las dificultades observadas y repetir las tareas afectadas con la persona que prueba. Completar la lista de comprobación de la sección 1 del documento de historias, indicando qué no se pudo cumplir y por qué. Avisar al equipo si surge un cambio grande o fuera del alcance P1.
- [ ] 6.3 Guardar capturas **después** y evidencia por HU (resultado de la prueba humana, ajustes hechos y pendientes reales). Actualizar manual o documentación de uso de la ficha si cambian los pasos visibles; no afirmar que el museo validó supuestos aún no confirmados.
- [ ] 6.4 Ejecutar desde la raíz los controles aplicables: `npm ci` si faltan dependencias (nunca `npm install` para esta tarea), `npm run lint:web`, `npm run test:web`, `npm run validate:specs`, y desde `apps/web` `npm run typecheck`; si se dispone del entorno completo, ejecutar también `npm test` y documentar cualquier bloqueo. Ejecutar `npx openspec validate ficha-edicion-unificada --strict` y dejar todas las pruebas pertinentes en verde.
- [ ] 6.5 Revisar `git diff`, `git status` y los archivos del commit: **sin `.env`, claves, credenciales, datos reales ni cambios ajenos**. Publicar varios commits organizados en la rama `feat/ficha-edicion-unificada` y abrir **un solo PR** con change, IDs HU/C, pruebas, capturas y decisiones pendientes. Solicitar revisión de otro integrante; **no archivar OpenSpec hasta aprobar y fusionar el PR**.

## Criterios de finalización

- Se mantiene la integridad del catálogo, la autorización por rol, el código I protegido y la baja lógica (RN-001/002/003/005/008/010).
- La interfaz distingue claramente la consulta, edición de datos generales y acciones sobre otros recursos; ningún texto promete una transacción conjunta no implementada.
- La ficha real no inventa datos ni expone información restringida; los cambios no invaden P3, P4, P5 o Base.
- Las verificaciones automáticas y **humanas** respaldan el avance real; la evidencia está en el PR.
