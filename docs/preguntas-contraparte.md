# Preguntas abiertas para la contraparte (MATP)

> Contraparte: Gabriela Mejía (curadora, responsable de colecciones), Claudio (piezas y depósitos), Marta (archivo documental).
> Cada pregunta referencia el `[SUPUESTO]` de las specs (`openspec/specs/<capacidad>/spec.md`) que resolvería. Mientras no haya respuesta, el sistema se construye con el supuesto indicado y **configurable**.
> Prioridad: **A** = bloquea diseño de datos o importación · **B** = afecta reglas/validaciones · **C** = afina UX o reportes.
> Estado inicial: todas **abiertas** (2026-09-17). Nadie ha respondido aún.

## A. Prioridad alta

| # | Pregunta | Supuesto vigente | Spec / IDs |
|---|---|---|---|
| A1 | ¿Nos pueden compartir una muestra anonimizada del Excel consolidado de la consultoría 2024/25 (cabeceras reales y 20–50 filas)? ¿Qué otras fuentes (Access, Word) habría que importar? | Se admiten `.xlsx` y `.csv`; columnas ilustrativas (`OBS. CONSULTORÍA`) | importacion-datos (RF-021, RF-022), catalogo-piezas (RF-008) |
| A2 | ¿Cuál es el formato exacto del código I (prefijo, separador, dígitos)? ¿Los ceros a la izquierda son significativos (`I-0236` = `I 236`)? | Ceros a la izquierda no significativos; formato ilustrativo `I-236` | identificacion-piezas (RF-003, RF-023) |
| A3 | ¿Lista oficial de colecciones (11–12), sus siglas y variantes históricas (`MMZ`, `M.M.Z.`, `RA`/`RAB`...)? ¿Cuáles están en comodato y cuál es su tenencia por defecto? | Siglas ilustrativas de la reunión; sin lista oficial | colecciones-vocabularios (RF-010), identificacion-piezas (RF-023) |
| A4 | ¿Qué formatos tuvo el código INC / Registro Nacional (4 y 6 dígitos) y en qué período? ¿Hay prefijos o letras? | Se aceptan 4 y 6 dígitos y se registra el formato detectado | identificacion-piezas (RF-023) |
| A5 | ¿Qué marcas se usan hoy para "sin código" (`S/N`, `s/c`, `-`, `0`, vacío)? | Esos marcadores se tratan como ausencia de código I | identificacion-piezas (RF-004) |
| A6 | ¿Cómo se corrige hoy un código I mal asignado? ¿Quién lo autoriza? ¿Un código I de una pieza dada de baja puede reutilizarse? | Solo Administrador con motivo; nunca se reutiliza automáticamente | identificacion-piezas (RF-003), auditoria-trazabilidad (RNF-006) |
| A7 | ¿Cuáles son los niveles reales de ubicación (sedes, depósitos, salas, muebles/racks, niveles, cajas) y existe alguna codificación física? | Sede → espacio → mueble → nivel → contenedor; solo sede y espacio obligatorios | ubicacion-movimientos (RF-016) |
| A8 | ¿Cómo se separan hoy varios códigos en una misma celda (`/`, `;`, `-`, salto de línea)? ¿Hay ejemplos de combinaciones típicas? | Separadores comunes; se proponen identificadores separados para revisión humana | identificacion-piezas (RF-023) |

## B. Prioridad media

