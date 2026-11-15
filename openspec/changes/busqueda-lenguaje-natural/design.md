## Context

Estado actual observado en el código (no supuesto):

- `apps/api/app/modules/search/filters.py`: `PieceFilter` ya es el formato estructurado único de
  la búsqueda (texto, colección, categoría, material, ubicación, régimen, época, alertas…), con
  `extra="ignore"` y `validate_permissions()` que descarta/rechaza campos sensibles
  (`valuation_min/max`, `lender_name`, `loan_agreement_ref`) según el rol de quien pregunta
  (RF-041). `ActiveFilter` ya existe como representación en lenguaje llano de un filtro activo,
  pensada para chips.
- `apps/web/src/components/domain/SearchLive.tsx`: `ActiveFilterChips` ya renderiza los filtros
  activos como etiquetas que se pueden quitar con un clic.
- `services/ai/matp_ai/providers/base.py`: la interfaz `AIProvider` ya tiene cuatro operaciones
  (`extract_structured`, `suggest_terms`, `describe`, `suggest_column_mapping`), cada una con su
  propio esquema de entrada/salida en `matp_ai/schemas.py`, implementación `mock` determinista y
  (para `extract_structured` y `suggest_column_mapping`) implementación `llm` real, probada en vivo
  con el tier gratuito de Gemini a través de la capa compatible con OpenAI
  (`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`, ver `services/ai/matp_ai/providers/llm.py`). Agregar
  una quinta operación es extender un patrón ya recorrido dos veces, no construir uno nuevo.
- `apps/api/app/modules/identification/normalization.py::normalize()` ya normaliza códigos
  (`"i cero dos tres seis"` → tipo `I`, valor `0236` → `I-0236` al mostrarse) — es la misma función
  que usan los identificadores de pieza; la propuesta original la reutiliza, no la reinventa.
- Todas las operaciones de IA hoy viven bajo `/ai/...` en `apps/api/app/api/v1/admin.py`.
- A diferencia de `ia-extraccion-texto-libre` y `carga-masiva-con-ia`, ninguna otra operación de IA
  del sistema deja de escribir algo pendiente de aprobación (`AiSuggestion` + aprobar/rechazar,
  RN-009). Esta es la primera que es puramente de lectura: propone filtros, la persona los ve y
  ejecuta la búsqueda o no — no hay nada que aprobar porque no hay nada que guardar.

## Goals / Non-Goals

**Goals:**
- Traducir una frase en español (escrita o dictada) a los filtros que `PieceFilter` ya entiende,
  aplicados como los chips editables que ya existen — sin una caja ni una pantalla aparte.
- Reusar el motor de búsqueda, la validación de permisos y los chips existentes sin tocarlos.
- Degradar con gracia sin proveedor de IA: la caja de texto sigue sirviendo como búsqueda de texto
  libre normal (el filtro único `q` ya existente).
- No duplicar la búsqueda: el perfil de usuario esperado (RP4 de `preguntas-contraparte.md`, 60+
  años y poca práctica con computadoras) describe lo que busca en cualquier caja que tenga
  enfrente, sin leer cuál es «para IA» y cuál no — por eso hay una sola caja, no dos.

**Non-Goals:**
- No es un asistente de preguntas y respuestas sobre el catálogo (eso, si se construye, es RIA-05
  en otro sentido — un resumen o analítica, no un traductor de filtros).
- No reemplaza los filtros manuales ni los desplegables existentes: conviven.
- No construye transcripción de voz propia: usa el dictado del navegador (`SpeechRecognition`), sin
  servicio propio de voz-a-texto.
- No permite proponer filtros sobre campos sensibles (D3).

## Decisions

### D1. Sin tabla de sugerencias ni aprobación posterior

Las demás funciones de IA (RIA-01) registran una `AiSuggestion` pendiente que alguien aprueba o
rechaza después, porque van a escribir en el catálogo. Esta no escribe nada: la respuesta de la IA
llena filtros que la persona ve de inmediato como chips y puede quitar antes de pulsar «Buscar». No
hay backend de aprobación que construir aquí — simplifica bastante el alcance frente a RIA-01.

