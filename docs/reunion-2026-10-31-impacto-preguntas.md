# Reunión con el MATP (2026-10-31): preguntas e impacto en los changes

Guía para Sergio y André: qué change toca cada pregunta del guion de la demo, según lo que responda el museo.
Los IDs (L5, A2…) son los de `docs/preguntas-contraparte.md`. Al volver de la reunión, se completa la columna **Respuesta**
y se pasa cada respuesta a `docs/preguntas-contraparte.md`.

Estado de los changes al 2026-10-30 (`openspec list`):

- **Activos** (se pueden ampliar con sus tareas): `ficha-pieza-crud` (19/22), `fotografias-multiples-por-pieza` (5/16), `importacion-masiva-fotografias` (15/27), `reportes-inventario` (10/11), `prestamos-y-exposiciones` (12/13), `rediseno-ux-importacion` (25/26), `ia-extraccion-texto-libre` (0/15), `ia-sugerencia-terminos` (0/13), `marcar-campos-obligatorios` (nuevo, PR pendiente).
- **Completos sin archivar**: `rediseno-ux-deposito`, `rediseno-ux-duplicados`, `rediseno-ux-administracion`, `rediseno-ux-sugerencias-ia`.
- **Archivados** (un cambio de comportamiento requiere un **change nuevo** con su delta): `colecciones-y-vocabularios-admin`, `plantillas-mapeo-y-normalizacion`, `importacion-pipeline-reconciliacion`, `deteccion-duplicados-y-cola-revision`, `ubicacion-jerarquica-y-movimientos`, `autenticacion-y-matriz-permisos`, `alertas-y-reporte-incompletas`, `busqueda-avanzada-y-exportacion`.

Tipos de impacto:

- **Config.**: basta con cambiar datos desde Administración (listas de valores, colecciones, permisos por rol, lectura de códigos) o un parámetro. No hace falta un change. Si el valor debe quedar en las instalaciones nuevas, también se actualiza el seed (`apps/api/app/seed/reference.py`).
- **Change activo**: se agrega una tarea al change indicado.
- **Change nuevo**: hay que proponerlo con `/opsx:propose`.

## 1. Preguntas e impacto

### Inicio

| ID | Pregunta | Si responden… | Impacto | Respuesta |
|---|---|---|---|---|
| — | ¿Estas alertas les sirven? ¿Falta alguna? | Sirven tal cual | Ninguno | |
| | | Piden alertas nuevas | **Change nuevo** `alertas-adicionales` (delta sobre `calidad-datos`; reglas de `alertas-y-reporte-incompletas`, archivado) | |
| — | ¿Les sirve ver aquí las últimas cargas? | Quieren otra cosa | **Change nuevo** `rediseno-ux-inicio`; todavía no hay rediseño de Inicio | |

### Búsqueda

| ID | Pregunta | Si responden… | Impacto | Respuesta |
|---|---|---|---|---|
| B6/E2 | ¿Quién ve el comodante, la ubicación exacta y los donantes? | Cambian los roles que los ven | **Config.**: Administración › Permisos por rol (`sensitive.*`) y seed | No se preguntó → viernes 2026-11-06 |
| | | Hay otros datos sensibles | **Change nuevo** (delta sobre `usuarios-roles`; la base es `autenticacion-y-matriz-permisos`, archivado) | |
| — | ¿Les falta algún filtro? | Sí | **Change nuevo** (delta sobre `busqueda-reportes`; la base es `busqueda-avanzada-y-exportacion`, archivado) | Piden filtros también en Depósito y fusionar ambas vistas: change nuevo `fusion-busqueda-deposito` |

### Ficha de pieza y formulario

