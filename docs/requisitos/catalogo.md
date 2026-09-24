# Catálogo de requisitos — MATP (fase 1)

> Copia estructurada del catálogo del Expediente de Ingeniería (Grupo 4, 1INF47, PUCP 2026-2), tomada del resumen de `docs/PROMPT_BASE.md` §1.6.
> Los `.docx` fuente no estaban disponibles en `docs/fuentes/` al momento del arranque: **si difieren, manda el documento fuente** y este catálogo debe actualizarse.
> Estado: borrador sujeto a aprobación de alcance (S7) y catálogo de requisitos (S8).
>
> Prioridades: MoSCoW (Must / Should / Could). La columna **Capacidad** indica la spec de `openspec/specs/` donde se cubre cada ID.

## 1. Gestión de colecciones y piezas

| ID | Requisito | Prioridad | Capacidad |
|---|---|---|---|
| RF-001 | Identificador interno único (surrogate key), independiente de códigos externos | Must | identificacion-piezas |
| RF-002 | Identificadores externos múltiples 1:N (tipo, valor, valor normalizado, vigencia, fuente) | Must | identificacion-piezas |
| RF-003 | Inmutabilidad del código I | Must | identificacion-piezas |
| RF-004 | Piezas sin código I | Must | identificacion-piezas |
| RF-005 | Régimen de tenencia (propiedad, comodato, préstamo temporal) con reglas | Must | catalogo-piezas |
| RF-006 | Ficha estandarizada (códigos, denominación, colección, forma de adquisición, fecha de ingreso, autor, procedencia, época, tipo de bien, materiales, medidas, descripción, estado de conservación, registrador, observaciones) | Must | catalogo-piezas |
| RF-007 | Época: texto original + interpretación estructurada (tipo, desde, hasta) | Should | catalogo-piezas |
| RF-008 | Preservar columnas de origen sin mapeo en un *payload* de origen | Must | catalogo-piezas |
| RF-009 | Piezas compuestas / conjuntos con código derivado | Should | catalogo-piezas |
| RF-010 | Colecciones y subcolecciones sin límite fijo | Must | colecciones-vocabularios |
| RF-011 | Categorías en tabla configurable (precargada con consultoría 2024/25) | Must | colecciones-vocabularios |
| RF-012 | Estado de conservación con vocabulario controlado | Should | colecciones-vocabularios |
| RF-013 | Múltiples fotos por pieza con tipo de vista y orden | Must | multimedia |
| RF-014 | Restricciones de uso/publicación de fotos (comodato) | Should | multimedia |
| RF-015 | Documentos asociados (preparado para archivo documental) | Could | multimedia |
| RF-043 | Validación en tiempo real del ingreso/edición manual | Must | catalogo-piezas |

## 2. Ubicación y control

| ID | Requisito | Prioridad | Capacidad |
|---|---|---|---|
| RF-016 | Ubicación jerárquica sede → espacio → mueble/rack → nivel → contenedor (solo sede/espacio obligatorio) | Must | ubicacion-movimientos |
| RF-017 | Historial automático de movimientos | Should | ubicacion-movimientos |
| RF-018 | Préstamos y participación en exposiciones | Should | ubicacion-movimientos |
| RF-019 | Alertas de información incompleta (sin I, sin foto, sin ubicación, obligatorios vacíos) | Must | ubicacion-movimientos, calidad-datos |
| RF-020 | Disponibilidad (en sala, depósito, préstamo, exposición temporal) | Should | ubicacion-movimientos |

> Nota: RF-019 aparece en el bloque de ubicación y en `calidad-datos`. La regla de cálculo de alertas vive en `calidad-datos`; `ubicacion-movimientos` solo expone la condición "sin ubicación".

## 3. Importación y calidad de datos

| ID | Requisito | Prioridad | Capacidad |
|---|---|---|---|
| RF-021 | Importación como pipeline de reconciliación: ingesta → mapeo → normalización → validación/matching → previsualización → aprobación → bitácora | Must | importacion-datos |
| RF-022 | Plantillas de mapeo de columnas reutilizables por fuente | Must | importacion-datos |
| RF-023 | Normalización de identificadores (ceros, separadores, concatenados) | Must | identificacion-piezas |
| RF-024 | Matching multi-código contra registros existentes | Must | importacion-datos |
| RF-025 | Clasificación de filas: nuevo / actualización / posible duplicado / conflicto | Must | importacion-datos |
| RF-026 | Previsualización con diff (valor actual vs entrante) | Must | importacion-datos |
| RF-027 | Aprobación explícita de cargas masivas por rol autorizado | Must | importacion-datos |
| RF-028 | Bitácora de carga con motivo de rechazo | Must | importacion-datos |
| RF-029 | Extracción de fotos incrustadas en Excel con revisión manual | Should | importacion-datos |
| RF-030 | Detección de duplicados por similitud con cola de revisión humana | Must | calidad-datos |

## 4. Consulta y reportes

