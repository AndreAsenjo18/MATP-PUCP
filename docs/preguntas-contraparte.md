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
| B1 | ¿Qué campos son obligatorios en la ficha además de denominación y régimen de tenencia? ¿Y cuáles son recomendados (generan alerta de completitud, pero no bloquean guardar)? En particular, ¿la categoría y el estado de conservación deben ser obligatorios al registrar una pieza a mano (el contrato de interfaces del equipo los exige)? | Obligatorios: solo denominación y régimen de tenencia; el resto se acepta vacío en la API (D7-C4e de `alinear-api-endpoints-v1`). Recomendados (`alertas-y-reporte-incompletas`, design D2, configurables por el Administrador vía `GET`/`PUT /quality/completeness-rules`, sin pantalla propia todavía): colección, categoría, descripción, época (texto original), materiales, medidas (texto), estado de conservación y procedencia | catalogo-piezas (RF-006), calidad-datos (RF-019, RF-035, RN-010) |
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
| F2 | Al fusionar dos posibles duplicados, ¿cuál de los dos registros queda como "principal" (denominación, foto de portada)? ¿Se pide elegir campo por campo? | La maqueta solo registra la decisión y el motivo; la fusión campo a campo queda para el change de calidad de datos — **Implementado (2026-10-20)** en `deteccion-duplicados-y-cola-revision`: se elige la pieza que se conserva (si solo una tiene código I, esa; ver O5) y el valor de cada campo en conflicto; la portada de la conservada se mantiene | calidad-datos (RF-030) | B |
| F3 | ¿"Posponer" un duplicado debe quedar guardado (para que reaparezca luego) o basta con que vuelva a aparecer si no se decide en la sesión? | Pendiente: en la maqueta "posponer" no persiste (sin backend); a definir si necesita un estado propio o basta con "no decidir" — **Resuelta internamente (2026-10-20)**: estado propio «Pospuesto» con fecha; al vencer vuelve solo a pendiente (máximo en G8) | calidad-datos (RF-030) | C |
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
| G8 | ¿Cuánto tiempo puede posponerse la revisión de un posible duplicado? ¿Se pueden fusionar una pieza en propiedad y otra en comodato si resultan ser la misma? | Máximo 180 días; fusión rechazada si los regímenes difieren (primero se corrige el régimen) — **Implementado (2026-10-20)**: posponer más de 180 días responde 422 con el máximo; regímenes distintos, 409 sin cambiar ninguna pieza; ver O1–O5 | `deteccion-duplicados-y-cola-revision` (RF-030) | C |
| G9 | ¿Qué campos considera el museo "recomendados" para que una ficha esté completa (además de denominación y régimen)? | Colección, categoría, descripción, época, materiales, medidas, estado de conservación y procedencia | `alertas-y-reporte-incompletas` (RF-019, RF-035) | B |
| G10 | ¿Cuántas filas suele tener una exportación a Excel y cuánto tiempo debe estar disponible el archivo generado? | Exportación inmediata hasta 5 000 filas; en segundo plano por encima; archivos disponibles 72 h | `busqueda-avanzada-y-exportacion` (RF-036) | C |
| G11 | ¿Se registran valorizaciones de piezas (monto, moneda, fecha, fuente)? ¿Quién las carga y quién puede verlas? ¿Se necesita el reporte de seguros en fase 1? | Historial de valorizaciones cargado por archivo; reporte desactivado por defecto; solo con permiso de valorización | `reportes-inventario` (RF-037, RF-041) | B |
| G12 | ¿Tiempo de inactividad tras el cual se cierra la sesión y duración máxima de una jornada de sesión? ¿Existe servicio de correo institucional para avisos y recuperación de contraseña? | 30 min de inactividad, 12 h máximo, 5 intentos y 15 min de bloqueo; sin correo (el Administrador restablece contraseñas) | `autenticacion-y-matriz-permisos` (RNF-012) | B |
| G13 | ¿Quién puede revertir una carga o una edición ajena? ¿Existe obligación de anonimizar datos personales (donantes, comodantes) a solicitud del titular (Ley 29733)? | Revierte el autor (ediciones manuales), `imports.revert` (cargas) o el Administrador; anonimización fuera de alcance hasta definición legal | `auditoria-y-soft-delete-transversal` (RNF-007, RNF-014) | B |
| G14 | Datos de la VM PUCP: sistema operativo, CPU/RAM/disco, dominio, certificado, acceso SSH, destino externo para respaldos, canal de alertas; objetivo de recuperación aceptable (pérdida máxima de datos y tiempo máximo sin servicio) | RPO 24 h, RTO 4 h, respaldo diario con 30 días de retención, simulacro mensual; alertas por webhook o correo. Dato para el dimensionamiento (2026-10-20): un escaneo completo de duplicados con 20 000 piezas usó unos 4,7 GB de memoria y 30,7 min de un núcleo con el puntaje mínimo actual; ver O2 | `despliegue-vm-y-respaldos` (RNF-011, RNF-002) | A |
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