| # | Pregunta | Supuesto vigente | Spec / IDs |
|---|---|---|---|
| B1 | ¿Qué campos son obligatorios en la ficha además de denominación y régimen de tenencia? | Solo esos dos; el resto genera alertas | catalogo-piezas (RF-006) |
| B2 | ¿Qué datos del acuerdo de comodato se deben registrar (comodante, fechas, número de acuerdo, cláusulas de fotografía/publicación)? ¿Qué tipos de restricción de imagen existen? | Comodante + referencia al acuerdo + restricción de publicación | catalogo-piezas (RF-005), multimedia (RF-014, RN-008) |
| B3 | ¿Puede una pieza en comodato pasar a propiedad (donación posterior)? ¿Con qué documento? | Sí, con motivo y documento de respaldo | catalogo-piezas (RF-005) |
| B4 | ¿Vocabulario de estado de conservación usado por el museo (p. ej. bueno/regular/malo) y quién lo evalúa? | Vocabulario configurable; evaluado por Conservación | colecciones-vocabularios (RF-012) |
| B5 | ¿Clasificación de categorías/tipologías de la consultoría 2024/25 y listas de materiales y técnicas? | Tabla configurable precargada al recibir la lista | colecciones-vocabularios (RF-011) |
| B6 | ¿Qué campos son sensibles y quién puede verlos (valorización, ubicación exacta, comodato, donantes)? | Esos cuatro grupos, restringidos por rol | usuarios-roles (RF-041) |
| B7 | ¿Qué puede hacer cada rol? Validar la matriz de permisos propuesta (Administrador, Curadora, Catalogador, Conservación, Depósito, Consulta interna). ¿Quién aprueba cargas masivas? | Aprueban Gestor de colecciones y Administrador; categorías solo ellos | usuarios-roles (RF-039), importacion-datos (RF-027) |
| B8 | ¿Cómo se codifican los componentes de un conjunto (sufijos `.1`, `-a`, letras)? | Código derivado del conjunto con sufijo, formato por definir | catalogo-piezas (RF-009) |
| B9 | ¿Cómo se registra la época (siglos, `ca.`, rangos, "3000 años")? ¿Qué amplitud dar a "ca. 1950"? | Texto original + interpretación opcional; amplitud configurable | catalogo-piezas (RF-007) |
| B10 | Al actualizar desde un Excel, si la celda viene vacía, ¿se debe borrar el valor existente o conservarlo? | Por defecto se conserva el valor existente | importacion-datos (RF-026) |
| B11 | ¿Se permite corregir la colección de una pieza asignada por error? ¿Quién lo autoriza? | Sí, Gestor de colecciones con motivo | catalogo-piezas (RN-007) |
| B12 | ¿Qué política de datos aplica al enviar descripciones de piezas a un proveedor de IA externo? | No se envían campos sensibles ni datos personales; por defecto proveedor simulado | ia-asistiva (RN-009) |

## C. Prioridad baja

| # | Pregunta | Supuesto vigente | Spec / IDs |
|---|---|---|---|
| C1 | ¿Cómo se nombran hoy los archivos de fotos? ¿Cuántas fotos por pieza y de qué resolución/tamaño aproximado? ¿Formatos (JPEG, TIFF, RAW)? | JPEG/PNG/TIFF; 5 fotos por pieza y 4 MB por foto para la estimación | multimedia (RF-013, RNF-003) |
| C2 | ¿Qué tipos de vista usan (frontal, perfil, posterior, superior, detalle, abierta/cerrada)? | Esa lista, configurable | multimedia (RF-013) |
| C3 | ¿Qué campos del Ministerio de Cultura / Registro Nacional aplican a la ficha? | No incluidos aún como campos propios | catalogo-piezas (RF-006) |
| C4 | ¿Qué tiempo de búsqueda es aceptable para ustedes ("segundos")? | p95 ≤ 2 s con 20 000 piezas y 10 usuarios | busqueda-reportes (RF-038) |
| C5 | ¿Quién puede hacer la exportación completa de la base de datos? | Solo Administrador | busqueda-reportes (RF-044) |
| C6 | ¿Con qué frecuencia y retención deben hacerse los respaldos? ¿Dónde se guardaría la copia externa? | Diario, 30 días, copia fuera del servidor | plataforma (RNF-011) |
| C7 | ¿Umbral de intentos fallidos de inicio de sesión y tiempo de expiración por inactividad? | 5 intentos; expiración configurable | usuarios-roles (RNF-012) |
| C8 | ¿Qué tamaño de exportación a Excel se espera habitualmente? | Umbral configurable para exportación en segundo plano | busqueda-reportes (RF-036) |
| C9 | ¿Interesan la descripción preliminar (RIA-04) y el asistente de consulta (RIA-05) en fase 1? | RIA-04 por validar; RIA-05 desactivado | ia-asistiva (RIA-04, RIA-05) |

