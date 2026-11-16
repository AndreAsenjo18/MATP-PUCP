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