Fuente: `docs/fuentes/endpoints-api-v1.yaml`. Mapeo operación por operación y conflictos C1 a C6: `docs/api/mapeo-endpoints-v1.md`. Change que ejecuta la alineación: `alinear-api-endpoints-v1`. Preguntas **internas del equipo** (Arquitecto e Integradores), salvo I2 y la segunda parte de I3, que necesitan la respuesta del museo. **Estado al 2026-09-29**: el equipo decidió los conflictos C1 a C6 (`openspec/changes/alinear-api-endpoints-v1/design.md`, D7), pendientes del visto bueno del Arquitecto en el PR. La decisión de C4 también responde H1 (el código I sigue en `piece_identifier`), H2 (matriz de roles) y H3 (vocabularios). I2, la segunda parte de I3 e I5 siguen abiertas.

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| I1 | El documento usa su propia numeración de requisitos, distinta de `docs/requisitos/catalogo.md` (en el documento RF-041 es el login; en el catálogo, la restricción de campos sensibles). ¿Cuál es la numeración oficial? | Las specs y los 15 changes siguen citando el catálogo; el mapeo registra la correspondencia — **Resuelta internamente (2026-09-29)**: `docs/requisitos/catalogo.md` es la numeración oficial; el mapeo añade la columna de equivalencias con las etiquetas del documento; no se renumera nada (D7-C1) | Trazabilidad de las 12 specs y los 15 changes | A |
| I2 | `GET /public/catalog` es un endpoint abierto sin autenticación. ¿Entra en la fase 1, pese a que RF-042 y `CLAUDE.md` dicen «solo uso interno, nada público»? ¿Qué campos serían públicos con comodato y Ley 29733 de por medio? | `[SUPUESTO]` No hay catálogo público en la fase 1: la operación no se implementa ni se expone (ni como stub) y sigue en `BLOQUEADAS` en la prueba de conformidad (D7-C2, 2026-09-29). **Abierta para el museo**: si en el futuro se quiere un catálogo de lectura para investigación, ¿qué campos serían públicos, qué piezas quedan excluidas (comodatos con restricción, ubicación exacta, donantes) y quién autoriza la publicación? | `busqueda-reportes`, nuevo change de catálogo público (RF-042, RN-008, RNF-014) | A |
| I3 | `DELETE /pieces/{id}/identifiers/{identifier_id}` habla de «remover» un código. ¿Se acepta implementarlo como baja lógica (queda en el historial y la auditoría) para respetar RN-005? | Baja lógica; 409 si el identificador es de tipo I (RN-002) — **Resuelta internamente (2026-09-29)**: baja lógica con motivo obligatorio; queda en el historial y la auditoría (D1, D7-C3). **Abierta para el museo**: ¿quién puede dar de baja un código histórico secundario (p. ej. un INC mal transcrito) y qué motivo o documento lo respalda? `[SUPUESTO]` quien tiene permiso de edición de identificadores, con motivo en texto libre | `ficha-pieza-crud` (RN-002, RN-005) | A |
| I4 | ¿Los valores de enumerado en español (`Propiedad`, `Comodato`, `Préstamo Temporal`) se guardan así en la base o solo se traducen en la frontera de la API? | Traducción en la frontera; la base conserva códigos en inglés (ADR-002) — **Resuelta internamente (2026-09-29)**: se ratifica la traducción en la frontera (`app/api/enums.py`); el régimen de tenencia no pasa a vocabulario porque sostiene RN-003 y RN-004 (D7-C5) | Transversal | B |
| I5 | El documento no incluye 62 operaciones que la API ya expone (aprobación de sugerencias de IA, cola de duplicados, vocabularios, plantillas de mapeo, restauración de piezas…). ¿Se conservan como añadidos o hay que eliminarlas? | Se conservan y quedan declaradas como añadidos justificados | Transversal (RN-005, RN-009, RN-010, RF-030) | A |
| I6 | El documento menciona AWS S3 y un staging en AWS Academy; ADR-007 y ADR-011 asumen MinIO en local, Cloudflare R2 de contingencia y la VM de la PUCP. ¿Qué se usa en staging? | MinIO en local y VM de la PUCP; S3 es compatible por API — **Resuelta internamente (2026-09-26)**: AWS Academy es el entorno de integración/staging, con RDS + S3 gestionados, EC2 y el mismo overlay de Compose de producción (sin `db` ni `storage`); ver **ADR-013** | `despliegue-vm-y-respaldos` (RNF-002) | B |
| I7 | `ImportBatchSummary` tiene tres contadores (`summary.new_records`, `summary.updates`, `summary.conflicts`), pero el pipeline clasifica cada fila en cuatro categorías (`NEW`, `UPDATE`, `POSSIBLE_DUPLICATE`, `CONFLICT`). ¿Cómo se agrupan en los tres contadores del resumen? | **Abierta (2026-10-18)**. [SUPUESTO provisional, 2026-10-19] Mientras se responde, `new_records` = `NEW`, `updates` = `UPDATE` y `conflicts` = `CONFLICT`; `POSSIBLE_DUPLICATE` no se suma a ningún contador. `POST /imports/upload` responde antes de leer el archivo, así que hoy los tres valen 0 en esa respuesta | `importacion-pipeline-reconciliacion` (RF-021, RF-026) | A |
| I8 | ¿Qué valores en español toma el `status` del lote de importación en la API, y cómo se corresponden con los estados internos de `ImportBatchStatus`? | **Abierta (2026-10-18)**. [SUPUESTO provisional, 2026-10-19] Mientras se responde, `status` lleva el código interno (`UPLOADED`, `FAILED_INGESTION`…), igual que `ImportBatchOut.status` | `importacion-pipeline-reconciliacion` (RF-021, RF-027) | A |
| I9 | ¿Cuál es el cuerpo definitivo de `POST /imports/{batch_id}/confirm` (aprobación total, por fila o con exclusiones)? | **Abierta (2026-10-18)**. [SUPUESTO provisional, 2026-10-21] Aprobación total del lote con `summary_token` (obligatorio) y `confirm_counts` y `comment` opcionales; las exclusiones se deciden antes, fila por fila (M6, M7) | `importacion-pipeline-reconciliacion` (RF-027) | A |

## J. Sistema de diseño del frontend (2026-09-23)

Fuente: `docs/fuentes/system-design-frontend.md` (documento del equipo). Change: `sistema-diseno-frontend`. Decisión: ADR-012. J1 y J2 son para el museo (Dirección de Cultura); J3 es interna del equipo (Arquitecto).

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| J1 | ¿Los colores Terracota (`#A23C16`), Tinta (`#0C0F14`) y Crema (`#F5F0DA`) y las tipografías Poppins e Inter corresponden a la identidad visual oficial del museo o de la Dirección de Cultura? ¿Hay un manual de marca? | Se usan los valores del documento del equipo, declarados como tokens para poder cambiarlos en un solo lugar | `plataforma` (RNF-004, RNF-010) | C |
| J2 | ¿Hay un logotipo autorizado del MATP o de la PUCP para la barra lateral de una herramienta interna? | Solo el texto «MATP · Colecciones», sin logotipo | `plataforma` | C |
| J3 | ¿Los nombres de los tokens de color se mantienen en español (`terracota`, `tinta`, `crema`) como en el documento o se traducen al inglés (ADR-002)? | Se mantienen en español porque nombran la identidad visual | Interna (ADR-002, ADR-012) | C |

