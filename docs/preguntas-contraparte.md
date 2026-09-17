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