### D2. El mismo vocabulario que `PieceFilter`, resuelto contra lo que ya cargó el frontend

**Decisión final, tras implementar (ajuste sobre el borrador de esta sección):** el frontend ya
carga, para sus propios desplegables, las cinco listas con catálogo (`SearchOptions`: colecciones,
categorías, materiales, estados de conservación, ubicaciones), cada una como `{id, label}`. El
endpoint nuevo reenvía esas mismas listas al proveedor de IA (la IA solo ve las etiquetas) y
después resuelve la etiqueta que el modelo devolvió contra esa misma lista para obtener el id
real — en vez de volver a consultar la base de datos y de instanciar `PieceFilter` para validar.
El resultado es el mismo que proponía el borrador (nada que no exista en el catálogo real llega a
la respuesta) con menos trabajo: una sola fuente de verdad para esas listas (la que ya usan los
filtros manuales), sin un segundo camino de consulta a mantener en el backend. Los regímenes de
tenencia y las alertas de completitud sí son fijos del lado del servidor (no dependen de qué
cargó el frontend).

### D3. Campos sensibles fuera de lo que la IA puede proponer

Igual que `ai_suggestions/privacy.py` excluye campos sensibles de lo que se manda a la IA en
`carga-masiva-con-ia`, aquí el esquema de salida del proveedor (`SearchInterpretation`) **no**
incluye `valuation_min/max`, `lender_name` ni `loan_agreement_ref` — ni siquiera como campo
opcional. Quien quiera filtrar por esos datos sigue usando los controles manuales que ya existen
(y que de todas formas exigen el permiso de RF-041).

### D4. Limpieza en dos capas, como lo propone el equipo

El modelo solo quita muletillas y ordena la frase; la normalización exacta de códigos
(`"mmz quince"` → `MMZ-15`) la hace `normalize()`, ya probada, no el modelo. El endpoint aplica
`normalize()` sobre cualquier fragmento que el modelo identifique como código antes de intentar
calzarlo contra un identificador real.

### D5. Voz: dictado del navegador, con aviso

`SpeechRecognition`/`webkitSpeechRecognition` (Chrome/Edge) convierte voz a texto **en el propio
navegador o en el servicio de reconocimiento de voz de ese navegador** antes de que el sistema vea
ninguna palabra — el MATP no monta nada de voz propio para esta iteración. Se avisa en la interfaz,
discretamente, qué navegador lo soporta y que usa el reconocimiento de voz del navegador. Ningún
dato personal cruza esa capa (son nombres de piezas y colecciones, no datos del donante ni del
propietario), pero se deja constancia para que el equipo decida si vale la pena mencionarlo al
museo.

### D6. Chips: quitar, no editar en línea

`ActiveFilterChips` ya permite **quitar** un filtro con un clic; no permite editarlo en el lugar.
Para esta iteración, un filtro mal interpretado se quita con el chip y se corrige con el control
manual correspondiente (el desplegable de esa categoría ya existe) — no se construye edición en
línea del chip. Si en el uso real esto resulta incómodo, es un ajuste de una iteración futura, no
un bloqueo de esta.

### D7. Una sola caja, no una caja nueva aparte (revisado tras conversación con el equipo)

Se descartó la idea inicial de agregar una caja separada «descríbalo con sus palabras»: duplica la
búsqueda, y el perfil de usuario esperado tiende a escribir una descripción completa en **cualquier**
caja que vea, sin distinguir cuál es la rápida y cuál la de IA (el mismo motivo por el que, según el
equipo, esto falla en otras apps). En su lugar, el micrófono y la interpretación se agregan a la
caja «Código o texto» (`SearchBox`) que ya existe:

- **Mientras escribe**, la búsqueda instantánea por texto sigue funcionando exactamente igual que
  hoy (RF-038) — no se le agrega ninguna llamada a la IA por cada tecla.
- **Al terminar** (pausa breve tras dejar de escribir, Enter, o fin de un dictado por voz) se pide
  la interpretación en segundo plano, sin bloquear los resultados que ya se ven por la búsqueda de
  texto.
