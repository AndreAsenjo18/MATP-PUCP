# Diseño — `alinear-api-endpoints-v1`

Ver `proposal.md` (Why) y el mapeo completo en `docs/api/mapeo-endpoints-v1.md`. Punto de partida: API con 78 operaciones (28 implementadas, 50 stubs) del change `contratos-api-borrador`, y el modelo de 23 tablas de `modelo-datos-nucleo`.

## D1. El documento manda en la frontera; el dominio conserva sus reglas

`docs/fuentes/endpoints-api-v1.yaml` fija rutas, verbos, `operationId`, esquemas y valores de enumerado. Lo que no fija (reglas de negocio, auditoría, borrado lógico, aprobación humana de la IA) se mantiene como está, porque proviene del catálogo de requisitos y de `CLAUDE.md`. Cuando el documento describe una operación en términos que chocan con una regla no negociable, se conserva **la ruta y el verbo del documento** y se ajusta el comportamiento:

- `DELETE /pieces/{id}/identifiers/{identifier_id}`: baja lógica del identificador (queda en el historial y en la auditoría), nunca borrado físico (RN-005). Si el identificador es de tipo I, responde 409 citando RN-002.
- `DELETE /pieces/{id}`: `is_active = false` con motivo obligatorio; la restauración sigue disponible en la operación añadida `POST /pieces/{id}/restore`.
- `POST /ai/suggest-cataloging`: devuelve la sugerencia como pendiente y la guarda con `status: PENDING`; aplicarla exige las operaciones añadidas de aprobación (RN-009).

## D2. Prueba de conformidad como red de seguridad

`apps/api/tests/api/test_contract_conformance.py` lee `docs/fuentes/endpoints-api-v1.yaml` y compara con el esquema que genera la aplicación:

1. Toda ruta, verbo y `operationId` del documento existe en la API, con el prefijo `/api/v1`.
2. Los campos requeridos de cada esquema del documento existen en el esquema de la API con el mismo nombre.
3. Las operaciones de la API que no están en el documento están declaradas en la lista de añadidos del propio test, que se mantiene junto a `docs/api/mapeo-endpoints-v1.md`; cualquier otra hace fallar la prueba.

Así, si alguien añade una ruta que el documento no contempla, la CI lo detecta en lugar de descubrirse en la integración.

## D3. Campos y nombres

Decisiones ratificadas el 2026-09-29 al resolver C4 y C5 (ver D7).

| Documento | Hoy | Decisión |
|---|---|---|
| `denomination` | `title` | Se renombra en la base de datos, el modelo y la API (columna, índice `ix_piece_title` → `ix_piece_denomination`) |
| `code_i` en la pieza | identificador de tipo I en `piece_identifier` | **No se añade columna.** `code_i` es un campo **derivado** en la API: el `normalized_value` del identificador vigente de tipo I de la pieza (`is_current`, sin baja lógica), o `null` si no tiene. Ver D4 |
| `category_id`, `conservation_state_id` | términos de vocabulario | **Fachada sobre el vocabulario**: `category_id` y `conservation_state_id` son `term.id` de los vocabularios de categoría y de estado de conservación. No se crean tablas `category` ni `conservation_state`; se añade `term.parent_id` para la jerarquía de categorías. Todos los vocabularios siguen en `vocabulary`/`term` (RN-010). En la base, las columnas se renombran a `category_id` y `conservation_state_id` |
| `category_id`, `conservation_state_id` requeridos en `PieceCreate` | opcionales | **Opcionales** mientras el museo no responda B1: solo `denomination` y `tenure_regime` son obligatorios y la falta de los otros dos genera alerta de ficha incompleta. Desviación declarada en el mapeo `[SUPUESTO]` |
| `is_active` | `deleted_at`, `deleted_by_id`, `deletion_reason` | `is_active` se expone en la API como propiedad derivada (`deleted_at is null`); la base conserva quién y por qué (RN-005) |
| `epoch_original_text`, `epoch_start_year`, `epoch_end_year` | `period_text`, `period_from`, `period_to` | Se renombran en la base, el modelo y la API (incluida la restricción `period_range` → `epoch_range`) |
| (no existe) | `period_type` | Se renombra a `epoch_type` y se conserva como **campo opcional añadido** a los esquemas del documento (interpretación de la época, B9); se declara en el mapeo |
| `unmapped_payload` | `unmapped_payload` | Igual |
| `tenure_regime` y `view_type` con valores en español | valores en inglés | Traducción en la frontera (entrada y salida) con una tabla única en `app/api/enums.py` (tarea 3.1); la base conserva los códigos en inglés (ADR-002). El régimen de tenencia **no** pasa a vocabulario: sostiene reglas fijas (RN-003, RN-004) |
| rol del usuario en `/auth/me` y `PUT /users/{id}/role` | matriz `role`/`permission`/`user_role` | Se mantiene la matriz (RF-041). `/auth/me` devuelve los roles y permisos del usuario; `PUT /users/{id}/role` reemplaza el conjunto de roles asignados. El documento no define el esquema de rol, así que no hay desviación |