## K. Préstamos y exposiciones (change `prestamos-y-exposiciones`, 2026-09-28)

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| K1 | ¿Cuáles son los tipos y estados permitidos de préstamos y exposiciones, qué datos mínimos exige el acta (institución/sala, responsable, referencia) y qué restricciones contractuales deben verificarse antes de confirmar? | **[SUPUESTO autorizado por Álvaro, 2026-09-30]** Tipos iniciales: `PRESTAMO_TEMPORAL`, `EXPOSICION`; estados: `BORRADOR`, `VIGENTE`, `CERRADO`, `CANCELADO`. El acta exige destino, fechas, piezas y referencia documental opcional. Una pieza en comodato no se confirma sin `loan_agreement_ref`. Todo es configurable/reversible y debe validarse en la reunión. | `prestamos-y-exposiciones` (RF-018, RF-020, RN-008) | B |

## L. Validación del prototipo v3 y revisión de los archivos del cliente (2026-10-07)

Surgen de la reunión en la que se mostró el prototipo v3 al MATP y de revisar **solo la estructura** (hojas, columnas, formatos y vocabularios) de las bases entregadas por el museo (`BD ESTANDARIZADAS AL 2025`, fichas AJB, colección FJT). Ningún dato real se copió al repositorio.

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| L1 | ¿Cómo están nombrados hoy los archivos y carpetas de fotos? Basta un pantallazo de una carpeta, sin las imágenes. (Amplía C1; el museo respondió que no lo sabe) | Emparejamiento en tres vías: código en el nombre del archivo, código en el nombre de la carpeta o columna de archivo en el Excel; el resto va a una bandeja manual — **Sigue abierta (2026-10-22)**: el museo aún no respondió. Lo implementa `importacion-masiva-fotografias` (D3) | importacion-datos (RF-045), multimedia (RF-013) | A |
| L2 | ¿Qué cuota de almacenamiento en la nube ofrece la PUCP y hay que conservar los originales de las fotos? (≈ 10 000 piezas y ≈ 25 000 fotos, según el museo) | `MEDIA_KEEP_ORIGINALS=true` hasta confirmar; sin originales el volumen baja de 75–200 GB a ≈ 8 GB — **Sigue abierta (2026-10-22)**: mientras no se conozca la cuota, `MEDIA_QUOTA_BYTES` queda sin valor y no se avisa de cuota; las fotos de lotes abandonados o descartadas se borran a los `IMPORT_PHOTO_RETENTION_DAYS=30` días (`importacion-masiva-fotografias`, D6 y D7) | multimedia (RNF-003), plataforma (RNF-002) | A |
| L3 | ¿Cuánto pesa una foto típica y en qué formato está (JPEG, TIFF, RAW)? | JPEG de 3 a 8 MB; RAW y HEIC fuera de alcance — **Sigue abierta (2026-10-22)**: el lote acepta JPEG, PNG y TIFF (`MEDIA_ALLOWED_TYPES`) y hasta `IMPORT_MAX_PHOTOS=5000` fotos por lote; las ≈ 25 000 fotos se cargan en varios lotes | multimedia (RF-013, RNF-003) | B |
| L4 | ¿El nombre de los archivos permite distinguir el tipo de vista (frontal, posterior, detalle)? | No; las fotos importadas quedan con vista «sin especificar» — **Sigue abierta (2026-10-22)**: si el museo usa sufijos de vista en los nombres (`_frontal`), el emparejamiento ya los quita y una versión posterior podría proponer la vista (`importacion-masiva-fotografias`, D3) | multimedia (RF-013) | C |
| L5 | Las bases usan como forma de adquisición **Donación**, **Compra**, **Cesión de uso** y **Custodia**. ¿«Cesión de uso» y «Custodia» equivalen a comodato (sin código I y con restricciones) o son otro régimen de tenencia? | Sin supuesto: el contrato solo conoce `Propiedad`, `Comodato` y `Préstamo Temporal` | catalogo-piezas (RF-005), identificacion-piezas (RN-003) | A |
| L6 | ¿La **clasificación del Registro Nacional** (Contemporáneo, Republicano, Virreinal; Etnográfico, Indumentaria…) y la **situación** (habida / no habida) deben ser campos de la ficha? | No existen como campos; se conservan como datos de origen de la importación | catalogo-piezas (RF-006), importacion-datos (RF-021) | B |
| L7 | «No presenta» aparece como valor vacío en casi todas las columnas. ¿Se puede tratar siempre como «sin dato»? | Sí, se normaliza a vacío junto con los marcadores de A5 | importacion-datos (RF-023), calidad-datos | B |
| L8 | Las hojas «Errores identificados» y «Errores pendientes» de la consultoría, ¿deben cargarse como cola de revisión inicial del sistema? | Se cargan como observaciones de origen, sin crear alertas automáticas | calidad-datos, importacion-datos (RF-028) | C |