- Lo que la IA reconozca se **aplica de una vez** como filtros (los mismos chips de siempre,
  removibles) — no hay un paso extra de «confirmar antes de buscar»: quitar un chip mal
  interpretado ya es la misma acción de un clic que corregir cualquier filtro hoy, y evita un clic
  más a quien tiene poca práctica con el sistema (RP4).
- El ícono de micrófono vive dentro de esa misma caja: dictar llena el mismo campo que escribir, y
  al terminar de hablar se dispara la interpretación igual que al dejar de escribir.

Esto reemplaza la mención a una caja nueva en versiones anteriores de esta propuesta.

### D8. `alertCode` nuevo en `SearchFilters` (hallazgo durante la implementación)

El frontend ya tenía `hasAlerts: boolean` (genérico: «alguna alerta» sí/no) pero no una forma de
filtrar por una alerta puntual («sin foto») desde la pantalla de Búsqueda — `alert_code` solo
existía como parámetro de URL al llegar desde un enlace del tablero, fuera del estado interactivo
de filtros. Para que «sin foto» funcione de verdad como filtro aplicable (y no solo como «alguna
alerta»), se agregó `alertCode` como campo más de `SearchFilters`, siguiendo exactamente el mismo
patrón genérico que ya usan los demás filtros (`EMPTY_FILTERS`, `API_KEYS`, `FILTER_LABELS`,
`activeChips`, `removeFilter`, ida y vuelta por la URL) — sin construir nada nuevo, solo una entrada
más en cada mapa ya existente. No se agregó un control manual (desplegable) para elegirlo a mano en
esta iteración: por ahora solo se llena desde la interpretación de IA o desde un enlace del tablero,
como ya pasaba con `alert_code` en la URL.

## Risks / Trade-offs

- **[El modelo entiende mal una categoría ambigua]** → el texto limpio se muestra siempre antes de
  buscar (igual que propone el PDF), y cada filtro propuesto es un chip removible individualmente;
  nunca se ejecuta una búsqueda sin que la persona vea qué se interpretó.
- **[Proveedor de IA caído o `AI_PROVIDER=mock`]** → la caja de texto sigue funcionando como
  búsqueda de texto libre normal (el filtro `q` ya existente); nunca bloquea la búsqueda.
- **[Dictado del navegador sin soporte]** → el botón de voz no aparece o queda deshabilitado; la
  caja de texto sigue disponible igual.

## Migration Plan

Ninguna migración de esquema. Reversión: quitar el botón/caja de la pantalla de Búsqueda y el
endpoint nuevo; `PieceFilter` y la búsqueda manual no se tocan y siguen funcionando igual.

## Open Questions

- Se propone RIA-06 en vez de encajarlo en RIA-05: el requirement ya archivado de RIA-05
  («Asistente de consulta sobre catálogo autorizado», `openspec/specs/ia-asistiva/spec.md:87`)
  describe un asistente que **responde con texto y cita piezas**, y queda **desactivado por defecto
  en fase 1**. Esta propuesta no genera ninguna respuesta — solo traduce la frase a filtros ya
  existentes — y es justo la que el equipo quiere activa ahora. Forzarla dentro de RIA-05
  confundiría el catálogo cuando se construya el asistente real. `[SUPUESTO]`, a confirmar con el
  equipo — ver `docs/preguntas-contraparte.md`.
- Lista exacta de «valores válidos» a enviar al modelo (¿ubicaciones hasta qué nivel jerárquico?
  ¿vocabularios completos o solo términos activos?) — se arma desde los mismos catálogos que ya usa
  `PieceFilter`, pero el tamaño exacto de la lista es una decisión de ajuste, no de diseño.
- Modelo real a usar: el proveedor `llm` ya funciona con el tier gratuito de Gemini (probado en
  `carga-masiva-con-ia`); qué modelo fundacional permite la cuenta de AWS Academy del equipo es una
  decisión suya, no bloquea esta propuesta — basta con otra URL/clave/modelo en `.env`.
