## Context

`LiveImportWizard` lista las filas validadas como tarjetas (`ImportRowCard`) y resuelve conflictos y
posibles duplicados con un `Select`. Al aprobar, `apply_stage` aplica también las filas `PENDING`
nuevas y de actualización (aprobar el lote es la aprobación de esas filas). `ia-juicio-duplicados`
juzga los pares pendientes de toda la cola, incluidos los de una fila de Excel (`build_pairs` con
`import_row_summaries`), y guarda los veredictos en `duplicate_ai_verdict`.

## Decisions

### D1. Lo que pide atención, primero
Mientras la persona no elige otro filtro, la revisión muestra «Por decidir» si el lote tiene
conflictos o posibles duplicados. «Por decidir» es un filtro del servidor (`to_decide=true`) porque
reúne dos clasificaciones. Un aviso dice cuántas filas se importan solas.

### D2. Gemini por lote, con el análisis que ya existe
`run_judgment(…, import_batch_id)` filtra los pares pendientes por las filas del lote; reglas, lotes por
llamada, privacidad y auditoría son los de `ia-juicio-duplicados`. `POST /imports/{id}/ai-judgment`
lanza la corrida (un análisis a la vez: 409 si hay otro); `GET` devuelve el análisis más reciente y el
último veredicto de cada par de las filas del lote, con el umbral de confianza. No hace falta una tabla
nueva: el alcance está en los pares juzgados.

### D3. La opinión solo preselecciona
Con confianza mayor o igual al umbral (`min_confidence`, 0,85 por defecto): «misma pieza» con una sola
pieza preselecciona esa pieza; «distintas» con todas las candidatas preselecciona «es una pieza nueva».
Con dudas, poca confianza, más de una «misma pieza» o un par que una persona sacó de su grupo, no se
preselecciona nada. La fila se decide solo con «Aceptar y siguiente» (RN-009); decidirla cierra sus
pares de la cola, como ya hacía `decide_row`.

### D4. Un solo panel
Las filas que piden pieza usan el panel de decisión; las demás (errores, actualizaciones) muestran su
`ImportRowCard` de siempre dentro del mismo panel, con sus fotos y sus sugerencias de texto libre.

## Risks / Trade-offs

- Una corrida del lote se ve también como el último análisis en la cola de duplicados: es correcto
  (juzgó pares pendientes de la cola), aunque con menos pares.
- «Aceptar y siguiente» recorre la página actual; con más filas por decidir que filas por página, se
  pasa de página como siempre.