## M. Supuestos de la ingesta, el mapeo y la previsualización (change `importacion-pipeline-reconciliacion`, 2026-10-19)

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| M1 | El formulario de subida del contrato solo tiene `file`. ¿Cómo se nombra la **fuente** del lote (consultoría 2024/25, inventario de depósito…)? | Se usa el nombre del archivo como nombre de la fuente | importacion-datos (RF-028) | B |
| M2 | Un archivo que supera `IMPORT_MAX_BYTES` (50 MB, ver G6), ¿debe quedar registrado como lote fallido? | Se rechaza con 422 `file_too_large` sin crear lote ni guardar el archivo; un formato no admitido o un exceso de filas sí deja el lote «fallido en ingesta» | importacion-datos (RF-021, RF-028) | C |
| M3 | Al subir un Excel con varias hojas, ¿cuál se lee por defecto? | La primera hoja; el usuario elige otra hoja o fila de cabeceras en el mapeo y el archivo original se vuelve a leer | importacion-datos (RF-021) | C |
| M4 | ¿Qué valores de la columna de régimen de tenencia traen las sábanas? | Se aceptan `Propiedad`/`Propio`, `Comodato` y `Préstamo Temporal` (sin distinguir mayúsculas ni tildes) y los códigos del sistema; cualquier otro valor es un error de la fila. Si el archivo no tiene esa columna, el mapeo admite un valor por defecto | importacion-datos (RF-022), catalogo-piezas (RF-005) | A |
| M5 | Una celda con varios códigos (`I-0236 / M.M.Z. 015`), ¿siempre trae códigos de tipos distintos? | Al marcar la columna como compuesta, cada parte toma el tipo que se reconoce en ella (N7); la parte que no se reconoce toma el tipo de la columna o, si no tiene, `OTRO` | importacion-datos (RF-023, RF-024) | B |
| M6 | En un lote de miles de filas, ¿hay que aceptar fila por fila antes de aprobar? | No (2026-10-21, decisiones D5): las filas nuevas y las actualizaciones sin decisión se aplican con la aprobación del lote, que muestra el resumen exacto. Las rechazadas, excluidas, con errores de validación y los conflictos o posibles duplicados **sin resolver** no se aplican y quedan en la bitácora con su motivo | importacion-datos (RF-021, RF-027) | A |
| M7 | ¿Qué confirma exactamente la persona que aprueba? | El resumen «se crearán N piezas, se actualizarán M y K filas no se aplicarán». La aprobación envía su huella (`summary_token`); si otra persona cambió decisiones y los conteos ya no coinciden, se rechaza (409) y se muestra el resumen nuevo. Si solo cambian decisiones sin cambiar los conteos, la huella no cambia | importacion-datos (RF-027, RNF-010) | B |
| M8 | Al resolver un conflicto eligiendo una pieza, ¿se puede cambiar su código I con el del Excel? | No (RN-002): si la fila trae un código I distinto del de la pieza elegida, se rechaza la resolución. Una fila cuyo código I ya pertenece a una pieza del catálogo tampoco puede crearse como pieza nueva: se elige esa pieza o se rechaza la fila | importacion-datos (RF-025, RN-002) | B |
| M9 | ¿Quién asocia las imágenes incrustadas en el Excel y en qué formato? | Quien tiene el permiso de subir fotos (Catalogador, Conservación, Gestor de colecciones y Administrador), después de aplicar el lote y una por una. Solo se registran JPEG, PNG y TIFF (como en `fotografias-multiples-por-pieza`); una imagen de otro formato queda en la bandeja. En una pieza en comodato la foto hereda la restricción «No publicar» (RN-008) | importacion-datos (RF-029), multimedia (RF-013, RN-008) | B |
| M10 | ¿Cuándo se puede revertir un lote aplicado? | **Pendiente**: la reversión (tarea 5.2) espera el motor de reversión de `auditoria-y-soft-delete-transversal`. El lote ya guarda el conjunto de cambios de su aplicación (`import_batch.change_set_id`) para revertirlo cuando ese motor exista | importacion-datos (RNF-007) | A |

## N. Excepciones a «nunca se borra información» (change `auditoria-y-soft-delete-transversal`, 2026-10-20)

Preguntas **internas del equipo**: las levanta la verificación transversal de la tarea 1.1 (`app/core/cross_cutting.py`, `apps/api/tests/test_cross_cutting_rules.py`). Las siete tablas sin borrado lógico están justificadas en esa lista; estas dos son deuda con dueño, no excepciones definitivas. Retirar una excepción es trabajo de la célula dueña, no de Plataforma.

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| N1 | `quality_setting` se actualiza en sitio y desactivar un parámetro borra su fila. ¿Los parámetros de calidad llevan borrado lógico con motivo, como el resto de los datos configurables (RN-005, RN-010)? | Excepción con deuda: se audita cada cambio, pero la fila se puede borrar | `deteccion-duplicados-y-cola-revision` (parámetros de calidad) | B |
| N2 | Descartar una sugerencia de IA, ¿es un estado `REJECTED` o un borrado lógico con motivo? Hoy la sugerencia nunca se borra, pero `ai_suggestion` no tiene columnas de borrado lógico. | Excepción con deuda: estado `REJECTED` auditado (RN-009) | `ia-extraccion-texto-libre` | C |
| N3 | El pipeline de importación borra físicamente `import_row`, `duplicate_candidate` e `import_image` (las imágenes aún sin asociar, que se vuelven a extraer) al volver a mapear o validar un lote (llamadas autorizadas en `PHYSICAL_DELETE_EXCEPTIONS`; `idempotency_key`, de las operaciones por lote de ubicaciones, también figura como excepción técnica). ¿Se acepta, dado que lo que entra al catálogo queda en `piece_source_record` (solo inserción) y cada decisión queda auditada? | Autorizado y documentado, con la lista revisada por el Arquitecto | `importacion-pipeline-reconciliacion` | A |

## Ñ. Supuestos de la reversión, la papelera y la integridad (change `auditoria-y-soft-delete-transversal`, 2026-10-20)

Preguntas **internas del equipo**: las decide el Arquitecto en la revisión del PR, salvo Ñ5, que necesita criterio legal. Las excepciones a «nunca se borra información» están aparte, en la sección N.

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| Ñ1 | ¿Quién puede revertir según el origen del conjunto de cambios? | [SUPUESTO B7] edición manual → `pieces.update`; importación → `imports.revert`; cualquier otro origen → Administrador | `auditoria-y-soft-delete-transversal` (RNF-007) | A |
| Ñ2 | Revertir un conjunto que corrigió un código I, ¿exige además rol Administrador, o basta el permiso de corrección? Hoy el Gestor tiene ese permiso en la matriz sintética y el escenario de la spec pide 403. | Exige el permiso de corrección **y** rol Administrador, igual que la corrección directa | `autenticacion-y-matriz-permisos` (RN-002) | A |
| Ñ3 | La papelera usa `pieces.restore` porque no existe un permiso propio: ¿se crea `trash.read` para que Conservación o Consulta interna puedan mirar sin restaurar? | Administrador y Gestor abren la papelera; restaurar solo Administrador | `autenticacion-y-matriz-permisos` (RF-039) | B |
| Ñ4 | El CSV de auditoría sale con cabeceras en inglés (los nombres de campo del JSON) y BOM UTF-8. ¿Se quieren cabeceras en español para quien lo abra en Excel? | Cabeceras en inglés, separador coma, BOM UTF-8 | `busqueda-avanzada-y-exportacion` (RF-036) | B |
| Ñ5 | Ley 29733: si un titular pide la supresión de sus datos personales, ¿cómo se cumple sin romper la auditoría de solo inserción? Queda fuera de este change y necesita definición legal. | Sin mecanismo de anonimización; la auditoría no se altera | Nuevo change por proponer (RNF-014) | A |
| Ñ6 | El resumen diario de integridad se calcula por día en UTC y solo sella días cerrados. ¿Se acepta, o el museo espera el día en hora de Lima? | Día en UTC, solo días cerrados | `despliegue-vm-y-respaldos` (programación diaria) | B |

