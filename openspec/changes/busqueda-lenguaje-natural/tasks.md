## 1. Servicio de IA — nueva operación

- [x] 1.1 `services/ai/matp_ai/schemas.py`: `SearchValidValues` (colecciones, categorías,
      materiales, estados de conservación, ubicaciones, regímenes de tenencia y alertas) y
      `SearchInterpretation` (sin campos sensibles: ni `valuation_*`, `lender_name` ni
      `loan_agreement_ref` existen en el esquema).
- [x] 1.2 `AIProvider.interpret_search(text, valid_values) -> SearchInterpretation` en `base.py`.
- [x] 1.3 Implementación `mock` en `mock.py`: coincidencia literal (sin tildes) contra cada lista
      de `valid_values`; determinista, sin red. Limitación conocida y aceptada, igual de espíritu
      que el resto del mock: no reconoce plurales ni sinónimos («toros» no calza con «Toro de
      Pucará»), solo texto que aparece tal cual.
- [x] 1.4 Implementación `llm` en `llm.py`, mismo patrón que `suggest_column_mapping`: prompt con
      los valores válidos, JSON estricto; cada valor devuelto se valida contra `valid_values` antes
      de aceptarse (nunca se confía en el modelo a ciegas).
- [x] 1.5 Pruebas en `services/ai/tests/test_providers.py`: mock determinista, mock sin nada
      reconocible, llm con respuesta válida, llm que intenta alucinar un valor fuera de las listas
      (se descarta), llm con JSON inválido (`ProviderUnavailable`).

## 2. Backend — endpoint

- [x] 2.1 `POST /ai/interpret-search` en `apps/api/app/api/v1/admin.py`. Decisión final, distinta
      del borrador original: las cinco listas con catálogo (`collections`, `categories`,
      `materials`, `conservation_states`, `locations`) las manda el **frontend** en el cuerpo de la
      petición, con los mismos `{id, label}` que ya carga para los desplegables (`SearchOptions`) —
      no se vuelve a consultar la base de datos en el backend para armarlas. Los regímenes de
      tenencia (`TENURE_REGIME_LABELS`) y las alertas de completitud (`_ALERT_SEARCH_LABELS`, un
      mapa corto `[SUPUESTO]` tipo «sin foto», no la oración larga de `ALERTS[...].message`) sí son
      fijos del lado del servidor. La resolución final (etiqueta → id real) se hace contra las
      mismas listas recibidas, no instanciando `PieceFilter` — el efecto es el mismo (nada que no
      venga de esas listas llega a la respuesta) pero el mecanismo es más simple.
- [x] 2.2 Mismo permiso que la búsqueda manual: `pieces.read` (`Reader`, sin permiso nuevo).
- [x] 2.3 OpenAPI regenerado (`npm run openapi`, `npm run openapi:client`) y la operación nueva
      registrada en `ANADIDOS` (`test_contract_conformance.py`) y en
      `docs/api/mapeo-endpoints-v1.md`.
- [x] 2.4 Pruebas en `apps/api/tests/api/test_api_interpret_search.py`: valores reconocidos
      resueltos a ids reales, valor inventado nunca llega a la respuesta, ningún campo sensible se
      manda al proveedor (verificado con un espía sobre el provider real), degradación a 503
      `ai_unavailable` sin romper nada, y que exige sesión iniciada.

## 3. Frontend

- [x] 3.1 `SearchBox` (la caja «Código o texto» que ya existe): la búsqueda instantánea por texto
      sigue disparándose en cada tecla sin cambios (`onChange`); además, con 900 ms de pausa tras
      la última tecla, al perder el foco vía «Buscar», o al terminar de dictar, se llama
      `onInterpret` en segundo plano — prop nueva y opcional, así que el modo demostración
      (`app/busqueda/page.tsx`, que no la pasa) queda exactamente igual que antes.
- [x] 3.2 Ícono de micrófono en `SearchPill` (props nuevas `onVoiceClick`/`voiceListening`, también
      opcionales): usa `SpeechRecognition`/`webkitSpeechRecognition` cuando el navegador lo expone;
      oculto si no. Al terminar de dictar, llena la caja y dispara la interpretación igual que al
      dejar de escribir.
- [x] 3.3 `SearchLive.handleInterpret` aplica lo reconocido directo al mismo estado de filtros que
      ya alimenta `ActiveFilterChips` (sin paso de confirmación aparte, D7) — con una protección
      contra condición de carrera: si la persona ya escribió algo distinto mientras se esperaba la
      respuesta, esa respuesta se descarta en vez de sobrescribir lo que está escribiendo ahora.
      Alcance ampliado sobre el diseño original: se agregó `alertCode` como campo nuevo de
      `SearchFilters` (antes solo existía el `hasAlerts` genérico), con su chip, su llave de la API
      y su ida y vuelta por la URL — necesario para que «sin foto» se pueda aplicar como filtro real
      y no solo como «alguna alerta».
- [x] 3.4 Mensajes y degradación: sin nada reconocido, la frase queda como texto libre normal; sin
      proveedor disponible, mensaje «No se pudo interpretar la frase en este momento; siga
      escribiendo como texto libre» — nunca bloquea la caja.
- [x] 3.5 Pruebas: `apps/web/src/lib/data/search.test.ts` (interpretación con filtros reconocidos,
      sin nada reconocible, proveedor no disponible; chip y recorrido por la URL del `alertCode`
      nuevo). No se encontró ni se creó un test de "lenguaje llano" específico de Búsqueda (existe
      uno para Importación, `ImportPlainLanguage.test.tsx`); se verificó a mano que ningún texto
      nuevo expone identificadores de requisitos (`RIA-06` solo aparece en comentarios de código).

## 4. Documentación y cierre

- [x] 4.1 `docs/requisitos/catalogo.md`: fila RF-049 **[SUPUESTO]** en la sección de búsqueda, y
      RIA-06 nueva en la sección de IA (no RIA-05: ver `design.md` y la nota agregada junto a la
      tabla).
- [x] 4.2 `docs/preguntas-contraparte.md`: sección «BL» con BL1 (RIA-06 vs. RIA-05), BL2 (tiempo de
      espera), BL3 (dictado del navegador) y BL4 (quitar vs. editar en línea el chip).
- [x] 4.3 `docs/manual-usuario/busqueda.md`: subsección «Escribir o dictar en lenguaje natural»
      dentro de «1. Buscar por código o por texto».
- [x] 4.4 Pruebas: `test:ai` (39 pasan), `test:api` (2127 pasan, suite completa sin regresiones),
      `test:web` (115 archivos / 1556 + nuevas), `lint:api`/`lint:ai`/`lint:web` en verde,
      `openspec validate busqueda-lenguaje-natural --strict` sin errores (solo la advertencia de
      «texto muy largo» que ya tiene el resto del repo). Verificación manual en el navegador
      pendiente de esta sesión (ver mensaje al usuario).
- [ ] 4.5 Archivar el change con `openspec archive busqueda-lenguaje-natural -y` **solo tras la
      aprobación del PR**.