| ID | Pregunta | Si responden… | Impacto | Respuesta |
|---|---|---|---|---|
| ⭐ L5 | ¿*Cesión de uso* y *Custodia* son comodato? | Sí, son comodato | **Config.**: agregar los términos a «Formas de adquisición». También correspondencias en los formatos de importación, para que esos valores se lean como régimen Comodato | **Sí, son comodato** (2026-10-31) |
| | | No, son otro régimen | **Change nuevo** `regimen-tenencia-adicional`, **de alto impacto**: enumerado `TenureRegime` y migración; traducción de la API (`app/api/enums.py`) y contrato `endpoints-api-v1.yaml`; reglas RN-003/RN-004; ficha (`ficha-pieza-crud`); importación (`classify.py`); subtotales de `reportes-inventario`. Coordinar con el Líder, porque cambia el contrato | |
| ⭐ B2 | ¿Qué más se anota de un comodato? | Solo comodante y convenio (lo que hay hoy) | Ninguno | Lo adicional va en la descripción: ninguno (2026-10-31) |
| | | Fechas, número de acuerdo, cláusulas | **Change nuevo** `datos-acuerdo-comodato`: modelo y migración, ficha y formulario, restricciones de imagen (`fotografias-multiples-por-pieza`, RN-008), validación de `prestamos-y-exposiciones` (`loan_agreement_ref`) | |
| B1 | ¿Qué campos son imprescindibles? | Solo denominación y régimen | Ninguno (ya marcado con `marcar-campos-obligatorios`) | |
| | | Más campos obligatorios | **Change activo** `ficha-pieza-crud` (validación en `catalog/service.py`) + `marcar-campos-obligatorios` (asterisco). **Cuidado**: también rechazaría filas de las sábanas al importar. Proponer que sean *recomendados* (alerta, no bloqueo) | |
| | | Campos recomendados | **Config.**: `PUT /quality/completeness-rules` (no tiene pantalla). Si quieren verlos marcados en el formulario: ampliar `marcar-campos-obligatorios` con una marca «recomendado» | |
| B4 | ¿Usan la escala Bueno / Regular / Malo / En restauración? | Otra escala | **Config.**: Listas de valores + correspondencias de importación para las ~51 variantes de sus bases | |
| B8 | ¿Cómo numeran las piezas de un juego? | Distinto de `MBB 40.1` | **Change nuevo** pequeño `ajuste-normalizacion-codigos`: regla D3 de `apps/api/app/modules/identification/normalization.py` (delta sobre `identificacion-piezas`) | |
| B9 | ¿Cómo escriben la época? | Formatos que no reconocemos | Mismo `ajuste-normalizacion-codigos` (o uno propio): reglas T5/T7. Si quieren guardar la época interpretada (hoy solo se ve en la vista previa) → **change nuevo** | |
| C2 | ¿Qué vistas fotografían? | Otra lista | **Config.**: «Tipos de vista fotográfica» | |
| A6 | ¿Cómo corrigen un código I y quién lo autoriza? | Alguien que no es el Administrador | **Config.**: permiso `identifiers.correct_inventory_code`. Ojo: hoy el código exige además el rol Administrador (Ñ2), así que hace falta una tarea en `ficha-pieza-crud` | |

### Importación

