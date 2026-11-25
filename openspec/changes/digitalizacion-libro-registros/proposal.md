## Why

El museo exige mantener su libro físico de registros (ficha manuscrita) para toda pieza nueva o
movimiento: la idea original de registrar por voz mientras se camina quedó bloqueada por ese
requisito del cliente. El equipo la cambió por esta: fotografiar la página del libro ya escrita a
mano y que la IA la lea, para que el curador no transcriba cada fila a mano — autocompletar que
siempre requiere validación, nunca escribe solo.

Validado contra 8 fotos reales del libro de 1978 (`data/real/libro-registros/`, fuera de git por
ADR-019) con dos modelos distintos (Gemini y Claude Sonnet 5.5): ambos leen correctamente las 9
filas de una página real (código I, procedencia, estado, fecha), con confianza por fila.

## What Changes

- Nueva operación del proveedor de IA (`extract_ledger_page`, mismo patrón multimodal que
  `complete_piece` de `ia-completar-ficha`): recibe la foto de una página y devuelve, por fila, una
  denominación sugerida, la descripción textual tal como está escrita, procedencia, estado de
  conservación, fecha y código adicional, cada uno con su confianza. Nunca escribe en el catálogo.
- La foto no abre una pantalla de revisión aparte: crea un lote de importación (`ImportBatch`) con
  una **plantilla fija** nueva («Foto del libro de registros») que mapea esas columnas sintéticas a
  los mismos campos que ya usan los Excel reales (`denomination`, `description`, `provenance`,
  `conservation_status` con el mismo `value_map` de `formatos-reales-importacion`, `entry_date`,
  identificador `I` con el mismo match-por-código de `duplicados-solo-por-codigo`, `OTRO`). El lote
  queda `MAPPED`: todo lo demás (clasificar NUEVA/ACTUALIZACIÓN/POSIBLE DUPLICADO, previsualizar con
  diff, decidir fila por fila, aprobar, aplicar, revertir, bitácora) es el flujo de importación que
  ya existe, sin tocarlo.
- Pantalla nueva, mínima: subir 1 o más fotos de páginas del libro y ver el progreso de lectura;
  redirige al lote ya creado, donde continúa la revisión que el módulo de importación ya tiene.
- Auditoría: nunca se intenta leer ni guardar la firma manuscrita del registrador (ilegible,
  decisión del equipo 2026-11-24). Queda resuelta por los dos mecanismos que ya existen y no se
  tocan: quién lo hizo en el sistema es el usuario logueado (auditoría transversal, con su rol), y
  el campo libre y opcional `recorded_by` («Registrado por») de la ficha, que el curador puede
  llenar a mano con el nombre que lee en la firma si quiere conservarlo — nunca autoritativo.

## Impact

- Capacidades: `importacion-datos` (nueva plantilla fija y una forma más de crear un lote, ninguna
  pantalla de revisión nueva) e `ia-asistiva` (nueva operación del proveedor, RIA-07).
- Nuevo RF-050 **[SUPUESTO]** y RIA-07, a validar con el museo y la jefa de práctica.
- Depende de: `importacion-pipeline-reconciliacion`, `formatos-reales-importacion` (`value_map` de
  conservación), `duplicados-solo-por-codigo` (match por código), `ia-completar-ficha` (patrón
  multimodal del proveedor), `auditoria-y-soft-delete-transversal`.
- Afecta: `services/ai/matp_ai/` (schema + proveedor + endpoint), `apps/api/app/modules/imports/`
  (plantilla fija, nuevo endpoint de ingestión), `apps/api/app/modules/ai_suggestions/` (cliente),
  `apps/web` (pantalla de carga de fotos), `docs/manual-usuario/importacion.md`,
  `docs/preguntas-contraparte.md`.
- Fuera de este change: adjuntar la foto de la página a cada fila como evidencia visual durante la
  revisión (hoy el curador revisa contra la foto que ya tiene a mano, igual que revisa un Excel sin
  ver el papel original); normalizar el campo adicional cuando la IA confunde el encabezado de la
  columna con un valor de fila (se documenta como limitación conocida, el curador lo corrige en la
  revisión igual que corrige cualquier otro dato mal leído).