## O. Supuestos de la detección de duplicados y la fusión (change `deteccion-duplicados-y-cola-revision`, 2026-10-20)

Se usa la letra O porque N1–N7 ya nombran las reglas de normalización. El máximo para posponer (180 días) y el rechazo de la fusión con regímenes distintos siguen en G8. Detalle en `openspec/changes/archive/2026-10-20-deteccion-duplicados-y-cola-revision/design.md` (D1, D4, D5, D6 y D7).

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| O1 | ¿Qué datos pesan más para sospechar que dos registros son la misma pieza? | Pesos por señal: código I igual 0,45; otro identificador igual del mismo tipo (colección, INC/RN, PUCP, propietario u otro) 0,35; denominación parecida 0,30; autor y procedencia 0,15; misma colección o subcolección 0,10; épocas que se superponen 0,10; medidas compatibles (±5 %) 0,10. El puntaje suma peso × similitud con tope 1; un dato ausente no suma ni resta. Se cambian sin tocar código (`quality_setting`, clave `duplicates.scoring`) | calidad-datos (RF-030, RNF-015) | A |
| O2 | ¿Desde qué similitud se propone un par para revisión? | 0,6 (60 %). Un par que comparte un identificador normalizado entra siempre, aunque quede por debajo; sin identificador compartido llega como máximo a 0,75 y solo entra si coinciden varias señales. En el seed se detectan los 10 pares sembrados (0,80 a 0,90) y entran 7 de los 1 508 pares evaluados sin identificador compartido. Se calibra con la muestra A1 y con la prueba de 20 000 piezas en PostgreSQL. **Decisión pendiente (prueba de volumen del 2026-10-20, design D7)**: con 20 000 piezas sintéticas y 0,6, el escaneo completo tardó 30,7 min y dejó 116 949 pares en la cola (unos 5,8 por pieza), porque el seed repite 48 denominaciones; con 0,65 entrarían unos 68 700 y con 0,7 unos 5 800. Los umbrales de trigramas casi no cambian la cola: la palanca es este puntaje. Falta elegir el valor con la muestra real A1; mientras tanto sigue 0,6. Para G14: con 0,6, el escaneo llegó a unos 4,7 GB de memoria en el proceso de la API y ocupó un núcleo durante media hora; una cola más pequeña reduce la escritura, pero no se midió con otro valor | calidad-datos (RF-030, RNF-015), dimensionamiento de la VM (G14) | A |
| O3 | ¿Cómo se escribe hoy «autor desconocido» en las bases? ¿Dos piezas de «Anónimo» cuentan como del mismo autor? | No: «Anónimo», «Anónima», «Autor anónimo», «Desconocido», «Desconocida», «Autor desconocido», «No presenta» (L7), «Sin autor» y los marcadores de «sin código» de A5 son **autor ausente**: no suman en la señal de autor y procedencia, no forman el bloque autor + procedencia ni entran en la huella de comparación | calidad-datos (RF-030) | B |
| O4 | Si se elimina (sin fusionar) una pieza de un par pendiente, ¿el par debe salir solo de la cola? | **Pendiente**: hoy el par sigue en la cola, y cuenta como pendiente, hasta que alguien intenta resolverlo; entonces se responde que fue reemplazado, queda «Reemplazado» y no cambia ninguna pieza. Propuesta: retirarlo al eliminar la pieza (detección incremental o `auditoria-y-soft-delete-transversal`) y reabrirlo si la pieza se restaura | calidad-datos (RF-030), conteo de pendientes de `alertas-y-reporte-incompletas` | C |
| O5 | Si solo una de las dos piezas tiene código I vigente, ¿se puede conservar la otra y pasarle el código? | No: se conserva la pieza con código I, porque un código I nunca cambia de pieza (RN-002); si ambas tienen códigos I vigentes distintos, la fusión se rechaza hasta corregir uno con el procedimiento auditado. Movimientos, datos de origen y evaluaciones de conservación se quedan en la pieza absorbida y se consultan desde la conservada | calidad-datos (RF-030, RN-002, RN-005) | B |

## P. Supuestos de la jerarquía de ubicaciones y los movimientos en lote (change `ubicacion-jerarquica-y-movimientos`, 2026-10-21)

Detalle en `openspec/changes/ubicacion-jerarquica-y-movimientos/design.md` (D1, D3, D4, D5).

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| P1 | ¿Hay cajas o piezas apoyadas directamente en el piso de un depósito, sin pasar por un mueble o rack? | No: un Contenedor solo puede colgar de un Nivel o directamente de un Mueble; nunca de un Espacio/Depósito. Si la contraparte confirma cajas en el piso, se agrega el nivel Depósito a los padres permitidos de Contenedor en `app/modules/locations/hierarchy.py` (tabla `ALLOWED_PARENT`), sin tocar el resto de la lógica | ubicacion-movimientos (RF-016), relacionado con A7 | B |
| P2 | ¿Qué tipos de espacio existen además de depósito y sala de exhibición (por ejemplo, taller de restauración, archivo documental, área de recepción)? | Depósito, Sala de exhibición, Taller u Otro; "Otro" no propone ni exige ninguna disponibilidad en particular | ubicacion-movimientos (RF-020) | B |
| P3 | Al reubicar un mueble o contenedor completo (cambiar de qué depósito depende), ¿debe quedar algún aviso especial en el historial de cada pieza, más allá del motivo de texto "Reubicación de <código>"? | No: por ahora basta un movimiento con ese motivo y una referencia común a la reubicación (para poder agruparlos si se pide un reporte); ninguna pantalla de reportes los distingue todavía de un movimiento manual | ubicacion-movimientos (RF-017), reportes-inventario (pendiente) | C |
## Q. Supuestos de la búsqueda avanzada y exportaciones (change `busqueda-avanzada-y-exportacion`, 2026-10-22)

