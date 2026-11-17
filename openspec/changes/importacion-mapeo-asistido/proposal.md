## Why

En la carga de los Excel reales (ensayo de la demo, 2026-11-16) el paso que más tiempo tomó fue
«Ajustar columnas». Cuando ninguna plantilla reconoce el archivo, el editor muestra una fila por cada
columna (44 en las sábanas del museo) y, en cada una, un seleccionable con todos los campos del
catálogo: la lista ocupa la pantalla y la persona tiene que razonar «columna → campo» sin ver datos.
La IA ya propone un mapeo (`carga-masiva-con-ia`), pero lo aplica en silencio: no dice qué propuso ni
de qué duda. El equipo pidió que Gemini haga el mapeo y que la persona solo lo compruebe, viendo cómo
quedarían las piezas. Maqueta aprobada: `mapeo-gemini.gif` (2026-11-16).

## What Changes

- «Ajustar columnas» se abre en una vista nueva, **«Así quedarían las piezas»**: una fila por dato del
  catálogo (código I, código de colección, denominación, descripción, materiales, procedencia, época,
  medidas, estado, régimen…), con la columna del archivo de la que sale, quién la propuso
  («Formato», «Gemini», «Usted») y **los valores reales de las primeras filas**.
- Lo dudoso se marca con el **motivo** que da la IA («"Fecha" puede ser la época o la fecha de
  registro»). Para corregir, un menú corto con las **columnas del archivo y sus valores de ejemplo**,
  con buscador, en lugar del seleccionable con todos los campos.
- Las columnas que no se usan se listan aparte: se conservan en el registro de origen de cada fila.
- «Se ve bien: validar» guarda el mapeo y valida, igual que el editor. El editor completo (hoja, fila
  de cabeceras, transformaciones, correspondencias de términos) sigue disponible en «Ver todas las
  columnas».
- La sugerencia de la IA recibe la **muestra de filas** (sin columnas sensibles, RNF-014) y devuelve,
  por columna, un **motivo** cuando duda.

## Impact

- Capacidad `importacion-datos` (requirement modificado: «Ajuste de columnas como opción secundaria»).
- API: `ImportBatchOut.sample_rows` (primeras filas tal como vienen en el archivo);
  `ColumnMappingCandidateOut.reason`. Servicio de IA: `ColumnMappingCandidate.reason` en el mock y en
  el proveedor LLM.
- Web: `components/domain/ImportMappingReview.tsx` y `lib/data/mapping-review.ts`;
  `LiveImportWizard` muestra la vista nueva y deja el editor detrás de «Ver todas las columnas».
- RN-009: el mapeo propuesto nunca se aplica sin «Se ve bien: validar». RNF-014: a la IA solo van
  cabeceras y valores de ejemplo de columnas no sensibles (`safe_sample_rows`).
