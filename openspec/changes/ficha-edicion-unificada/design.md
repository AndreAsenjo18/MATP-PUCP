# Design — Ficha de piezas unificada (P1)

## Context

El paquete **P1 · Ficha** corresponde a Manuel y cubre **HU-12, HU-13, HU-15, HU-16, HU-17, HU-18 y HU-19**, especialmente **C3, C8, C9 y C20**, más los textos de **C19** que aparecen dentro de la ficha. La ficha es de uso interno por personal del museo; algunas necesidades de usuarios aún son supuestos por validar. Se prioriza que una persona pueda entender qué ve, qué puede modificar y qué se guardará sin necesitar un manual.

Código revisado para este diseño:

- `apps/web/src/app/piezas/[id]/page.tsx` concentra carga, sesión, acciones, secciones y flujos **mock/live**. En la maqueta usa pestañas y en modo conectado muestra bloques apilados. En modo conectado contiene el aviso interno «Ubicación, datos de origen y auditoría de esta ficha se conectan a la API en sus changes».
- `apps/web/src/app/piezas/nueva/page.tsx` y `apps/web/src/app/piezas/[id]/editar/page.tsx` comparten `PieceForm` (`react-hook-form` y `zod`); ya incorporan validación, guardado de borradores, manejo de conflictos y registro consecutivo.
- Existen componentes reutilizables: `PieceSheet`, `PieceGallery`, `ConservationPanel`, `LivePieceActions`, `PieceActionDialogs`, `AuditTrailPanel`, `PieceAlertsPanel` y `PieceDeletedNotice`. No se deben duplicar.
- El cliente tipado incluye `GET /api/v1/pieces/{piece_id}/source-records`; `lib/data/audit.ts` ya expone `fetchPieceAuditTrail`. La tabla `PieceIdentifiersTable` usa `identifierTypeLabel`, que no abarca necesariamente todos los códigos parametrizados de la base real.
- La lista maestra deja **pendiente de validación con la JP** la interpretación de «un solo Guardar» para toda la ficha (C3). Por ello, este diseño no presupone una operación atómica que involucre identificadores, fotos, movimientos y conservación.

Reglas conservadas: **RN-001** (UUID interno, identificadores externos 1:N); **RN-002** (código I solo corregible mediante procedimiento auditado); **RN-003** (comodato sin código I); **RN-005** (nunca borrar físicamente); **RN-008** (datos restringidos por permisos); **RN-010** (tipos parametrizables). Usar solo datos sintéticos en desarrollo y pruebas. La IA no guarda cambios sin aprobación humana (**RN-009**).

## Goals / Non-Goals

### Goals

1. Presentar **la misma organización visual y los mismos nombres de secciones** en modo demostración y conectado, mostrando únicamente lo que corresponde a datos disponibles y permisos del usuario.
2. Separar la página de detalle en componentes mantenibles para permitir que otros responsables integren sus secciones sin editar simultáneamente el archivo principal.
3. Dar prioridad a los campos esenciales al registrar; conservar la copia revisable de datos al registrar otra pieza y todos los mecanismos actuales de validación, borradores y conflictos.
4. Aclarar **qué guarda cada acción**. Facilitar la edición de los datos generales sin prometer un «Guardar todo» que todavía no existe en la API.
5. Mostrar nombres legibles de identificadores, datos de origen de solo lectura y auditoría según permisos; eliminar las notas técnicas visibles al usuario.
6. Conservar las acciones de fotografías, conservación, corrección excepcional del código I, baja lógica y restauración con confirmaciones comprensibles.
7. Entregar **una rama, commits incrementales y un PR**, con pruebas automáticas, pruebas humanas y capturas antes/después.

### Non-Goals

- Crear o modificar endpoints del backend, migraciones de BD o la estructura de persistencia.
- Implementar movimientos y la vista de ubicación (**P3**), integración de IA en la ficha (**P4**) ni detección de fotografías repetidas (**P5**). P1 crea interfaces de integración si hicieran falta, pero esas funcionalidades tienen otro dueño.
- Modificar el menú lateral o el estándar global de tipografía y controles (**Base**).
- Cambiar permisos, reglas de código I, borrado físico o auditoría, o usar datos reales del museo en pruebas.
- Asegurar guardado conjunto y atómico de varios recursos sin la decisión de la JP y un contrato de API acordado.