Detalle en `openspec/changes/busqueda-avanzada-y-exportacion/design.md` (D3, D4, D5).

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| Q1 | ¿A partir de cuántos registros una exportación a Excel debe pasar a segundo plano en vez de descargarse inmediatamente? | Se fijó el umbral síncrono en 5 000 filas (`EXPORT_SYNC_MAX_ROWS = 5000`). Búsquedas con hasta 5 000 piezas devuelven el archivo Excel en la misma petición HTTP en streaming con memoria acotada. Consultas con más de 5 000 piezas encolan un trabajo asíncrono (`export_job`, HTTP 202) que el usuario puede monitorear y descargar desde "Mis exportaciones" para no bloquear la conexión ni agotar tiempos de espera del navegador o proxy | busqueda-exportacion (RF-036, RNF-014) | B |
| Q2 | ¿Cuánto tiempo deben permanecer disponibles los archivos generados de exportación antes de caducar? | Los archivos generados expiran a las 24 horas (`EXPORT_TTL_HOURS = 24`, configurable hasta 72 h). Pasado este plazo, el enlace de descarga devuelve HTTP 410 Gone y el archivo físico o del almacenamiento de objetos se purga. El registro histórico del trabajo en la base de datos se conserva indefinidamente con fines de auditoría y trazabilidad | busqueda-exportacion (RF-036, RNF-014) | B |
| Q3 | ¿Quiénes tienen permiso para descargar la exportación completa de la base de datos (paquete ZIP con CSVs, Excel, diccionario y manifiesto)? | Únicamente los usuarios con rol Administrador (permiso `exports.full`). Los usuarios con rol Gestor o Catalogador solo pueden exportar resultados de búsqueda o reportes con el permiso estándar `exports.run`, garantizando el resguardo de la base de datos completa y previniendo extracciones masivas no autorizadas | busqueda-exportacion (RF-044, RF-041) | A |

## R. Supuestos de la autenticación y los permisos (change `autenticacion-y-matriz-permisos`, 2026-10-22)

Detalle en `docs/adr/ADR-009-autenticacion-sesiones.md` y `openspec/changes/autenticacion-y-matriz-permisos/design.md`. Amplía C7.

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| R1 | ¿Cuánto debe durar una sesión sin actividad y cuánto como máximo? | 30 minutos de inactividad y 12 horas de duración absoluta (`SESSION_IDLE_MINUTES`, `SESSION_MAX_HOURS`) | usuarios-roles (RNF-012) | Media |
| R2 | ¿Cuántos intentos fallidos bloquean una cuenta y por cuánto tiempo? | 5 intentos seguidos y 15 minutos (`LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCK_MINUTES`); además 20 intentos en 5 minutos por dirección | usuarios-roles (RNF-012, RNF-013) | Media |
| R3 | ¿Qué política de contraseñas exige el museo o la PUCP? | Mínimo 12 caracteres, sin exigir composición, rechazo de contraseñas comunes y de la igual al correo; el Administrador entrega una contraseña temporal de cambio obligatorio | usuarios-roles (RNF-013) | Media |
| R4 | ¿Cuánto tiempo se conservan los registros de inicio de sesión y de acceso a datos sensibles? | Sin vencimiento en la fase 1 (nunca se borran, RN-005); la retención y la anonimización bajo la Ley 29733 se deciden con la PUCP | usuarios-roles (RNF-014) | Alta |
| R5 | ¿Quién puede consultar el registro de accesos a datos sensibles? | Quien tenga el permiso `audit.read` (hoy el Administrador) | usuarios-roles (RF-041) | Media |
| R6 | ¿Hay un servicio de correo institucional para recuperar contraseñas olvidadas? | No: la recuperación es que un Administrador restablezca la contraseña temporal. Sin correo, sin doble factor en la fase 1 | usuarios-roles (RNF-012) | Media |
| R7 | ¿Cuándo se podrá iniciar sesión con la cuenta PUCP y con qué protocolo (OIDC)? | Solo se prepara la interfaz de proveedor y el campo `external_subject`; los roles siguen siendo locales | usuarios-roles (RNF-012) | Baja |

## S. Supuestos del emparejamiento de fotografías del lote (change `importacion-masiva-fotografias`, 2026-10-22)

Detalle en `openspec/changes/importacion-masiva-fotografias/design.md` (D3) y en `apps/api/app/modules/imports/photo_matching.py`. Mientras el museo no responda L1, las reglas se ajustan con sus primeras carpetas reales.

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| S1 | Una foto nombrada solo con un número (`245.jpg`), ¿a qué código corresponde? | Se compara con los códigos I, INC/RN, PUCP, del propietario y otros, y también con el correlativo de los códigos de colección del lote (`MMZ 245` → `245`). Si coincide con más de una fila, la foto queda ambigua y nunca se asigna por adivinanza; la decide una persona en la bandeja | importacion-datos (RF-045, RF-023) | A |
| S2 | ¿Hay fotos con el nombre que pone la cámara (`IMG_20190312.jpg`, `DSC_0001.jpg`)? | Un nombre de cámara no aporta código: la foto se empareja por su carpeta o por la columna del Excel, y si no, va a la bandeja de sin emparejar | importacion-datos (RF-045) | B |
| S3 | ¿Cómo se distinguen varias fotos de una misma pieza en el nombre? | `(2)`, `_2`, `-a`, `copia` y las palabras de vista (`_frontal`, `_posterior`…) son sufijos: ordenan las fotos de la pieza y no forman parte del código. Un número que la hoja de cálculo escribió como `1234.0` se lee como `1234`. Un `-a` o `_2` corto también puede ser parte del código (componente `MBB 40-a`), así que primero se prueba el nombre completo | importacion-datos (RF-045, RF-023) | B |

## T. Supuestos de las plantillas de mapeo y la normalización (change `plantillas-mapeo-y-normalizacion`, 2026-10-21)