## D4. `code_i` derivado del identificador vigente (decisión C4, 2026-09-29)

El documento pide `code_i` en la **respuesta** de la pieza. No fija dónde se guarda. RN-001, RN-002 y el historial de códigos piden que el código I viva en `piece_identifier`, así que se guarda **solo ahí** y la API lo expone como campo derivado:

- **Lectura**: `code_i` = `normalized_value` del `piece_identifier` de tipo I con `is_current = true` y sin baja lógica. En listados y búsqueda se resuelve con un único `LEFT JOIN` apoyado en el índice parcial de unicidad que ya existe (una fila por pieza como máximo), nunca con una consulta por pieza.
- **Escritura**: `code_i` en `PieceCreate` se enruta a `identification/service.py`, que crea el identificador de tipo I bloqueado (`is_locked`). En `PUT /pieces/{id}`, un `code_i` distinto del vigente responde 409 citando RN-002; la corrección sigue por la operación añadida `.../correction`. Un `code_i` en una pieza en comodato responde 409 (RN-003).
- **Unicidad**: la garantiza el índice parcial existente entre identificadores vigentes de tipo I.

Alternativas descartadas:

- **Columna `piece.code_i` más `piece_identifier`, con un disparador que impida que difieran** (la versión anterior de este D4). Duplica el dato, obliga a escribir en dos sitios y añade un disparador específico de PostgreSQL a la migración. El argumento de que el campo derivado «no cumple el contrato» era erróneo: el contrato fija la forma de la API, no la de la base.
- **Solo la columna en la pieza**: se pierde el historial de códigos I corregidos (RN-002).
- **Vista materializada**: complica las escrituras sin ganar nada con este volumen (unas 20 000 piezas).

## D5. Orden de implementación

Por fases del propio documento, para que la maqueta y las células avancen desde la fase 1:

1. Fase 1 (operaciones 1 a 20): piezas, colecciones, categorías, estados de conservación, ubicaciones, importación, búsqueda, multimedia y autenticación.
2. Cliente tipado y maqueta en modo `live` sobre esas rutas.
3. Fase 2 (21 a 38) y fase 3 (39 a 45) como stubs con su forma definitiva, salvo `/public/catalog`, que espera la decisión C2.

## D6. Riesgos

- **Rotura de la maqueta y del cliente tipado**: se regeneran en el mismo change; la prueba de conformidad y `npm run openapi:check` impiden que queden desalineados.
- **Numeración de requisitos (C1)**: decidido en D7. Si la tabla de equivalencias no se mantiene, la trazabilidad del documento del equipo se pierde; se revisa en la tarea 6.2.
- **`/public/catalog` (C2)**: sigue bloqueado hasta que responda el museo (I2). La prueba de conformidad lo mantiene en `BLOQUEADAS`, así que el change puede cerrarse sin esa operación.
- **Campos derivados en listados (D4)**: si `code_i` se resolviera pieza por pieza, la búsqueda (RF-038) se degradaría. Por eso la tarea 4.1 exige una prueba que cuente las consultas SQL de `GET /pieces`.

## D7. Resolución de los conflictos C1 a C6 (2026-09-29)

Decisiones del equipo sobre los conflictos de `docs/api/mapeo-endpoints-v1.md`, pendientes del visto bueno del Arquitecto en el PR (el change toca el contrato compartido). Las que dependen de una regla del museo quedan como `[SUPUESTO]` y su pregunta está en `docs/preguntas-contraparte.md` (secciones B e I).