## D. Supuestos añadidos al implementar el modelo de datos (change `modelo-datos-nucleo`, 2026-09-17)

Detalle de las reglas en `apps/api/app/modules/identification/normalization.py` (N1–N7) y en `docs/modelo-datos.md`.

| # | Pregunta | Supuesto vigente | Spec / IDs | Prioridad |
|---|---|---|---|---|
| D1 | ¿Un número sin prefijo (`236`) registrado en la columna de código I debe entenderse como `I-236`? | Sí, se normaliza a `I-236` y se registra el formato `SOLO_NUMERO` | identificacion-piezas (RF-023) | A |
| D2 | En los códigos INC/RN, ¿los ceros a la izquierda y los separadores (`12.345-6`) son significativos? | Separadores irrelevantes; ceros **significativos** (ancho fijo de 4 o 6 dígitos); otras longitudes quedan "no normalizables" para revisión | identificacion-piezas (RF-023) | A |
| D3 | ¿Cómo se escribe el sufijo de los componentes de un conjunto (`MBB 40.1`, `MBB 40-01`, `MBB 40a`)? | Se normaliza a `SIGLA NÚMERO.SUFIJO` sin ceros a la izquierda (`MBB 40.1`) | catalogo-piezas (RF-009), identificacion-piezas (RF-023) | B |
| D4 | ¿Un contenedor (caja) puede estar directamente en un mueble sin nivel? ¿Puede una caja estar en el piso de un depósito sin mueble? | Contenedor dentro de nivel o de mueble; no directamente en un espacio | ubicacion-movimientos (RF-016) | B |
| D5 | ¿Qué tipos de restricción de uso de imágenes existen (sin restricción, solo uso interno, no publicar, requiere autorización del comodante)? | Esos cuatro términos, configurables | multimedia (RF-014, RN-008) | B |
| D6 | ¿Se debe registrar un código I con formato no reconocido para revisarlo después, o se rechaza al ingresarlo manualmente? | En ingreso manual se rechaza (el código I se bloquea al asignarse); en importación queda para revisión | identificacion-piezas (RF-003, RF-023) | B |
| D7 | ¿Qué vocabularios iniciales usan hoy (categorías, materiales, técnicas, formas de adquisición, disponibilidad)? | Listas ilustrativas cargadas por el seed, editables como datos | colecciones-vocabularios (RF-011, RN-010) | C |

## E. Supuestos añadidos al definir los contratos de API (change `contratos-api-borrador`, 2026-09-17)

| # | Pregunta | Supuesto vigente | Spec / IDs | Prioridad |
|---|---|---|---|---|
| E1 | ¿Hay integraciones previstas (SURDOC, Getty AAT, otros sistemas PUCP) con requisitos de formato o versión de API? | API REST `/api/v1` con OpenAPI 3.1; sin integraciones en fase 1 | plataforma (RNF-009) | C |
| E2 | ¿Qué roles pueden ver el nombre del comodante, la referencia del contrato de comodato y el origen/donante de una colección? | Solo roles con `sensitive.donor_data` / `sensitive.loan_terms` (Administrador y Gestora de colecciones) | usuarios-roles (RF-041, RN-008) | A |
| E3 | ¿El personal de Consulta interna debe ver solo sede y espacio, o también mueble, nivel y contenedor? | Solo sede y espacio; niveles inferiores requieren `sensitive.exact_location` | usuarios-roles (RF-041), ubicacion-movimientos (RF-016) | B |
| E4 | ¿Se puede eliminar un término de vocabulario ya asignado a piezas, o solo desactivarlo? | Solo desactivarlo; la eliminación lógica se rechaza si está en uso | colecciones-vocabularios (RF-011, RN-005) | B |
| E5 | ¿Una colección con piezas o subcolecciones puede darse de baja? | No: primero se reasignan las piezas o se desactiva la colección | colecciones-vocabularios (RF-010, RN-007) | B |
| E6 | En medidas escritas como "35 x 20 x 12 cm", ¿el orden habitual es alto × ancho × profundidad? | Sí (solo para la sugerencia simulada de IA, siempre revisada por una persona) | ia-asistiva (RIA-01) | C |

