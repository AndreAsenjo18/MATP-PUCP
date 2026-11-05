## Context

`app/ia/sugerencias/page.tsx` lee `store.aiSuggestions` (almacén de demostración con `AI_SUGGESTIONS` sintéticas) tanto en modo demostración como conectado: no hay rama `live`. Cada tarjeta muestra `FUNCTION_LABEL` con identificadores, `input_data` y `output_data` como JSON y un `Textarea` JSON para editar antes de aprobar. El almacén aplica `approveAiSuggestion`/`rejectAiSuggestion` solo en memoria.

## Goals / Non-Goals

**Goals:** que la pantalla se entienda en segundos, que quede claro que está fuera del MVP y que sus ejemplos no son datos reales, y que la propuesta se lea sin saber JSON. **Non-Goals:** conectar con la API de IA o con un proveedor real, cambiar la regla de aprobación humana o tocar la pestaña de la ficha y el aviso del Inicio.

## Decisions

### D1. Aviso de alcance fijo, no condicionado al modo
El aviso «Fuera del MVP» se muestra siempre (demostración y conectado), porque en ambos modos los datos son los mismos ejemplos locales. Es una franja `ambar` con icono y texto (no solo color) bajo el encabezado. Alternativa descartada: ocultar la sección del menú; el equipo la usa para la demostración y quitarla escondería el estado en lugar de explicarlo.

### D2. Presentación en funciones puras
`components/domain/AiSuggestionParts.tsx` exporta `functionLabel(code)` (nombre llano de las cinco funciones, y el código tal cual si es desconocido), `describeValue(value)` (texto, número, lista y objeto anidado a texto) y `proposalFields(output)`, que devuelve pares `{ label, value }` con etiqueta legible (`FIELD_LABELS`: categoría, estado de conservación, procedencia…), y la `confidence` como «82 % de confianza» aparte. Los campos desconocidos conservan su clave. Se prueban sin DOM.

### D3. Componentes de la tarjeta
`ScopeNotice`, `ProposalList` (lista de definiciones) y `SuggestionCard` quedan en la página; el JSON de edición va dentro de `<details>` («Corregir antes de aprobar»), cerrado por omisión y con el mismo control y validación que hoy. Los botones Aprobar y Rechazar conservan sus diálogos de confirmación, con copia sin referencia a reglas internas.

### D4. Lenguaje
Título «Sugerencias de la IA». Subtítulo: «La IA lee el texto libre de una ficha y propone sus campos. Usted revisa, corrige y aprueba; sin su aprobación no se guarda nada.» Aviso: «Fuera del MVP. Estos son ejemplos de demostración con datos sintéticos: aún no hay un proveedor de IA conectado y lo que apruebe aquí no cambia el catálogo.» Secciones «Ejemplos pendientes de revisión (n)» y «Ejemplos ya revisados». La palabra «proveedor» y su valor técnico no se muestran.

## Risks / Trade-offs

- Si el equipo decide incluir la IA en el MVP, el aviso se retira en el change que conecte la pantalla a la API; el texto está en una constante para quitarlo en un solo lugar.