## Decisions

### D1. Separación por responsabilidades, sin reescribir la lógica existente

`apps/web/src/app/piezas/[id]/page.tsx` conservará únicamente la entrada de ruta (`params`, `RequireSession`) y la elección del flujo adecuado. Se propone una carpeta de componentes de ficha bajo `apps/web/src/components/domain/piece-detail/`:

- `PieceDetailContent.tsx`: composición de la ficha, estados de carga y coordinación de actualizaciones, sin mezclar la presentación con las llamadas a datos.
- `PieceDetailHeader.tsx`: acciones principales y avisos de permisos, apoyándose en `PieceSheetHeader`, `LivePieceHeaderActions` y `PieceDeletedNotice`.
- `PieceDetailSections.tsx`: orden de secciones, navegación entre ellas y estados vacío/cargando/error, reutilizando `PieceGeneralData`, `PieceIdentifiersTable`, `PieceGallery`, `ConservationLive` y `AuditTrailPanel`.
- `PieceIdentifiersSection.tsx`: presentación de tipos de código, formulario para añadir identificadores y diálogo de corrección del código I, reutilizando `LiveIdentifierActions` y `PieceActionDialogs`.
- Componentes o adaptadores pequeños para **Datos de origen** y **Auditoría** solo si el código existente no cubre la necesidad.

Los nombres definitivos podrán ajustarse a las convenciones de `apps/web`. **No se debe crear un segundo `PieceForm`, una segunda galería ni otra lógica de auditoría.** El primer commit debe ser preferentemente una extracción sin cambios de comportamiento; los cambios de UX se incorporan después y se prueban por separado.

### D2. Una estructura común para los modos `mock` y `live`

Ambos modos usarán la misma definición de secciones y el mismo componente de navegación/presentación. La selección del modo se basará explícitamente en `getApiMode()`; la presencia accidental de una pieza en los fixtures no debe hacer que el entorno conectado muestre acciones de demostración.

Se conservará una navegación visible por secciones: **Datos generales, Identificadores, Fotografías, Ubicación e historial, Conservación, Datos de origen y Auditoría**. La entrada o bloque de IA, si existe, se mantendrá encapsulada para que **P4** la integre o retire según su change. Se prioriza una acción principal perceptible y acceso directo a cada sección, sin reproducir una página extensa de formularios inconexos.

Los componentes con formularios conservarán su estado mientras la persona los utilice; cambiar de sección no debe borrar datos escritos sin guardar. Cuando una sección carezca de información o no esté autorizada, mostrará un mensaje claro o se ocultará conforme a las reglas de permisos; **nunca** se sustituirá por datos sintéticos en modo `live`.

La integración de **Ubicación e historial** queda delimitada a una sección/entrada estable para P3; la de IA, a una sección/entrada estable para P4. P1 no implementa su comportamiento. Antes de cambiar contratos o componentes compartidos se coordinará con sus dueños.

### D3. Registro y edición: datos esenciales primero, sin perder protecciones existentes

Se mantiene `PieceForm` compartido. En el alta, la **denominación y los campos esenciales** se muestran primero; los campos adicionales quedan organizados por grupos comprensibles y, cuando convenga, progresivamente desplegables. Se conservan la validación de frontend y servidor, las indicaciones de campos obligatorios, el guardado de borradores y el manejo de errores.

Para HU-13 se reutilizan `similarPieceCopy`, `repeatableCopy` y `prepareCopy`: los valores copiados se señalan para que la persona los revise. **No se copian** identificadores, fotos, conservación ni movimientos de la pieza anterior.

En la edición, el botón principal **«Guardar»** se refiere a los **datos generales del formulario** y mantiene `updatePiece`, la versión de la ficha y la resolución de conflictos existentes. Las acciones para añadir identificadores, fotos o evaluaciones permanecen claramente diferenciadas mientras la JP no apruebe un guardado integrado. En particular, no se presentará el botón como «Guardar toda la ficha» si no puede garantizarlo.