## F. Supuestos añadidos al construir la maqueta navegable (change `maqueta-ui-navegable`, 2026-09-17)

Estos supuestos son de **interfaz/flujo**, no de datos: se validan en la reunión de demostración (ver `docs/maqueta/recorrido-demo.md`).

| # | Pregunta | Supuesto vigente | Spec / IDs | Prioridad |
|---|---|---|---|---|
| F1 | En el asistente de importación, ¿las filas se deciden una por una o hay una acción "aceptar todas las filas nuevas sin conflicto"? | Una por una en esta maqueta (aceptar/excluir/rechazar); una acción masiva queda para el change de importación real | importacion-datos (RF-025..027) | B |
| F2 | Al fusionar dos posibles duplicados, ¿cuál de los dos registros queda como "principal" (denominación, foto de portada)? ¿Se pide elegir campo por campo? | La maqueta solo registra la decisión y el motivo; la fusión campo a campo queda para el change de calidad de datos | calidad-datos (RF-030) | B |
| F3 | ¿"Posponer" un duplicado debe quedar guardado (para que reaparezca luego) o basta con que vuelva a aparecer si no se decide en la sesión? | Pendiente: en la maqueta "posponer" no persiste (sin backend); a definir si necesita un estado propio o basta con "no decidir" | calidad-datos (RF-030) | C |
| F4 | En el editor de pieza, ¿qué campos deben poder editarse en línea recta (sin pasar por aprobación) y cuáles requieren revisión de un rol superior? | La maqueta permite editar denominación/descripción/procedencia/medidas/observaciones con el permiso `pieces.update`; el código I y el régimen de tenencia no son editables ahí (RN-002/RN-003) | catalogo-piezas (RF-043) | B |
| F5 | En la vista móvil de depósito, ¿alcanza con "movimiento" y "verificación física", o se necesita registrar incidencias (pieza dañada, faltante) desde ahí mismo? | Solo movimiento/verificación en esta maqueta; incidencias quedan para un change de backlog si se confirma la necesidad | ubicacion-movimientos (RF-017, RF-020) | C |

## G. Supuestos añadidos al proponer el backlog (Fase 7, 15 changes, 2026-09-17)

Estos supuestos están en los `design.md` y specs delta de `openspec/changes/<change>/`. Todos son **configurables** en el diseño propuesto; ninguno bloquea empezar a implementar, pero sí cambian valores por defecto.

