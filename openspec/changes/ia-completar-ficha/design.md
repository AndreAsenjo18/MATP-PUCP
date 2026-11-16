## Context

`POST /ai/suggest-cataloging` ya extrae campos de un texto y guarda una `AiSuggestion` pendiente; desde
`retirar-sugerencias-ia-ficha` no tiene punto de entrada en la interfaz. `apply_approved` solo aplica
`APPLICABLE_FIELDS = {dimensions, conservation_status, review_marks}`. El panel «Completar ficha» de
`completar-piezas-incompletas` ya sabe qué campos faltan (`missing_fields`) y los guarda con `PUT
/pieces/{id}`.

## Decisions (propuestas, a confirmar por el desarrollador)

### D1. Entrada: solo la propia pieza
Texto: denominación, descripción y observaciones. Imagen: la foto principal, si la hay. Campos pedidos:
solo los de `missing_fields` que el panel puede completar (materiales, medidas, procedencia, época,
categoría, estado de conservación). Vocabularios: las listas activas del museo, para que categoría,
materiales y estado se elijan de ellas (nunca un término inventado).

### D2. Salida con evidencia obligatoria
Por campo: `value`, `confidence` y `evidence` = `{source: "text", quote}` o `{source: "image"}`. Una
propuesta sin evidencia se descarta en el backend. La cita debe aparecer literalmente en el texto de la
pieza (se verifica antes de devolverla).

### D3. Las propuestas no escriben nada
El panel muestra las propuestas como valores iniciales marcados; solo «Guardar y siguiente» escribe, con
el mismo `PUT` de siempre. La auditoría registra qué campos vinieron de una propuesta aceptada (origen
`AI`, aprobado por la persona). Se reutiliza `AiSuggestion` para dejar constancia de lo propuesto y de lo
aceptado o descartado.

### D4. Prompt
En español, con la instrucción explícita de no usar conocimiento externo y de devolver «sin dato» cuando
la ficha no lo dice. Versión del prompt guardada con cada propuesta.

### D5. Rendimiento
La propuesta se pide al abrir el panel (no al cargar la lista) y se muestra un estado «Gemini está
leyendo la ficha…». Si tarda o falla, el panel sigue usable sin propuestas.

## Risks / Trade-offs

- Un dato inventado que parece confiable es el peor error en un catálogo de museo: por eso la evidencia
  obligatoria, la verificación de la cita y la aprobación campo por campo.
- La lectura de la foto (categoría, materiales) es menos verificable que una cita: confianza más alta
  exigida y la etiqueta «de la foto».

## Open Questions

- ¿El museo acepta que la IA proponga categoría o materiales a partir de la foto? →
  `docs/preguntas-contraparte.md`.
- ¿Más adelante, aprobación en bloque para propuestas con cita literal y alta confianza?