Detalle en `openspec/changes/plantillas-mapeo-y-normalizacion/design.md` (D1–D5).

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| T1 | ¿Desde qué parecido entre cabeceras conviene sugerir una plantilla guardada? | Puntaje `0,5 × Jaccard + 0,5 × similitud promedio por cabecera` (`difflib.SequenceMatcher`), sobre cabeceras sin tildes ni diferencias de mayúsculas; las cabeceras de una plantilla son las columnas de origen de su mapeo; se sugiere desde 0,6. Coincidencia exacta de cabeceras = 1. Se calibra con la muestra A1 | importacion-datos (RF-022) | C |
| T2 | ¿Cuántas plantillas sugerir para un archivo? | Hasta 3, ordenadas por puntaje | importacion-datos (RF-022) | C |
| T3 | ¿Sobre cuántas filas mostrar la vista previa de normalización por columna? | Hasta 200 filas del lote | importacion-datos (RF-023, RNF-010) | C |
| T4 | ¿Cuántos valores sin término de vocabulario mostrar por columna en la vista previa? | Los 20 más frecuentes, con su número de apariciones. Se agrupan sin distinguir mayúsculas, tildes ni espacios repetidos («maguey» y «Maguey» son uno) y se muestran con su escritura más frecuente | importacion-datos (RF-011) | C |
| T5 | ¿En qué formatos vienen las fechas y las medidas en las sábanas? | Fechas `dd/mm/yyyy` y `yyyy` (sin adivinar formatos ambiguos; una celda que Excel ya guarda como fecha se toma tal cual). Medidas como `alto 23 cm` o `23 x 15 cm`, en centímetros, con decimales separados por punto o coma; la interpretación es solo una propuesta y el texto original se conserva | importacion-datos (RF-006, RF-023), relacionado con B9 | B |
| T6 | ¿Qué materiales usa el museo y cómo se escriben en las fuentes (p. ej. «madera policromada»)? | Vocabulario `MATERIAL` sembrado (Madera, Arcilla, Lana, Algodón…) y correspondencias de ejemplo; un valor sin correspondencia va a los datos de origen y nunca crea un término. Valores, términos y correspondencias se comparan sin distinguir mayúsculas, tildes ni espacios repetidos. Por ahora las correspondencias solo se muestran en la vista previa: al aplicar la carga, el texto de la columna se conserva en los datos de origen y la ficha no recibe términos | importacion-datos (RF-011, RN-010), relacionado con B5 | B |
| T7 | ¿Qué medidas se registran por pieza (alto, ancho, profundidad, diámetro, peso…) y en qué unidad? | `dimensions` es una lista de `{dimension, value, unit}` con unidad `cm` por defecto; `dimensions_text` conserva el texto original. En medidas sin etiqueta (`23 x 15 cm`) no se supone cuál es el alto y cuál el ancho: se proponen sin nombre. Por ahora las propuestas de medidas y de época solo se muestran en la vista previa y no se guardan en la ficha | catalogo-piezas (RF-006), importacion-datos (RF-023) | B |
| T8 | ¿Quién puede crear, editar y eliminar plantillas de mapeo, y quién cambia los marcadores de ausencia, los separadores y los alias de siglas? | Crear, editar, sugerir y ver la vista previa: Catalogador, Gestor de colecciones y Administrador. Eliminar una plantilla: Gestor de colecciones y Administrador. Parámetros de normalización y alias, también para consultarlos: Gestor de colecciones y Administrador. Se usan los permisos que ya existen en la matriz sembrada (`imports.prepare`, `imports.approve` y `vocabularies.manage`); lo supuesto es a qué operación se asigna cada uno | importacion-datos (RF-022), identificacion-piezas (RF-023), relacionado con B7 | B |
| T9 | ¿Dos plantillas pueden llamarse igual (p. ej. una por cada versión de la misma sábana)? | No entre plantillas activas, sin distinguir mayúsculas ni tildes; una plantilla eliminada libera el nombre | importacion-datos (RF-022) | C |
| T10 | ¿Qué hacer cuando un cambio de marcadores, separadores o siglas históricas alteraría códigos ya registrados? | Mientras no exista el recálculo con vista previa y confirmación (`colecciones-y-vocabularios-admin`), el cambio se rechaza indicando cuántos identificadores cambiarían y algunos ejemplos, y no se guarda nada. Un identificador cambia si su texto se normalizaría distinto, se separaría distinto o vino de una celda de importación que dejaría de separarse igual. No se admite el espacio como separador (partiría códigos como `I 236`). Una sigla histórica no puede ser la sigla actual de ninguna colección | identificacion-piezas (RF-023, RN-010), relacionado con A5, A8 y A3 | B |
| T11 | En la vista previa por columna, ¿qué debe contarse como «no normalizable»? | Cada celda no vacía recibe un solo estado: «separación propuesta» si da varios valores, «marcador de ausencia» si dice «sin código», «no normalizable» si un código no tiene formato reconocido, un valor no tiene término, una transformación falla o la época o la medida no se reconoce, y «normalizado» en los demás casos. Una época o medida no reconocida conserva su texto: solo cuenta como no normalizable en la vista previa | importacion-datos (RF-023, RNF-010) | C |
| T12 | ¿Cuándo una barra `/` separa dos códigos y cuándo forma parte de un marcador (`S/N`, `S/C`)? | Se mantiene la regla anterior del normalizador: una barra precedida de `S` o seguida de `N` o `C` no separa. Por eso `I-1 / N/A` se separa en `I-1 / N` y `A`. Un marcador que no se separa con más de una letra a cada lado (p. ej. `SIN/COD`) se compara sin distinguir mayúsculas | identificacion-piezas (RF-023), relacionado con A8 y T10 | C |

**Pendiente interno (no es pregunta al museo):** restaurar una plantilla desde la papelera no comprueba que su nombre siga libre entre las activas (T9), así que puede quedar un nombre repetido. La comprobación corresponde a `apps/api/app/modules/audit/trash.py` (change `auditoria-y-soft-delete-transversal`), no a `plantillas-mapeo-y-normalizacion`.

**Pendiente interno (no es pregunta al museo):** la clasificación de filas (`apps/api/app/modules/imports/classify.py`) valida la fila con el régimen de tenencia que viene del valor por defecto del mapeo, aunque la fila actualice una pieza existente cuyo régimen no cambia. Así, un default `Comodato` en una fila con código I que actualiza una pieza propia da un falso error RN-003, y un default `Propiedad` en una fila que añade un código I a una pieza en comodato pasa la validación y hace fallar la aplicación de todo el lote por RN-003. Corresponde a `importacion-pipeline-reconciliacion`, no a `plantillas-mapeo-y-normalizacion` (que ya evita que el default entre en la comparación y sobrescriba la pieza).

**Pendiente interno (no es pregunta al museo):** el emparejamiento de fotos por nombre de archivo (`apps/api/app/modules/imports/photo_matching.py`) sigue normalizando con los valores de código y no con los parámetros vigentes (tarea 2.2, design D5): una foto llamada con una sigla histórica (p. ej. `REP 12.jpg`, con el alias sintético `REP` → `LRM`) no se reconoce como código de la colección `LRM`, aunque la búsqueda y el matching de importación sí lo hagan. Es una mejora posible que corresponde a `importacion-masiva-fotografias`, no a `plantillas-mapeo-y-normalizacion`; basta con pasar los parámetros de la sesión (`session_params`) a `normalize`.