| # | Pregunta | Supuesto vigente | Change / IDs | Prioridad |
|---|---|---|---|---|
| G1 | ¿Qué cambios de régimen de tenencia ocurren en la práctica (comodato → propiedad por donación, préstamo temporal → comodato)? ¿Qué documento respalda cada uno? | Comodato → propiedad con motivo y referencia documental; propiedad → comodato o préstamo temporal rechazado si la pieza tiene código I | `ficha-pieza-crud` (RF-005, RN-003, RN-004) | A |
| G2 | ¿Las piezas en comodato deben aparecer en el inventario oficial del museo (con subtotal propio) o en un listado aparte? | Se incluyen con subtotal separado; configurable | `reportes-inventario` (RF-033, RN-004) | A |
| G3 | ¿La restricción de imágenes de una colección en comodato aplica automáticamente a todas sus fotos? ¿Puede una foto concreta tener una restricción distinta? | Precedencia foto > pieza > colección en comodato; bloqueo solo de descargas "para uso externo" | `fotografias-multiples-por-pieza` (RF-014, RN-008) | B |
| G4 | ¿Tamaño máximo de una foto y formatos originales que produce el museo (JPEG, TIFF, RAW)? | JPEG, PNG y TIFF; 50 MB por archivo | `fotografias-multiples-por-pieza` (RF-013, RNF-003) | C |
| G5 | ¿Qué tipos de espacio existen (depósito, sala de exhibición, taller de conservación, oficina)? ¿La disponibilidad "en sala" depende solo del espacio? | Tipos depósito, sala, taller y otro; la disponibilidad se propone según el tipo de espacio | `ubicacion-jerarquica-y-movimientos` (RF-016, RF-020) | B |
| G6 | ¿De qué tamaño son las sábanas más grandes (filas, MB)? ¿Las fuentes Access y Word pueden exportarse a Excel/CSV antes de cargarlas? ¿Hay celdas combinadas o varias hojas por archivo? | Máximo 20 000 filas y 50 MB; Access/Word se convierten fuera del sistema; celdas combinadas propagan su valor | `importacion-pipeline-reconciliacion` (RF-021) | A |
| G7 | ¿Existen siglas históricas de colecciones que ya no se usan pero aparecen en las sábanas (alias)? ¿Cuáles? | Alias configurables por el Administrador; ninguno cargado | `plantillas-mapeo-y-normalizacion` (RF-023) | A |
| G8 | ¿Cuánto tiempo puede posponerse la revisión de un posible duplicado? ¿Se pueden fusionar una pieza en propiedad y otra en comodato si resultan ser la misma? | Máximo 180 días; fusión rechazada si los regímenes difieren (primero se corrige el régimen) | `deteccion-duplicados-y-cola-revision` (RF-030) | C |
| G9 | ¿Qué campos considera el museo "recomendados" para que una ficha esté completa (además de denominación y régimen)? | Colección, categoría, descripción, época, materiales, medidas, estado de conservación y procedencia | `alertas-y-reporte-incompletas` (RF-019, RF-035) | B |
| G10 | ¿Cuántas filas suele tener una exportación a Excel y cuánto tiempo debe estar disponible el archivo generado? | Exportación inmediata hasta 5 000 filas; en segundo plano por encima; archivos disponibles 72 h | `busqueda-avanzada-y-exportacion` (RF-036) | C |
| G11 | ¿Se registran valorizaciones de piezas (monto, moneda, fecha, fuente)? ¿Quién las carga y quién puede verlas? ¿Se necesita el reporte de seguros en fase 1? | Historial de valorizaciones cargado por archivo; reporte desactivado por defecto; solo con permiso de valorización | `reportes-inventario` (RF-037, RF-041) | B |
| G12 | ¿Tiempo de inactividad tras el cual se cierra la sesión y duración máxima de una jornada de sesión? ¿Existe servicio de correo institucional para avisos y recuperación de contraseña? | 30 min de inactividad, 12 h máximo, 5 intentos y 15 min de bloqueo; sin correo (el Administrador restablece contraseñas) | `autenticacion-y-matriz-permisos` (RNF-012) | B |
| G13 | ¿Quién puede revertir una carga o una edición ajena? ¿Existe obligación de anonimizar datos personales (donantes, comodantes) a solicitud del titular (Ley 29733)? | Revierte el autor (ediciones manuales), `imports.revert` (cargas) o el Administrador; anonimización fuera de alcance hasta definición legal | `auditoria-y-soft-delete-transversal` (RNF-007, RNF-014) | B |
| G14 | Datos de la VM PUCP: sistema operativo, CPU/RAM/disco, dominio, certificado, acceso SSH, destino externo para respaldos, canal de alertas; objetivo de recuperación aceptable (pérdida máxima de datos y tiempo máximo sin servicio) | RPO 24 h, RTO 4 h, respaldo diario con 30 días de retención, simulacro mensual; alertas por webhook o correo | `despliegue-vm-y-respaldos` (RNF-011, RNF-002) | A |
| G15 | ¿Se acepta enviar textos de fichas (sin datos sensibles ni personales) a un proveedor de IA externo en el futuro? ¿Quién aprueba sugerencias de IA y quién crea términos nuevos propuestos por la IA? | Solo proveedor simulado; revisan Gestor y Administrador; solo quien administra vocabularios crea términos; exposiciones extraídas quedan retenidas hasta tener el módulo de exposiciones | `ia-extraccion-texto-libre`, `ia-sugerencia-terminos` (RN-009, RIA-01, RIA-03) | B |