| ID | Requisito | Prioridad | Capacidad |
|---|---|---|---|
| RF-031 | Búsqueda por cualquier código, colección, procedencia, autor, material/tipología, época, estado | Must | busqueda-reportes |
| RF-032 | Filtros combinados (AND) | Must | busqueda-reportes |
| RF-033 | Reporte de inventario general y por colección | Must | busqueda-reportes |
| RF-034 | Reporte por ubicación | Should | busqueda-reportes |
| RF-035 | Reporte de información incompleta (KPI de completitud) | Must | calidad-datos |
| RF-036 | Exportación de resultados a Excel | Must | busqueda-reportes |
| RF-037 | Reporte agregado de valorización/seguros | Could | busqueda-reportes |
| RF-038 | Búsqueda resuelta en segundos | Must | busqueda-reportes |
| RF-044 | Exportación completa de la BD en formato abierto (Excel/CSV) | Must | busqueda-reportes |

## 5. Usuarios y seguridad

| ID | Requisito | Prioridad | Capacidad |
|---|---|---|---|
| RF-039 | Usuarios y roles con matriz de permisos graduada | Must | usuarios-roles |
| RF-040 | Auditoría campo a campo (quién, cuándo, valor anterior, nuevo) | Must | auditoria-trazabilidad |
| RF-041 | Restricción de campos sensibles por rol (valorización, ubicación exacta, comodato, donantes) | Should | usuarios-roles |
| RF-042 | Solo uso interno en fase 1 | Must | usuarios-roles |

## 6. Requisitos no funcionales

| ID | Requisito | Capacidad |
|---|---|---|
| RNF-001 | Responsive: escritorio principal, tablet/móvil en depósito | plataforma |
| RNF-002 | Operable en free tier | plataforma |
| RNF-003 | Estimar volumen fotográfico antes de comprometer arquitectura | multimedia |
| RNF-004 | Documentado para mantenimiento por terceros | plataforma |
| RNF-005 | Tolerante a conexión lenta | plataforma |
| RNF-006 | Sin borrado físico (soft-delete) | auditoria-trazabilidad |
| RNF-007 | Cargas/ediciones auditables y reversibles | auditoria-trazabilidad |
| RNF-008 | Entorno académico sin dependencias productivas obligatorias | plataforma |
| RNF-009 | API documentada para integraciones futuras (SURDOC, Getty AAT) | plataforma |
| RNF-010 | Usable con baja alfabetización digital | plataforma [^rnf010] |
| RNF-011 | Respaldos automáticos con restauración probada | plataforma |
| RNF-012 | Autenticación individual (preparado para cuenta PUCP) | usuarios-roles |
| RNF-013 | HTTPS + hash de contraseñas | usuarios-roles |
| RNF-014 | Ley 29733 de protección de datos personales | usuarios-roles |
| RNF-015 | ≥ 20 000 piezas y 10 usuarios concurrentes | plataforma |

[^rnf010]: RNF-010 no figura en la tabla de capacidades del prompt base; se asigna a `plataforma` como criterio transversal de usabilidad. [SUPUESTO]

## 7. Inteligencia artificial (asistiva, siempre con revisión humana)

| ID | Funcionalidad | Prioridad cliente | Capacidad |
|---|---|---|---|
| RIA-01 | Extracción de datos estructurados desde texto libre (exposiciones, medidas, estado, marcas de revisión) | 1 | ia-asistiva |
| RIA-02 | Detección de duplicados e inconsistencias por similitud | 2 | ia-asistiva (apoya calidad-datos) |
| RIA-03 | Sugerencia de categorías / términos normalizados (camino a tesauro Getty AAT) | 3 | ia-asistiva |
| RIA-04 | Descripción preliminar desde metadatos | 4 (por validar) | ia-asistiva |
| RIA-05 | Asistente de consulta sobre catálogo autorizado | 5 (pendiente) | ia-asistiva |

**Fuera de alcance**: visión por computadora sobre imágenes.

## 8. Reglas de negocio

| ID | Regla | Capacidad |
|---|---|---|
| RN-001 | Ningún código externo es clave primaria | identificacion-piezas |
| RN-002 | El código I es inmutable | identificacion-piezas |
| RN-003 | Una pieza en comodato nunca recibe código I | identificacion-piezas |
| RN-004 | El préstamo temporal no entra al inventario permanente | catalogo-piezas |
| RN-005 | Nunca se borra información (se marca) | auditoria-trazabilidad |
| RN-006 | La PUCP es la única propietaria legal | catalogo-piezas |
| RN-007 | Las piezas inscritas no se venden ni se desagregan de su colección | catalogo-piezas |
| RN-008 | Restricciones contractuales en comodato | multimedia |
| RN-009 | Ninguna salida de IA se guarda sin aprobación humana | ia-asistiva |
| RN-010 | Vocabularios y tipos de identificador parametrizables | colecciones-vocabularios |

## 9. Roles de usuario del sistema

Administrador · Gestor de colecciones (Curadora) · Catalogador/practicante · Conservación · Personal auxiliar de depósito · Consulta interna · Consulta externa/investigador (**modelado pero desactivado en fase 1**).
