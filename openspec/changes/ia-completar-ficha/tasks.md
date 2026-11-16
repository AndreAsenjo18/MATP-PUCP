## 1. Proveedor de IA

- [x] 1.1 Ampliar `suggest_cataloging` (o nueva `complete_piece`): campos pedidos, vocabularios del museo, imagen opcional y salida con evidencia por campo; `MockProvider` determinista (D1, D2, RIA-01, RIA-03)
- [x] 1.2 Prompt en español sin conocimiento externo y con «sin dato»; versión guardada (D4)

## 2. API

- [x] 2.1 Endpoint para pedir las propuestas de una pieza a partir de sus `missing_fields`; verificación de que cada cita está en el texto; descartar propuestas sin evidencia (D2)
- [x] 2.2 Constancia en `AiSuggestion` de lo propuesto, aceptado y descartado; auditoría con origen `AI` en los campos guardados desde una propuesta (D3, RN-009)
- [x] 2.3 Ampliar los campos aplicables (`APPLICABLE_FIELDS`) a materiales, procedencia, época y categoría
- [x] 2.4 Pruebas de la API (nada se guarda sin «Guardar»; sin evidencia no hay propuesta) y en PostgreSQL con Docker

## 3. Web

- [x] 3.1 En el panel «Completar ficha»: estado «Gemini está leyendo la ficha…» e insignia «Powered by Gemini» (`ui/GeminiBadge`) (D5)
- [x] 3.2 Propuestas en su campo con «Sugerido por Gemini», la cita resaltada en «Lo que ya dice la ficha», y Aceptar / corregir / descartar
- [x] 3.3 Campos sin dato en la ficha: «Gemini no encontró … en la ficha»
- [x] 3.4 Sin proveedor: el panel de siempre

## 4. Cierre

- [x] 4.1 Preguntas abiertas a `docs/preguntas-contraparte.md` (foto como evidencia; aprobación en bloque futura)
- [x] 4.2 OpenAPI, cliente tipado y manual de usuario
- [ ] 4.3 `openspec archive ia-completar-ficha -y` tras aprobar el PR