| Conflicto | Decisión | Justificación | Supuesto / pregunta |
|---|---|---|---|
| **C1** Numeración de requisitos | `docs/requisitos/catalogo.md` es la numeración oficial. No se renumera nada. El mapeo añade una columna con la equivalencia entre la etiqueta `[RF-xxx]` de cada operación del documento y los IDs del catálogo | Las 12 specs y los 15 changes ya están trazados con el catálogo. Adoptar la numeración del documento obligaría a renumerarlo todo y rompería la trazabilidad. Las etiquetas del documento son descriptivas, no normativas | I1 (interna): resuelta |
| **C2** `GET /public/catalog` sin autenticación | No se implementa ni se expone, ni siquiera como stub. Sigue en `BLOQUEADAS` en la prueba de conformidad | RF-042 (*Must*, «solo uso interno en fase 1»), `CLAUDE.md`, RN-008 (restricciones de comodato) y RNF-014 (Ley 29733). Publicar datos es decisión del museo, no del equipo | `[SUPUESTO]` no hay catálogo público en fase 1. Pregunta I2 al museo |
| **C3** `DELETE /pieces/{id}/identifiers/{identifier_id}` | Baja lógica según D1: el identificador queda en el historial y en la auditoría. Si es de tipo I, responde 409 citando RN-002. Se exige motivo | RN-005 es no negociable: no hay otra alternativa compatible. Se conservan la ruta y el verbo del documento (D1) | `[SUPUESTO]` puede dar de baja un código secundario quien tiene permiso de edición de identificadores, con motivo obligatorio. Pregunta I3 al museo |
| **C4** Modelo de datos | (a) `code_i` derivado del identificador vigente de tipo I, sin columna propia (D4). (b) `title` → `denomination` y `period_*` → `epoch_*` en la base, el modelo y la API. (c) `period_type` → `epoch_type`, conservado como campo opcional añadido. (d) Categorías y estados de conservación como fachada sobre `vocabulary`/`term`, con `term.parent_id` para la jerarquía. (e) `category_id` y `conservation_state_id` opcionales en `PieceCreate`. (f) `is_active` derivado de `deleted_at`. (g) Matriz de roles y permisos, expuesta en `/auth/me` y en `PUT /users/{id}/role` | (a) Una sola fuente del código I, historial completo (RN-001, RN-002), sin disparador. (b) Un único nombre en todas las capas. Son palabras en inglés, compatible con ADR-002. (c) La interpretación de la época (B9) no tiene equivalente en el documento y no se descarta información. (d) RN-010 es uniforme para todos los vocabularios y ya existen las rutas fachada; evita migrar términos. (e) Supuesto B1: las piezas históricas llegan sin clasificar. (f) Conserva quién borró y por qué (RN-005). (g) RF-041 necesita permisos por campo sensible. El documento no define el esquema de rol | Resuelve H1 (código I en `piece_identifier`), H2 (matriz) y H3 (vocabularios). `[SUPUESTO]` B1 (obligatorios) sigue abierta al museo |
| **C5** Enumerados en español | La traducción se hace solo en la frontera de la API (`app/api/enums.py`, tarea 3.1). La base conserva los códigos en inglés. El régimen de tenencia no pasa a vocabulario | ADR-002: código en inglés. El régimen de tenencia sostiene reglas fijas (RN-003, RN-004) y no debe ser editable. Un único punto de traducción cumple el requirement «Valores de enumerado del contrato en la API» | I4 (interna): resuelta. Los nombres de los tipos de vista siguen abiertos al museo (C2 de la sección C) |
| **C6** Almacenamiento e infraestructura | AWS Academy como entorno de integración (staging), con RDS y S3 gestionados. Local con MinIO; producción en la VM de la PUCP; R2 como contingencia | Ya decidido en **ADR-013** (Aceptado, 2026-09-26). S3, MinIO y R2 comparten API (ADR-007) | I6 (interna): resuelta |

Efecto sobre las tareas: la 2.1 ya no crea `piece.code_i` ni el disparador. La 2.2 deja de crear entidades: solo añade `term.parent_id` y renombra las referencias de `piece`. La 4.1 añade las pruebas de `code_i` derivado y de número de consultas.