### Las 5 preguntas más urgentes (propuesta para la próxima reunión)

1. **A1 + G6** — Muestra anonimizada de la sábana de la consultoría (cabeceras reales, 20–50 filas), tamaño de los archivos y otras fuentes: bloquea calibrar importación, plantillas y duplicados.
2. **A2 + A4 + D1 + D2** — Formato exacto del código I y del código INC/RN (prefijos, ceros, separadores): el normalizador y la unicidad del código I dependen de ello.
3. **A3 + G7** — Lista oficial de colecciones, siglas, variantes históricas y cuáles están en comodato.
4. **B6 + B7 + E2** — Campos sensibles y matriz de permisos por rol (quién aprueba cargas, quién ve comodantes y ubicación exacta).
5. **G14** — Datos de la VM PUCP y política de respaldos: sin ellos no se puede desplegar para el avance integrado (S12).

## H. Diagrama entidad-relación del equipo frente al modelo implementado (2026-09-22)

Fuente: `docs/fuentes/diagrama-entidad-relacion.pdf` (13 entidades). Comparación completa en `docs/estado-arranque.md`, sección «Diagrama ER frente al modelo implementado». Estas preguntas son **internas del equipo** (Arquitecto y Líder), no para el museo, salvo H3.

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| H1 | ¿El código I se guarda como columna de `PIECES` (como en el diagrama) o solo como identificador 1:N (como está implementado)? Si es columna, ¿los códigos I históricos de una pieza fusionada dónde quedan? | Sigue en `piece_identifier`, con índice parcial de unicidad entre vigentes | `modelo-datos-nucleo`, `ficha-pieza-crud`, `importacion-pipeline-reconciliacion` (RN-001, RN-002) | A |
| H2 | ¿Se acepta un solo rol por usuario en texto (diagrama) o se mantiene la matriz de roles y permisos? RF-041 y RF-042 piden matriz y campos sensibles por rol. | Se mantiene la matriz (`role`, `permission`, `user_role`, `role_permission`) | `autenticacion-y-matriz-permisos` (RF-041, RF-042) | A |
| H3 | ¿`CATEGORIES` y `CONSERVATION_STATES` deben ser tablas propias, o vocabularios parametrizables como el resto (materiales, técnicas, tipos de vista)? RN-010 pide parametrizables. | Vocabulario genérico `vocabulary` + `term` | `colecciones-y-vocabularios-admin` (RN-010) | A |
| H4 | ¿Dónde se guardan las sugerencias de IA pendientes y su aprobación, y la cola de duplicados, si no existen en el diagrama? RN-009 exige aprobación registrada. | Tablas `ai_suggestion` y `duplicate_candidate`, añadidas al diagrama | `ia-extraccion-texto-libre`, `deteccion-duplicados-y-cola-revision` (RN-009, RF-030) | A |
| H5 | ¿`LOANS` entra en la fase 1? Hoy no existe tabla y RF-018 (préstamos y exposiciones) quedó fuera del backlog. | Fuera de alcance de la fase 1 | Nuevo change por proponer (RF-018) | B |
| H6 | ¿El borrado lógico se limita a `PIECES` (como en el diagrama) o se mantiene en todas las tablas? RN-005 dice que nunca se borra información. | Borrado lógico y auditoría en todas las tablas de negocio | Transversal (RN-005) | A |

## I. Contrato de interfaces del equipo (`endpoints-api-v1.yaml`, 2026-09-22)