**Alternativa descartada por ahora:** construir en frontend una secuencia de varias escrituras simulando una transacción única; una falla intermedia podría dejar cambios parciales e inducir al usuario a pensar que todo se guardó. Si la JP aprueba un guardado verdaderamente unificado, se revisarán su alcance, transaccionalidad, manejo de errores y contrato de backend antes de implementarlo.

### D4. Identificadores y corrección auditada del código I

Los nombres de tipos se resolverán prioritariamente con los datos de `GET /api/v1/identifier-types`, accesibles según el permiso real de lectura; si no hay respuesta, se usarán nombres de respaldo documentados para los tipos del seed: `I`, `COLECCION`, `INC_RN`, `PUCP`, `PROPIETARIO` y `OTRO`. Para códigos desconocidos se preservará el identificador técnico **sin inventar un significado**.

La resolución deberá ser **una utilidad compartida**, reutilizable en la tabla de la ficha y los diálogos pertinentes; revisar antes si la versión actual de `DuplicateReview` ya ofrece `identifierTypeName` / `SEEDED_IDENTIFIER_TYPE_NAMES`, para evitar una implementación paralela. No depender solo del permiso `identifiers.manage` para cargar etiquetas que necesitan personas con permiso de lectura.

El código I vigente se muestra bloqueado. Solo quien tenga `identifiers.correct_inventory_code` ve la acción excepcional, que reutiliza `InventoryCodeCorrectionDialog`, exige motivo y confirma el procedimiento auditado. Los textos de cara al museo no incluyen códigos internos como «RN-002»; estos se conservan en documentación y pruebas.

### D5. Datos de origen y auditoría en modo conectado

- **Datos de origen:** consumir la lectura existente `GET /api/v1/pieces/{piece_id}/source-records` mediante el cliente tipado (crear un wrapper mínimo si falta). Presentar el origen en **solo lectura**, con nombre de fuente, referencia y valores cuando existan; no mostrar un JSON crudo como interfaz principal ni inventar campos ausentes. Estados de carga, vacío, error y acceso restringido explícitos.
- **Auditoría:** reutilizar `AuditTrailPanel` y `fetchPieceAuditTrail`, condicionando su visibilidad a `audit.read` y preservando las autorizaciones del servidor. Evitar duplicar la vista administrativa de auditoría.
- **Ubicación:** dejar un punto de integración para P3 sin codificar movimientos por cuenta de P1.

Si alguno de estos endpoints no devuelve el dato requerido o el permiso esperado, se registra el impedimento y se coordina con el dueño correspondiente; **no se simula el dato en `live`**.

### D6. Fotografías, conservación y acciones sensibles

La sección de fotografías reutiliza `PieceGallery` y la de conservación `ConservationLive`, conservando la carga de múltiples vistas, evaluación e historial. Los mensajes y títulos se adecuarán al lenguaje del museo, pero el **aviso de foto repetida (C6)** pertenece a P5.

La baja y restauración siguen utilizando `PieceDeleteDialog`, `PieceRestoreDialog`, `deletePiece` y `restorePiece`. Se explica en lenguaje llano que la baja **retira la pieza del catálogo activo, pero no borra su información**. Los motivos, confirmaciones, permisos, respuestas de conflicto y auditoría permanecen intactos.

### D7. Validación, trabajo paralelo y commits

**Pruebas automáticas (con datos sintéticos):**

- Las dos modalidades presentan la misma estructura y los mismos nombres de sección, y no incluyen mensajes internos de desarrollo.
- Lectura de ficha con permisos restringidos y sin permisos; no se revelan datos ni acciones prohibidas.
- Nombres de identificadores devueltos por la API, respaldo de los seis tipos del seed y tipo desconocido.
- Alta manual, «Guardar y registrar otra», «Registrar a partir de esta pieza», preservación del borrador, errores de validación y conflicto de edición.
- Secciones de datos de origen y auditoría: datos, vacío, error y acceso restringido.
- Corrección auditada de código I, baja lógica y restauración; fotos y conservación sin regresiones.

