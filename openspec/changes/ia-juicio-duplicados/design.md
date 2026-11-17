## Context

La cola de duplicados (`calidad-datos`) ya explica cada par con señales por reglas y, desde
`revisar-duplicados-comparacion`, compara campo por campo y decide filas de Excel. La IA está montada
en la API (`services/ai`, ADR-008) con `AIProvider` (`MockProvider` y el proveedor LLM compatible con
Gemini). RN-009 exige aprobación humana de toda salida de IA.

## Goals / Non-Goals

- Goals: que la persona apruebe la mayoría de los pares por grupo y revise a mano solo los dudosos;
  que nada se aplique sin su aprobación; que sea auditable y reversible.
- Non-Goals: resolver pares solos, entrenar modelos, comparar fotos en esta primera versión (queda
  como mejora: Gemini acepta imágenes, pero sube el costo y la latencia).

## Decisions (propuestas, a confirmar por el desarrollador)

### D1. Operación del proveedor
`judge_duplicates(pairs) -> list[Verdict]` con `Verdict = {pair_id, verdict: same|distinct|unsure,
confidence: 0..1, reason: str}`. Entrada por par: los dos lados con los campos de `COMPARISON_ROWS`
(denominación, colección, régimen, código I, otros códigos, autor, procedencia, época, medidas) más la
descripción. Varios pares por pedido (p. ej. 20) para respetar los límites del plan gratuito.
`MockProvider`: `same` si denominación y colección coinciden y no hay conflicto; `distinct` si hay
conflicto de código I o la denominación difiere mucho; `unsure` en el resto.

### D2. Reglas primero
`inventory_code_conflict` → `distinct` con motivo «Regla: dos códigos I vigentes distintos», sin
llamar a la IA. Más reglas se pueden sumar en la misma capa.

### D3. Dónde viven los veredictos
Una tabla `duplicate_ai_verdict` de solo inserción (`__append_only__ = True` y disparador en la
migración), un veredicto por par y corrida, con proveedor, modelo y versión del prompt. La cola muestra
el último. Alternativa: columnas en `duplicate_candidate` (más simple, pero pierde el historial).

### D4. Umbral de grupos
`same` y `distinct` entran a su grupo solo con confianza ≥ 0,85 (parametrizable, RN-010); el resto va a
«no está seguro».

### D5. Aprobación por grupo
`POST /quality/duplicates/ai-groups/{verdict}/approve` con la corrida y las exclusiones. `distinct`
resuelve los pares como `DISTINCT` con la nota «Sugerido por IA: <motivo>». `same`: en pares de dos
piezas no se fusiona en bloque sin la elección de valores — propuesta: la aprobación los deja «listos
para fusionar» y la fusión usa los valores de la pieza con código I (o pide la elección cuando hay
choque); en pares con fila de Excel resuelve la fila hacia la pieza (`target_piece_id`). La auditoría
guarda origen `AI` y quien aprobó.

### D6. Muestra al azar
Para el grupo `same`, la API devuelve 5 pares al azar de la corrida; la aprobación exige que la
persona los haya confirmado (se envían sus identificadores con la aprobación).

## Decisiones al implementar (2026-11-16)

Las decisiones D1 a D6 eran propuestas. Al contrastarlas con el código quedaron así:

### D1, confirmada: qué recibe la IA
- **Pares que se envían:** solo los `PENDING`. Los pospuestos los apartó una persona.
- **Cada lado del par:** solo los campos de `COMPARISON_ROWS` (denominación, colección, régimen, código I, otros códigos, autor, procedencia, época y medidas) y la descripción de la pieza.
  - Una fila de Excel usa solo la lista blanca de `import_row` (`import_row_summaries`) y no lleva descripción.
  - Nunca se envían el comodante, el registrador, las observaciones, el convenio, el propietario ni `source_payload`/`raw_data` (RNF-014).
  - El cuerpo del servicio de IA no acepta otros campos (`extra="forbid"`).
- **Lotes:** 20 pares por pedido.
- **`MockProvider`:** decide por reglas de denominación, colección y código I.

### D2, confirmada: reglas primero
- **La regla:** un par con `blocking_conflict` o con la señal `inventory_code_conflict` recibe el veredicto `distinct` con origen `rule`, confianza 1 y el motivo «Regla: dos códigos I vigentes distintos». No se llama a la IA.
- **Dónde queda:** entra al grupo «distintas» y, como todo veredicto, queda pendiente de aprobación (RN-009).

### D3, confirmada: tabla de solo inserción
- **Tabla `duplicate_ai_verdict`:** `__append_only__ = True` y disparador en la migración `0025_duplicate_ai_verdict`. Guarda un veredicto por par y corrida, con:
  - el origen (`rule`, `ai` o `review`);
  - el proveedor, el modelo y la versión del prompt (`juicio-duplicados-v1`);
  - la confianza y el motivo.
