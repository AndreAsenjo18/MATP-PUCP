# Diseño — `alinear-api-endpoints-v1`

Ver `proposal.md` (Why) y el mapeo completo en `docs/api/mapeo-endpoints-v1.md`. Punto de partida: API con 78 operaciones (28 implementadas, 50 stubs) del change `contratos-api-borrador`, y el modelo de 23 tablas de `modelo-datos-nucleo`.

## D1. El documento manda en la frontera; el dominio conserva sus reglas

`docs/fuentes/endpoints-api-v1.yaml` fija rutas, verbos, `operationId`, esquemas y valores de enumerado. Lo que no fija (reglas de negocio, auditoría, borrado lógico, aprobación humana de la IA) se mantiene como está, porque proviene del catálogo de requisitos y de `CLAUDE.md`. Cuando el documento describe una operación en términos que chocan con una regla no negociable, se conserva **la ruta y el verbo del documento** y se ajusta el comportamiento:

- `DELETE /pieces/{id}/identifiers/{identifier_id}`: baja lógica del identificador (queda en el historial y en la auditoría), nunca borrado físico (RN-005). Si el identificador es de tipo I, responde 409 citando RN-002.
- `DELETE /pieces/{id}`: `is_active = false` con motivo obligatorio; la restauración sigue disponible en la operación añadida `POST /pieces/{id}/restore`.
- `POST /ai/suggest-cataloging`: devuelve la sugerencia como pendiente y la guarda con `status: PENDING`; aplicarla exige las operaciones añadidas de aprobación (RN-009).

## D2. Prueba de conformidad como red de seguridad

`apps/api/tests/api/test_contract_conformance.py` lee `docs/fuentes/endpoints-api-v1.yaml` y compara con el esquema que genera la aplicación:

1. Toda ruta, verbo y `operationId` del documento existe en la API, con el prefijo `/api/v1`.
2. Los campos requeridos de cada esquema del documento existen en el esquema de la API con el mismo nombre.
3. Las operaciones de la API que no están en el documento están declaradas en la lista de añadidos del propio test, que se mantiene junto a `docs/api/mapeo-endpoints-v1.md`; cualquier otra hace fallar la prueba.

Así, si alguien añade una ruta que el documento no contempla, la CI lo detecta en lugar de descubrirse en la integración.

## D3. Campos y nombres

| Documento | Hoy | Decisión |
|---|---|---|
| `denomination` | `title` | Se renombra el campo de la API y de la base de datos a `denomination` |
| `code_i` en la pieza | identificador de tipo I en `piece_identifier` | Se añade `piece.code_i` (único entre activos, inmutable salvo corrección auditada). El identificador de tipo I se conserva en `piece_identifier` como historial y se sincroniza en el mismo servicio: una sola escritura, dos lugares consistentes (ver D4) |
| `category_id`, `conservation_state_id` | términos de vocabulario | Se crean las entidades `category` (jerárquica) y `conservation_state`; los demás vocabularios siguen en `vocabulary`/`term` (RN-010) |
| `is_active` | `deleted_at`, `deleted_by_id`, `deletion_reason` | `is_active` se expone en la API como propiedad derivada (`deleted_at is null`); la base conserva quién y por qué (RN-005) |
| `epoch_original_text`, `epoch_start_year`, `epoch_end_year` | `period_text`, `period_from`, `period_to` | Se renombran a los nombres del documento |
| `unmapped_payload` | `unmapped_payload` | Igual |
| `tenure_regime` con valores en español | valores en inglés | Traducción en la frontera (entrada y salida) con una tabla única en `app/api/enums.py`; la base conserva los códigos en inglés (ADR-002: código en inglés) |

## D4. `code_i` duplicado en dos lugares

El documento lo quiere en la pieza; RN-001 y el historial de códigos lo quieren en `piece_identifier`. Se guarda en los dos, con una sola vía de escritura (`identification/service.py`) y una restricción en la base que impide que difieran (disparador que compara `piece.code_i` con el identificador vigente de tipo I). Alternativas descartadas: solo en la pieza (se pierde el historial de códigos I corregidos, RN-002); solo en el identificador (obliga a un JOIN en cada respuesta y no cumple el contrato); vista materializada (complica las escrituras sin ganar nada aquí).

## D5. Orden de implementación

Por fases del propio documento, para que la maqueta y las células avancen desde la fase 1:

1. Fase 1 (operaciones 1 a 20): piezas, colecciones, categorías, estados de conservación, ubicaciones, importación, búsqueda, multimedia y autenticación.
2. Cliente tipado y maqueta en modo `live` sobre esas rutas.
3. Fase 2 (21 a 38) y fase 3 (39 a 45) como stubs con su forma definitiva, salvo `/public/catalog`, que espera la decisión C2.

## D6. Riesgos

- **Rotura de la maqueta y del cliente tipado**: se regeneran en el mismo change; la prueba de conformidad y `npm run openapi:check` impiden que queden desalineados.
- **Numeración de requisitos (C1)**: hasta que el equipo decida, las specs siguen citando los IDs de `docs/requisitos/catalogo.md` y el mapeo registra la correspondencia con las etiquetas del documento.
- **`/public/catalog` (C2)**: no se implementa ni se expone como stub mientras contradiga «solo uso interno en fase 1».