**Pendiente interno (no es pregunta al museo):** al escribir las pruebas de punta a punta de la tarea 2.2 se encontraron tres puntos de la ficha que corresponden a `ficha-pieza-crud`, no a `plantillas-mapeo-y-normalizacion`: (1) `POST /pieces/validate` sigue respondiendo 501 (stub); (2) `POST /pieces/{piece_id}/identifiers` sigue respondiendo 501 (stub); (3) `POST /pieces` acepta el campo `identifiers` (`PieceCreate`), pero no guarda esos identificadores ni avisa: la pieza queda creada sin ellos. Las pruebas de la 2.2 crean la pieza con `POST /pieces` y añaden sus identificadores con el servicio `add_identifier`.

**Pendiente interno (no es pregunta al museo):** en el menú lateral, «Administración» exige `users.manage` (`apps/web/src/components/layout/navigation.ts`), así que el Gestor de colecciones y el Catalogador no la ven, aunque la página les abre las pestañas que su rol permite (plantillas de mapeo con `imports.prepare`, parámetros y siglas con `vocabularies.manage`). Mientras tanto, el editor de mapeo del asistente enlaza «Administrar plantillas» (`/administracion?pestana=plantillas`). Ajustar el permiso del menú corresponde al dueño de la estructura de pantalla (`navigation.ts`), no a `plantillas-mapeo-y-normalizacion` (tarea 4.2).

## U. Supuestos del despliegue en la VM y los respaldos (change `despliegue-vm-y-respaldos`, 2026-10-22)

Detalle en `docs/adr/ADR-011-despliegue-proxy-respaldos.md`, `docs/despliegue/vm.md` y `docs/despliegue/checklist-vm.md`. Amplía C6.

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| U1 | ¿Cuánta pérdida de datos y cuánto tiempo de recuperación tolera el museo? (RPO / RTO) | RPO ≤ 24 h (respaldo diario) y RTO ≤ 4 h, a demostrar con un simulacro real | plataforma (RNF-011) | Alta |
| U2 | ¿Con qué frecuencia y por cuánto tiempo se guardan los respaldos? | Diario a las 02:00; se conservan 30 diarios, 8 semanales y 6 mensuales | plataforma (RNF-011) | Media |
| U3 | ¿Qué canal usa la DTI/el museo para las alertas (respaldo fallido, disco lleno)? | Un webhook (Teams o Slack); si no hay, correo SMTP institucional | plataforma (RNF-015) | Alta |
| U4 | ¿Cuál es el destino externo de los respaldos y quién lo administra? | Un bucket S3 compatible (institucional o Cloudflare R2) fuera de la VM, con credenciales de solo ese bucket | plataforma (RNF-011) | Alta |
| U5 | ¿Qué dominio tendrá el sistema y qué certificado se usa? | `matp.<dominio PUCP>` con `media.` como subdominio; certificado institucional si el dominio es interno, automático si es público | plataforma (RNF-013) | Alta |
| U6 | ¿Quién custodia la clave de los respaldos y dónde se guarda la copia fuera de la VM? | El Líder de Proyecto y el Implantador, en dos gestores de contraseñas distintos; sin ella los respaldos no se pueden leer | plataforma (RNF-011, RNF-014) | Alta |
| U7 | ¿Con qué frecuencia se hace el simulacro de restauración? | Mensual y antes de cada entrega del curso | plataforma (RNF-011) | Media |
| U8 | ¿La VM tiene un respaldo propio a nivel de infraestructura y a quién avisar de los reinicios por parches? | Se desconoce; se pide a la DTI (checklist de la VM, puntos 10 y 12) | plataforma (RNF-011) | Media |
| U9 | Si el servidor está cerca de llenarse, ¿se avisa al 80 % de uso? | Sí, cada hora, con los directorios que más ocupan | plataforma (RNF-015) | Baja |

## V. Supuestos de la administración de vocabularios y tipos de identificador (change `colecciones-y-vocabularios-admin`, 2026-10-25)

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| V1 | ¿Qué tipos de identificador son «del sistema» y no admiten cambiar sus reglas? | El código I y el código de colección: solo cambian su etiqueta, descripción y orden; tampoco se desactivan por API. Los demás tipos son configurables | identificacion-piezas (RN-002, RN-003, RN-010) | Media |
| V2 | Cambiar la regla de normalización de un tipo que se bloquea al asignarse (como el código I) recalcula códigos ya asignados. ¿Quién puede confirmarlo? | Solo el Administrador, como corrección auditada (RN-002); el Gestor de colecciones puede ver la vista previa pero recibe 403 al confirmar. Para los demás tipos basta el permiso de administrar vocabularios | identificacion-piezas (RF-023, RN-002) | Media |
| V3 | ¿Se puede confirmar un cambio de regla que deja valores sin normalizar? | Sí: la vista previa los cuenta y lista ejemplos, y quedan como «no normalizable» para revisión humana, sin perder el valor original. Las colisiones de códigos vigentes entre piezas distintas sí impiden confirmar | identificacion-piezas (RF-023) | Baja |

## W. Supuestos de los reportes de inventario (change `reportes-inventario`, 2026-10-25)

| ID | Pregunta | Supuesto actual | Impacto | Prioridad |
|---|---|---|---|---|
| W1 | ¿Las piezas en comodato forman parte del inventario permanente que se entrega? | Sí, con subtotal propio; se pueden excluir con «Incluir comodatos». Nunca entran los préstamos temporales (RN-004) ni las piezas eliminadas o fusionadas | busqueda-reportes (RF-033, RN-004) | Alta |
| W2 | ¿Qué columnas debe tener el inventario oficial y en qué orden? | Las del diseño D3 (códigos vigentes, denominación, colección, régimen, propietario legal, adquisición, ingreso, autor, procedencia, época, tipo, materiales, medidas, conservación y ubicación), ordenadas por colección, código de colección (orden natural) y denominación | busqueda-reportes (RF-033) | Media |
| W3 | ¿Cuántas filas se pueden imprimir de una vez? | 2 000; por encima se sugiere Excel o filtrar por colección | busqueda-reportes (RF-033, RNF-010) | Baja |
| W4 | ¿Se necesita el reporte de valorización en la fase 1? | No implementado todavía: el tipo `valuation` responde «no disponible» hasta confirmarlo (RF-037 es *Could*) | busqueda-reportes (RF-037, RNF-014) | Media |