- **Lo que vale:** el último veredicto del par en la corrida.
- **«Sacar del grupo»:** se registra como un veredicto `review` (`unsure`), con la persona que lo sacó. El par vuelve a la revisión manual sin reescribir nada.
- **La corrida:** es un `quality_job` del tipo nuevo `AI_DUPLICATE_JUDGMENT`, con tres columnas nuevas: `total_pairs`, `processed_pairs` y `failed_batches`. Así hereda del escaneo:
  - el avance consultable;
  - el latido;
  - la recuperación tras un reinicio.

  Tampoco hace falta una excepción nueva en `cross_cutting.py`.

### D4, confirmada: umbral parametrizable
- **Parámetros:** viven en `quality_setting`, con la clave `duplicates.ai_judgment` (RN-010):
  - `min_confidence`, 0,85 por omisión;
  - `batch_size`, 20;
  - `sample_size`, 5.
- **Verificación en la API:** la respuesta de la IA se verifica de nuevo, aunque el servicio ya la haya verificado:
  - el `pair_id` debe ser uno enviado en ese lote;
  - el veredicto debe ser `same`, `distinct` o `unsure`;
  - la confianza se recorta a 0..1.
- **Bajo el umbral:** un veredicto `same` o `distinct` con menos confianza va a «no está seguro».

### D5, concretada: aprobación por grupo
- **Ruta:** `POST /quality/duplicates/ai-runs/{run_id}/groups/{group}/approve`, con las exclusiones y, para «misma pieza», la muestra confirmada. Exige `duplicates.resolve` y `ai.review`.
- **«distintas»:** cada par se resuelve como `DISTINCT` con la nota «Sugerido por IA: <motivo>».
  - Un par con fila de Excel también se marca distinto, sin decidir la fila en su lote. La fila puede tener otro par que sí sea la misma pieza, y decidirla cerraría todos sus pares.
- **«misma pieza», pares de dos piezas:** no se fusiona a ciegas.
  - Se fusionan solo los **listos para fusionar**. Son los que no tienen valores en choque: ningún campo con valor distinto en las dos fichas, el mismo régimen y ningún conflicto de código I.
  - Se conserva la pieza con código I (o la pieza A) y los campos vacíos se llenan con los de la otra.
  - Los que chocan **no se fusionan**: quedan pendientes, marcados «Elija los valores», para la fusión guiada par por par.
  - Ninguna fusión borra nada (RN-005) y cada una se puede revertir desde la auditoría.
- **«misma pieza», pares con fila de Excel:** la fila se resuelve hacia la pieza (`decide_row` con `target_piece_id`) si quien aprueba puede preparar cargas. Si no puede, el par queda pendiente.
- **Auditoría:** cada par resuelto queda con origen `AI`, la corrida en `origin_ref` y la persona que aprobó.
- **Pares sacados:** quedan pendientes.
- **«no está seguro»:** no se aprueba en bloque, se revisa en la cola de siempre.

### D6, confirmada: muestra al azar verificable
- **Cómo se elige:** la muestra son hasta 5 pares del grupo «misma pieza» de la corrida, elegidos al azar con la corrida como semilla. Así la API la puede recalcular al aprobar sin guardarla.
- **Qué exige la aprobación:** cada par de la muestra que siga pendiente en el grupo tiene que venir confirmado o sacado. Si falta alguno, la API responde 422 `sample_not_confirmed`.

### D7, nueva: reanudar
- **Si un lote falla o pasa los 20 s:** se registra en `failed_batches` y el trabajo sigue con el lote siguiente.
- **Reanudar:** lanzar con `resume_run_id` juzga solo los pares de esa corrida que aún no tienen veredicto.
- **Interrupción:** una corrida cortada por un reinicio la marca como fallida la recuperación de siempre.

### D8, nueva: permisos y modo
- **Quién ve la tarjeta «Deje que Gemini los ordene»:** quien tiene `ai.request` y `ai.review`, igual que «Completar ficha».
- **Modo demostración:** con `NEXT_PUBLIC_API_MODE=mock` no aparece.
- **Con `AI_PROVIDER=mock`:** el `MockProvider` juzga de forma determinista, para probar y demostrar. Lo que pide el escenario «Sin proveedor de IA» se cumple igual: la cola par por par sigue disponible y ningún veredicto se aplica sin aprobación.

## Risks / Trade-offs

- Un veredicto `same` erróneo en bloque fusiona piezas distintas: por eso la muestra al azar, el umbral
  alto y que la fusión no borre nada (RN-005) y se pueda revertir por la auditoría.
- Costo y latencia de Gemini con miles de pares: trabajo en segundo plano por lotes, reanudable.
- La proporción real de grupos depende de los datos del museo; los números de la maqueta son
  ilustrativos.

## Open Questions

- ¿El museo acepta aprobar fusiones en bloque, o «misma pieza» debe terminar siempre en la fusión
  guiada par por par? → `docs/preguntas-contraparte.md`.
- ¿Tamaño de la muestra al azar (5 fijo o un porcentaje del grupo)?
