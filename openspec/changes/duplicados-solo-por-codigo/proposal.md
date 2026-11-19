## Why

La detección de duplicados proponía pares por parecido de campos (denominación, colección, autor, procedencia, época y
medidas). No es preciso: en el museo hay piezas muy parecidas que son objetos distintos, de otro origen, con otras
medidas o con una particularidad física. El equipo decidió (2026-11-19) que **solo se marque como duplicado lo que
comparte un código**, cualquiera de los que tenga la pieza.

## What Changes

- **Cola de duplicados**: un par entra solo si las dos piezas comparten el valor normalizado de un mismo tipo de
  identificador, vigente o histórico (I, colección, INC, PUCP, propietario u otro). Las demás señales se siguen
  calculando para explicar y ordenar el par, pero ya no bastan. Los bloques por denominación y por autor y procedencia
  desaparecen: la detección solo compara piezas con un código igual.
- **Limpieza**: una detección completa cierra como `SUPERSEDED` los pares pendientes o pospuestos que ya no se
  detectan (los propuestos por parecido), con quien lanzó la detección como revisor y el motivo. No se borra nada.
- **Importación**: la validación deja de usar el evaluador de similitud; una fila sin códigos coincidentes es **Nueva**
  y la clasificación «Posible duplicado» queda sin uso (se conserva para los lotes validados antes). La regla 4 de
  «Cómo se clasifican las filas» lo explica. «Pedir a Gemini que revise estas filas» solo aparece si el lote tiene
  posibles duplicados.
- **BREAKING (comportamiento)**: el umbral `min_score` y los pesos se conservan en la configuración para no invalidar
  lo guardado, pero ya no deciden si un par entra en la cola.

## Impact

- Capacidades `calidad-datos` y `importacion-datos` (requirements modificados).
- API: `quality/scoring.py`, `quality/duplicates.py`, `quality/scan.py`, `imports/classify.py`, `imports/service.py`,
  `api/v1/imports.py`. Sin cambios en el contrato de la API.
- Web: `LiveImportWizard.tsx` (botón de Gemini).
- Manual: `calidad-datos.md`, `importacion.md`.