Fuente: `docs/fuentes/endpoints-api-v1.yaml`. Mapeo operación por operación y conflictos C1 a C6: `docs/api/mapeo-endpoints-v1.md`. Change que ejecuta la alineación: `alinear-api-endpoints-v1`. Preguntas **internas del equipo** (Arquitecto e Integradores), salvo I2, que necesita también la opinión del museo.

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| I1 | El documento usa su propia numeración de requisitos, distinta de `docs/requisitos/catalogo.md` (en el documento RF-041 es el login; en el catálogo, la restricción de campos sensibles). ¿Cuál es la numeración oficial? | Las specs y los 15 changes siguen citando el catálogo; el mapeo registra la correspondencia | Trazabilidad de las 12 specs y los 15 changes | A |
| I2 | `GET /public/catalog` es un endpoint abierto sin autenticación. ¿Entra en la fase 1, pese a que RF-042 y `CLAUDE.md` dicen «solo uso interno, nada público»? ¿Qué campos serían públicos con comodato y Ley 29733 de por medio? | No se implementa ni se expone hasta que se decida | `busqueda-reportes`, nuevo change de catálogo público (RF-042, RN-008, RNF-014) | A |
| I3 | `DELETE /pieces/{id}/identifiers/{identifier_id}` habla de «remover» un código. ¿Se acepta implementarlo como baja lógica (queda en el historial y la auditoría) para respetar RN-005? | Baja lógica; 409 si el identificador es de tipo I (RN-002) | `ficha-pieza-crud` (RN-002, RN-005) | A |
| I4 | ¿Los valores de enumerado en español (`Propiedad`, `Comodato`, `Préstamo Temporal`) se guardan así en la base o solo se traducen en la frontera de la API? | Traducción en la frontera; la base conserva códigos en inglés (ADR-002) | Transversal | B |
| I5 | El documento no incluye 62 operaciones que la API ya expone (aprobación de sugerencias de IA, cola de duplicados, vocabularios, plantillas de mapeo, restauración de piezas…). ¿Se conservan como añadidos o hay que eliminarlas? | Se conservan y quedan declaradas como añadidos justificados | Transversal (RN-005, RN-009, RN-010, RF-030) | A |
| I6 | El documento menciona AWS S3 y un staging en AWS Academy; ADR-007 y ADR-011 asumen MinIO en local, Cloudflare R2 de contingencia y la VM de la PUCP. ¿Qué se usa en staging? | MinIO en local y VM de la PUCP; S3 es compatible por API — **Resuelta internamente (2026-09-26)**: AWS Academy es el entorno de integración/staging, con RDS + S3 gestionados, EC2 y el mismo overlay de Compose de producción (sin `db` ni `storage`); ver **ADR-013** | `despliegue-vm-y-respaldos` (RNF-002) | B |

## J. Sistema de diseño del frontend (2026-09-23)

Fuente: `docs/fuentes/system-design-frontend.md` (documento del equipo). Change: `sistema-diseno-frontend`. Decisión: ADR-012. J1 y J2 son para el museo (Dirección de Cultura); J3 es interna del equipo (Arquitecto).

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| J1 | ¿Los colores Terracota (`#A23C16`), Tinta (`#0C0F14`) y Crema (`#F5F0DA`) y las tipografías Poppins e Inter corresponden a la identidad visual oficial del museo o de la Dirección de Cultura? ¿Hay un manual de marca? | Se usan los valores del documento del equipo, declarados como tokens para poder cambiarlos en un solo lugar | `plataforma` (RNF-004, RNF-010) | C |
| J2 | ¿Hay un logotipo autorizado del MATP o de la PUCP para la barra lateral de una herramienta interna? | Solo el texto «MATP · Colecciones», sin logotipo | `plataforma` | C |
| J3 | ¿Los nombres de los tokens de color se mantienen en español (`terracota`, `tinta`, `crema`) como en el documento o se traducen al inglés (ADR-002)? | Se mantienen en español porque nombran la identidad visual | Interna (ADR-002, ADR-012) | C |
