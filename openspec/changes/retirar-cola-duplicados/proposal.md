## Why

Desde `codigo-unico-y-ajustes-pantallas` (#219), dos piezas nunca comparten un código, así que no puede haber duplicados
ni pares que revisar. La pestaña «Posibles duplicados» ya se retiró, pero queda todo lo que la sostenía:

- la cola y su detección, completa e incremental, en la API;
- la fusión de piezas, que solo se usaba desde la cola;
- el juicio de pares con Gemini, también en la revisión de un lote;
- los componentes de la cola en la web;
- los requisitos que describen una pantalla que ya no existe: los del spec base y los de los changes sin archivar
  `revisar-duplicados-comparacion` e `ia-juicio-duplicados`.

El equipo decidió (2026-11-22) retirarlos en un change propio.

## What Changes

- **REMOVED** en `calidad-datos`:
  - los requisitos de la cola, la detección, los pares distintos y la fusión;
  - «Revisión de un par como decisión guiada» (de `revisar-duplicados-comparacion`).
- **REMOVED** en `ia-asistiva`:
  - «Apoyo de IA a la detección de duplicados»;
  - «Juicio de pares de duplicados por IA con aprobación por grupo» (de `ia-juicio-duplicados`).
- **MODIFIED** en `plataforma`: los datos semilla ya no crean duplicados probables, que ahora violarían la regla del
  código único.
- **API**:
  - Se retiran las rutas `GET /quality/duplicates`, `POST /quality/duplicates/{id}/resolve`,
    `POST /quality/duplicates/scan`, `GET /quality/jobs/{job_id}`, las seis de `/quality/duplicates/ai-runs…` y
    `GET`/`POST /imports/{batch_id}/ai-judgment`.
  - Se retiran la detección incremental (al crear o editar una pieza) y la completa.
  - Se retiran los módulos de puntaje, fusión y juicio con IA, y el cierre de pares de filas de importación.
- **Web**: se retiran la cola, la comparación, el asistente de fusión, Gemini en la cola y «Pedir a Gemini que revise
  estas filas» del lote. Siguen la ficha de una pieza fusionada antes («fusionada en…») y la lectura de la ficha.
- **Se conserva todo dato** (RN-005): las tablas `duplicate_candidate`, `duplicate_ai_verdict`, `quality_job` y
  `quality_job_item` quedan con lo que tengan, sin escribirse más. Una pieza ya fusionada sigue mostrando a cuál se
  unió.

## Impact

- **Requisitos:** RF-030 y RIA-02 cambian de sentido. El duplicado ya no se detecta ni se resuelve: se impide al
  registrar el código. Hay que actualizarlos en `docs/requisitos/catalogo.md`; es un cambio de alcance que revisa el
  Líder de Proyecto.
- **Contrato:** las rutas retiradas no estaban en `docs/fuentes/endpoints-api-v1.yaml`. Eran operaciones añadidas
  (`docs/api/mapeo-endpoints-v1.md`) y salen de ahí.
- **Manual:** `calidad-datos.md`, `importacion.md` e `ia.md`.
