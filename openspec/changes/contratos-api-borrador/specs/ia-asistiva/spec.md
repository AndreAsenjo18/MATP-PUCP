## ADDED Requirements

### Requirement: Contrato del proveedor de IA
El servicio de IA MUST definir una interfaz de proveedor con las operaciones `extract_structured(text)` (RIA-01), `suggest_terms(piece)` (RIA-03) y `describe(piece)` (RIA-04), seleccionada por la variable `AI_PROVIDER`, con un proveedor simulado determinista por defecto y un proveedor de modelo de lenguaje configurable. Toda respuesta SHALL identificar el proveedor y el modelo, y MUST declararse como propuesta pendiente de aprobación humana; el servicio no escribe en el catálogo. (RIA-01, RIA-03, RIA-04, RN-009, RNF-008)

#### Scenario: Extracción simulada determinista
- **GIVEN** el servicio configurado con `AI_PROVIDER=mock`
- **WHEN** se solicita dos veces la extracción estructurada del texto "Alto 35 cm, ancho 20 cm. Exhibida en la muestra de retablos 1998"
- **THEN** ambas respuestas son idénticas, proponen las medidas con el fragmento de texto que las origina y están marcadas como pendientes de aprobación humana

#### Scenario: Texto sin datos reconocibles
- **WHEN** se solicita la extracción de un texto sin medidas, exposiciones ni estados reconocibles
- **THEN** la respuesta no contiene campos propuestos y lo indica sin error

#### Scenario: Proveedor real no implementado o no disponible
- **GIVEN** el servicio configurado con `AI_PROVIDER=llm` y credenciales
- **WHEN** se solicita una sugerencia y el proveedor no está implementado o no responde
- **THEN** el servicio responde 503 con código `ai_provider_unavailable` y un mensaje en español, sin afectar a la API de colecciones

#### Scenario: Entrada vacía
- **WHEN** se solicita la extracción de un texto vacío
- **THEN** el servicio responde 422 indicando que el texto es obligatorio
