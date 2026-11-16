## Why

En «Piezas incompletas» el grupo más grande es «Faltan datos recomendados». Muchas de esas piezas ya
tienen la información escrita en su propia ficha, pero no en el campo correcto: la descripción dice
«caja de madera de cedro… mide 1,20 m de alto… elaborada en Ayacucho» y materiales, medidas y
procedencia están vacíos. El equipo pidió el 2026-11-15 que Gemini proponga esos datos dentro del
panel «Completar ficha» (`completar-piezas-incompletas`), siempre con la prueba a la vista y con
aprobación humana. Realiza RIA-01 (extracción desde texto libre) y RIA-03 (términos normalizados), y
suma la lectura de la foto. Maqueta aprobada: `completar con Gemini` (GIF del 2026-11-15).

## What Changes

- Al abrir el panel de una pieza, Gemini lee **solo lo de esa pieza** (descripción, observaciones,
  denominación y su foto principal) y propone valores para los campos que le faltan.
- Cada propuesta aparece en su campo marcada «Sugerido por Gemini», con **su prueba**: el fragmento de
  la descripción que la origina (resaltado en el texto) o «de la foto». La persona la acepta, la
  corrige o la descarta; nada se guarda sin «Guardar y siguiente» (RN-009).
- **Regla de oro: nada del conocimiento general del modelo.** Si la ficha no dice la época, no se
  propone época; el panel lo dice («Gemini no encontró la época en la ficha»). Los términos se eligen
  solo de los vocabularios del museo (RIA-03, RN-010).
- Operación del proveedor ampliada (`suggest_cataloging` o una nueva `complete_piece`): más campos que
  hoy (`APPLICABLE_FIELDS` solo tiene medidas, estado de conservación y marcas de revisión), entrada
  con imagen opcional y salida con evidencia por campo. `MockProvider` determinista.
- Sin aprobación en bloque en esta versión: primero medir el acierto pieza por pieza con los textos
  reales del museo.

## Impact

- Capacidad `ia-asistiva` (requirement nuevo). Depende de `completar-piezas-incompletas`.
- API: endpoint para pedir las propuestas de una pieza (o ampliar `POST /ai/suggest-cataloging`), con
  campos y evidencias; registro de qué propuestas se aceptaron (auditoría con origen `AI`).
- Proveedor: Gemini con imagen (costo y latencia mayores); sin proveedor, el panel funciona igual sin
  propuestas.
- Datos personales: nunca comodante, registrador ni el registro de origen (RNF-014).
