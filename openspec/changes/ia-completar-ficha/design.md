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

## Decisiones al implementar (2026-11-15)

Las decisiones D1 a D5 eran propuestas. Al contrastarlas con el código quedaron así:

### D1, ajustada: qué se le envía al proveedor
- **Texto:** denominación, descripción y observaciones (`notes`) de la ficha. No se envía nada
  más: ni comodante (`lender_name`), ni convenio, ni propietario legal, ni registrador
  (`recorded_by`), ni el registro de origen (`piece_source_record.payload`), ni la ubicación
  (RNF-014). El cuerpo del servicio de IA no acepta otros campos (`extra="forbid"`) y hay una
  prueba que revisa lo enviado.
- **Campos:** solo los de `missing_fields` que la IA puede probar con la ficha: categoría,
  materiales, procedencia, época, medidas y estado de conservación. La colección y la
  descripción no se piden. La colección no sale del texto de la pieza con una cita, y redactar
  una descripción es RIA-04, no extracción.
- **Imagen:** la foto principal, en su copia de visualización (1600 px como máximo, no el
  original). No se envía si la foto tiene una restricción de uso ni si la pieza está en comodato
  (RN-008) [SUPUESTO].

### D2, confirmada: la prueba se verifica dos veces
- **Primera verificación:** el proveedor LLM descarta lo que no cumple al leer la respuesta.
- **Segunda verificación:** la API vuelve a revisarlo, sea cual sea el proveedor:
  - la cita aparece tal cual en uno de los textos enviados;
  - el término es uno activo de la lista del museo;
  - el campo es uno de los pedidos.
- **La foto como prueba:** vale solo para categoría, materiales y estado de conservación, con
  confianza de 0,8 como mínimo. Nunca para procedencia, época ni medidas.
- **Materiales:** se propone el término de la lista. El detalle («de cedro») no tiene dónde
  guardarse, porque `piece_material` solo guarda el término. Por eso se propone «Madera» con la
  cita «madera de cedro» a la vista. El escenario «Madera (cedro)» se cumple tal cual solo si la
  lista del museo tiene ese término (RN-010).

### D3, ajustada: aceptar, corregir y descartar
- **En el panel:** cada propuesta es una tarjeta dentro de su campo, con «Sugerido por
  Gemini», el valor y la prueba. Ofrece «Aceptar» y «Descartar».
  - «Aceptar» llena el campo.
  - Cambiar el valor después de aceptarlo es corregirlo.
  - Una propuesta que no se aceptó no se guarda nunca, aunque se pulse «Guardar y siguiente».
- **Al guardar:** «Guardar y siguiente» guarda los campos escritos a mano con el `PUT` de
  siempre. Las propuestas aceptadas o corregidas se guardan con `POST
  /ai/suggestions/{id}/approve`, el camino que ya existía: `apply_approved` registra la auditoría
  con origen `AI`, la sugerencia como referencia y quien guarda como usuario.
  - Solo con `PUT` la auditoría diría origen `USER` y no quedaría qué valores vinieron de la IA.
- **Constancia en la sugerencia:**
  - Lo descartado queda en `approved_data.discarded`.
  - Si no se aceptó ninguna propuesta, la sugerencia se rechaza con el motivo «Ninguna propuesta
    aceptada al completar la ficha».
  - Cerrar el panel o saltar la pieza la deja pendiente. Al volver a abrir la misma pieza sin
    cambios se reutiliza la propuesta, sin volver a llamar al modelo.

### D4, confirmada
La versión del prompt (`completar-ficha-v1`) se guarda en la entrada y en la salida de la
sugerencia.

### D5, confirmada
Se usa el mismo límite de 20 s del proveedor. Si falla, el panel lo dice en una línea y sigue
igual que siempre.

### D6, nueva: permisos
Gemini aparece en el panel solo para quien tiene `ai.request` y `ai.review`, además de
`pieces.update`, porque aceptar una propuesta es aprobar una salida de la IA (RN-009). Hoy eso
corresponde al Administrador y al Gestor de colecciones. El Catalogador tiene `ai.request`, pero
no `ai.review`, y ve el panel como siempre. No se cambia la matriz de permisos [SUPUESTO].

### D7, nueva: operación propia
`POST /ai/pieces/{piece_id}/completion` (operación añadida) devuelve `PieceCompletionOut`. No se
amplía `POST /ai/suggest-cataloging`, porque su contrato (un campo de texto y la salida de
RIA-01) lo usan la carga masiva y sus pruebas.

### D8, nueva: modo demostración
Con `NEXT_PUBLIC_API_MODE=mock` el panel funciona sin propuestas, igual que las demás funciones
de IA, que responden «Disponible con la API».

## Risks / Trade-offs

- Un dato inventado que parece confiable es el peor error en un catálogo de museo: por eso la evidencia
  obligatoria, la verificación de la cita y la aprobación campo por campo.
- La lectura de la foto (categoría, materiales) es menos verificable que una cita: confianza más alta
  exigida y la etiqueta «de la foto».

## Open Questions

- ¿El museo acepta que la IA proponga categoría o materiales a partir de la foto? →
  `docs/preguntas-contraparte.md`.
- ¿Más adelante, aprobación en bloque para propuestas con cita literal y alta confianza?