| ID | Pregunta | Si responden… | Impacto | Respuesta |
|---|---|---|---|---|
| ⭐ A2 | Formato del código I | Distinto de `I-236` / ceros no significativos | **Change nuevo** `ajuste-normalizacion-codigos` (N1–N7 en `normalization.py`). Si solo cambia la regla de un tipo: Administración › Tipos de código (V2, vista previa y confirmación del Administrador) | No se preguntó → viernes. Igual se propone `ajustes-lectura-importacion` (RN de 5 dígitos visto en sus bases) |
| ⭐ A4 | Formatos del RN | Confirman RN de **5 dígitos** | **Change nuevo** `ajuste-normalizacion-codigos`: **hoy un RN de 5 dígitos queda «no normalizable»** (D2 solo acepta 4 y 6) | No se preguntó → viernes; ver A2 |
| A3 | Colecciones en comodato (además de AJB) | Lista | **Config.**: Administración › Colecciones (régimen y tenencia por defecto) + siglas históricas | |
| B10 | ¿La celda vacía conserva el valor? | Sí | Ninguno | |
| | | Debe vaciarlo | **Change nuevo** (delta sobre `importacion-datos`; la base es `importacion-pipeline-reconciliacion`, archivado): opción por lote o por columna «vaciar si viene vacío» | |
| M4/Y3 | Régimen para todo el archivo | No les sirve, o falta algo | **Change activo** `rediseno-ux-importacion` (queda 1 tarea) | |
| ⭐ L1 | Nombres de carpetas y archivos de fotos (pantallazo) | Formato concreto | **Change activo** `importacion-masiva-fotografias`: reglas de `apps/api/app/modules/imports/photo_matching.py` (S1–S3, L4 vista en el nombre). Aprovechar para cerrar el pendiente de las siglas históricas en el emparejamiento | Capturas del Drive recibidas: change nuevo `importacion-fotos-a-catalogo` (2026-10-31) |
| B7/M10 | ¿Quién aprueba y quién deshace una carga? | Aprobar: otro rol | **Config.**: `imports.approve` en Permisos por rol | |
| | | Deshacer: alguien que no es el Administrador | **Config.** del permiso `imports.revert` + revisar el aviso «Solo un Administrador…» del asistente (`rediseno-ux-importacion`) | |
| Y1 | ¿«Formato» o «plantilla»? | «Plantilla» u otro nombre | **Change activo** `rediseno-ux-importacion` (solo textos y manual) | |

### Duplicados

| ID | Pregunta | Si responden… | Impacto | Respuesta |
|---|---|---|---|---|
| O1 | ¿Qué pistas usan? ¿Cuál pesa más? | Otros pesos | **Config.**: `quality_setting` `duplicates.scoring` (no tiene pantalla) | |
| | | Una pista que no existe (p. ej. técnica, material) | **Change nuevo** (delta sobre `calidad-datos`; la base es `deteccion-duplicados-y-cola-revision`, archivado) | |
| G8 | Propiedad y comodato que son la misma pieza | Se fusionan igual | **Change nuevo** (hoy se rechaza con 409; hay que definir qué régimen queda) | |

### Depósito

| ID | Pregunta | Si responden… | Impacto | Respuesta |
|---|---|---|---|---|
| ⭐ A7/Z1/P1 | ¿Hay piezas en un mueble sin nivel, o cajas en el piso? | Sí | **Change nuevo** pequeño `ajuste-jerarquia-ubicaciones`: `ALLOWED_PARENT` en `apps/api/app/modules/locations/hierarchy.py` (delta sobre `ubicacion-movimientos`) + filtro «Solo lugares finales» de la vista Depósito (`rediseno-ux-deposito`) | No se preguntó → viernes |
| | | Niveles distintos | **Config.**: Administración › Ubicaciones (cargar su estructura real) | |
| F5 | ¿Reportar daño o faltante desde el depósito? | Sí | **Change nuevo** `incidencias-deposito` (modelo, API, botón en la vista Depósito; posible alerta en Inicio) | |

### Reportes

| ID | Pregunta | Si responden… | Impacto | Respuesta |
|---|---|---|---|---|
| W1 | ¿Comodatos dentro del inventario oficial? | Aparte | **Change activo** `reportes-inventario`: cambiar el valor por defecto de «Incluir comodatos» o crear un reporte aparte | |
| W2 | ¿Columnas y orden? ¿Formato fijo de la PUCP o del Ministerio? | Otras columnas o un formato oficial | **Change activo** `reportes-inventario` (diseño D3). Si es un formato oficial nuevo → **change nuevo** `reporte-formato-oficial` | Piden la descripción como columna fija y reportes por atributo: change nuevo `reportes-por-atributo` |

### Sugerencias de IA

| ID | Pregunta | Si responden… | Impacto | Respuesta |
|---|---|---|---|---|
| C9 | ¿Qué funciones les ahorran trabajo? | Extraer datos / sugerir términos | Priorizar **changes activos** `ia-extraccion-texto-libre` → `ia-sugerencia-terminos` (fuera del MVP) | |
| | | Redactar una descripción / responder consultas | **Change nuevo** (RIA-04 / RIA-05; no tienen change todavía) | |
| — | ¿Quién revisa lo que propone la IA? | Un rol concreto | **Config.**: permiso de revisar IA en Permisos por rol | |