**Prueba humana obligatoria:** una persona realiza las tareas de las siete HU con datos sintéticos, sin manual ni ayuda, usando teclado, zoom al 150 % y, cuando sea posible, 1366×768. Registrar qué esperaba encontrar, en qué se detuvo, texto confuso, clics, errores y mejoras; corregir y **repetir** la prueba antes de marcar «Revisada por un humano». El sistema desplegado se usa solo para lectura salvo autorización del equipo.

**Un PR, commits separados por intención:** (1) refactor de componentes, (2) coherencia mock/live y lectura, (3) registro/edición, (4) identificadores/textos/acciones, (5) pruebas, capturas y documentación. Son etapas propuestas, no un conteo de historias completadas. La refactorización que otros necesiten puede compartirse por coordinación sin cambiar el acuerdo de un único PR, salvo bloqueo real del equipo.

## Risks / Trade-offs

- **Choque con P3/P4/P5 en la misma pantalla:** P1 estabiliza primero los límites de componentes y acuerda puntos de integración; no implementa ni modifica la lógica de sus secciones.
- **Una única operación «Guardar» aún no aprobada:** presentar el alcance real del guardado y registrar la decisión pendiente de la JP; no simular atomicidad.
- **Reorganizar secciones puede perder datos temporales:** mantener los formularios montados cuando sea necesario, conservar borradores y probar cambio de sección durante una edición incompleta.
- **Permisos distintos por recurso:** confiar en la API como autorización final y en la interfaz para ocultar acciones no disponibles; probar tanto permisos parciales como ausencia de permisos.
- **Diferencias entre `mock` y `live`:** pruebas específicas de ambos modos y prohibición de mostrar datos sintéticos o acciones simuladas en el conectado.
- **Cambio grande en un único PR:** commits pequeños y verificables, linters y pruebas por etapa, y comunicación de avances a Yessica para la exposición.

## Migration Plan

1. Confirmar el estado de `main`, la rama `feat/ficha-edicion-unificada`, la vigencia de los componentes y las integraciones de P3/P4/P5 antes de editar.
2. Extraer componentes sin cambio funcional; pasar pruebas y registrar el commit de refactor.
3. Aplicar cambios de UX de manera incremental, con regresiones sobre alta, edición, identificadores, fotografía, conservación, baja y restauración.
4. Ejecutar `npm ci` (no `npm install`), las pruebas/lint/typecheck disponibles y `npx openspec validate ficha-edicion-unificada --strict`; documentar cualquier bloqueo real.
5. Realizar la prueba humana, corregir y volver a probar. Adjuntar capturas de antes/después y resultado de la lista de comprobación de P1.
6. Abrir **un único Pull Request** con sus commits y evidencia; requerir revisión de otro integrante. No archivar el change hasta aprobar y fusionar el PR.

**Despliegue y reversión:** cambio de frontend, sin migraciones planificadas ni modificación de datos del museo. Puede revertirse el PR o los commits de interfaz. Si aparecen necesidades de backend, deberán especificarse y coordinarse antes de implementarse.

## Open Questions

1. **JP / líder del equipo:** ¿«Un solo Guardar» significa guardar únicamente los campos editables de datos generales desde una pantalla, o persistir simultáneamente identificadores, fotografías y evaluaciones? Si es lo segundo, hace falta un contrato transaccional explícito.
2. **P3:** ¿qué componente o interfaz expondrá ubicación e historial dentro de la ficha, y qué permisos necesita?
3. **P4:** ¿la IA aparecerá dentro de una sección de la ficha o como acción contextual? P1 solo reservará el lugar y no modificará la lógica de IA.
4. **P5:** ¿cómo se integrará el aviso de fotografía duplicada en el componente ya existente sin duplicar validaciones?
5. **Museo / contraparte (por confirmar a través de los responsables):** ¿qué campos consideran esenciales y qué textos de la ficha no comprenden? No atribuir estas preferencias al museo sin validación.