### Administración

| ID | Pregunta | Si responden… | Impacto | Respuesta |
|---|---|---|---|---|
| ⭐ A3 | ¿Está completa la lista de colecciones? | Lista oficial | **Config.**: Colecciones + seed sintético coherente (sin datos reales, RNF-014) | No se preguntó → viernes |
| A5/A8/G7 | ¿Cómo escriben «sin código», separadores, siglas antiguas? | Valores concretos | **Config.**: Lectura de códigos. Si el cambio altera códigos ya registrados, la pantalla lo rechaza (T10): preparar la vista previa con el Administrador | |
| ⭐ B7 | ¿Qué puede hacer cada persona? | Matriz | **Config.**: Permisos por rol + actualizar la matriz del seed. Si piden un rol nuevo → **config.** (crear rol), sin change | No se preguntó → viernes |

## 2. Changes nuevos posibles (según las respuestas)

| Change propuesto | Lo activa | Tamaño | Prioridad sugerida |
|---|---|---|---|
| `ajuste-normalizacion-codigos` | A2, A4 (RN de 5 dígitos), B8, B9 | Pequeño | **Alta**: con RN de 5 dígitos, la importación de las bases reales deja muchos códigos sin normalizar |
| `regimen-tenencia-adicional` | L5 = otro régimen | **Grande** (cambia el contrato) | Alta si aplica |
| `datos-acuerdo-comodato` | B2 | Mediano | Media |
| `ajuste-jerarquia-ubicaciones` | A7/Z1/P1 | Pequeño | Media |
| `incidencias-deposito` | F5 | Mediano | Baja (después del MVP) |
| `alertas-adicionales` | Alertas del Inicio | Pequeño a mediano | Baja |
| `rediseno-ux-inicio` | Últimas cargas / contenido del Inicio | Pequeño | Baja |
| Opción «vaciar si viene vacío» en la importación | B10 = vaciar | Pequeño | Media |
| Fusión entre regímenes distintos | G8 | Mediano | Baja |
| Reporte en formato oficial | W2 | Mediano | Según lo que pidan |

## 3. Trabajo que no necesita change (llevarlo a Administración tras la reunión)

Formas de adquisición (L5, si es comodato), estados de conservación (B4), tipos de vista (C2), colecciones y comodatos (A3), lectura de códigos (A5/A8/G7), estructura de ubicaciones (A7), matriz de permisos (B6/B7/A6/IA), pesos de duplicados (O1), reglas de completitud (B1 recomendados).

Recordar: todo valor que deba quedar en las instalaciones nuevas va también al seed, con datos **sintéticos** (RNF-014).

## 4. Resultado de la reunión (2026-10-31)

Solo se respondieron L5, B2 y L1; el resto pasa a la reunión presencial del viernes 2026-11-06 (guion: `docs/reunion-2026-11-06-guion-preguntas.md`). El museo además pidió:

| Pedido | Change | Responsable |
|---|---|---|
| Cargar el archivo fotográfico del Drive a piezas existentes | `importacion-fotos-a-catalogo` | Sergio |
| Fusionar Búsqueda y Depósito, con filtros en el depósito | `fusion-busqueda-deposito` | André |
| Reportes por procedencia, denominación, autor, materiales y estado; mejor vista previa; descripción como columna fija | `reportes-por-atributo` | André |
| Registrar todo a mano después del histórico (piezas, colecciones, depósito) con altas, cambios y bajas fáciles | `crud-manual-completo` | André |
| L5: «Cesión de uso» y «Custodia» como comodato | `ajustes-lectura-importacion` | André |
| RN de 5 dígitos (A4, visto en las bases aunque no se preguntó) | `ajustes-lectura-importacion` | André |
