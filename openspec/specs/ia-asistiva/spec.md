# ia-asistiva Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define las funciones de inteligencia artificial asistiva del sistema del MATP, siempre desacopladas mediante un proveedor intercambiable (simulado por defecto) y sujetas a aprobación humana antes de persistir cualquier resultado.

## Requirements

### Requirement: Aprobación humana obligatoria de salidas de IA
El sistema MUST registrar toda salida de IA como sugerencia pendiente, con tipo de función (RIA-01..05), entrada utilizada, salida propuesta, proveedor, fecha y pieza o lote relacionado, y MUST NOT aplicar ningún dato de una sugerencia al catálogo sin que un usuario autorizado la apruebe (total o parcialmente, con posibilidad de editarla) o la rechace con motivo. (RN-009, RF-040)

#### Scenario: Sugerencia pendiente
- **WHEN** la IA propone medidas estructuradas para una pieza
- **THEN** la sugerencia queda en estado "pendiente" y la ficha de la pieza no cambia

#### Scenario: Aprobación con edición
- **WHEN** un Catalogador edita un valor de la sugerencia y la aprueba
- **THEN** se aplica el valor editado, la sugerencia queda "aprobada con cambios" con revisor y fecha, y la auditoría registra origen "IA aprobada"

#### Scenario: Rechazo
- **WHEN** un revisor rechaza una sugerencia indicando el motivo
- **THEN** la sugerencia queda "rechazada", no se aplica ningún dato y se conserva para análisis

#### Scenario: Intento de aplicar sin aprobación
- **WHEN** un proceso intenta escribir en el catálogo el resultado de la IA sin una aprobación registrada
- **THEN** el sistema rechaza la escritura

#### Scenario: Sugerencia obsoleta
- **WHEN** un usuario intenta aprobar una sugerencia sobre campos que cambiaron después de generarse
- **THEN** el sistema muestra los valores actuales y pide confirmar antes de aplicar

### Requirement: Proveedor de IA desacoplado con modo simulado
El sistema MUST acceder a la IA mediante un servicio independiente con una interfaz de proveedor intercambiable por configuración, usando por defecto un proveedor simulado determinista que no requiere red ni credenciales; la indisponibilidad del proveedor SHALL no afectar al resto del sistema. (RIA-01..05, RNF-008)

#### Scenario: Demostración sin conexión externa
- **GIVEN** el sistema configurado con el proveedor simulado
- **WHEN** un usuario solicita una sugerencia
- **THEN** obtiene una sugerencia de ejemplo coherente y siempre igual para la misma entrada

#### Scenario: Proveedor real no disponible
- **WHEN** el proveedor configurado no responde
- **THEN** el sistema informa que la asistencia de IA no está disponible y las funciones de catálogo, búsqueda e importación siguen operando

#### Scenario: Datos sensibles hacia proveedor externo
- **WHEN** se usa un proveedor externo
- **THEN** el sistema no envía campos sensibles ni datos personales en la entrada [SUPUESTO: política de datos a validar]

### Requirement: Extracción de datos estructurados desde texto libre
El sistema MUST ofrecer la extracción asistida de datos estructurados (exposiciones, medidas, estado de conservación, marcas de revisión) desde campos de texto libre como descripción u observaciones, presentando cada dato propuesto junto al fragmento de texto que lo origina. (RIA-01)

#### Scenario: Medidas en observaciones
- **WHEN** se solicita la extracción sobre el texto "Alto 23 cm, diámetro 15 cm. Expuesto en 1998"
- **THEN** la sugerencia propone alto 23 cm, diámetro 15 cm y una participación en exposición en 1998, cada uno con su fragmento de origen

#### Scenario: Texto sin datos extraíbles
- **WHEN** se solicita la extracción sobre un texto sin medidas ni exposiciones
- **THEN** el sistema informa que no encontró datos y no crea sugerencias vacías

### Requirement: Apoyo de IA a la detección de duplicados
El sistema SHALL permitir que la IA aporte un puntaje de similitud semántica adicional a los candidatos a duplicado, que solo alimenta la cola de revisión humana de calidad de datos. (RIA-02, RF-030)

#### Scenario: Puntaje adicional
- **WHEN** la IA evalúa un par candidato
- **THEN** la cola muestra el puntaje de IA junto al puntaje de reglas, sin resolver el par automáticamente

### Requirement: Sugerencia de términos normalizados
El sistema SHALL sugerir categorías y términos de los vocabularios controlados (con equivalencia opcional a Getty AAT) a partir de los datos de la pieza, sugiriendo solo términos activos del vocabulario. (RIA-03, RN-010)

#### Scenario: Sugerencia de material
- **WHEN** una pieza tiene la descripción "tallado en madera de maguey policromada"
- **THEN** la IA sugiere el término de material existente que corresponda para revisión humana

#### Scenario: Término inexistente
- **WHEN** la IA propone un término que no existe en el vocabulario
- **THEN** la sugerencia se presenta como "propuesta de término nuevo" y solo un Gestor de colecciones puede aceptarla creando el término

### Requirement: Descripción preliminar desde metadatos
El sistema SHALL poder generar una descripción preliminar de una pieza a partir de sus metadatos registrados, marcada como borrador de IA hasta su aprobación. Su inclusión en fase 1 está por validar con la contraparte. (RIA-04)

#### Scenario: Borrador de descripción
- **WHEN** un Catalogador solicita una descripción preliminar
- **THEN** la sugerencia muestra un texto basado solo en los metadatos de la pieza, sin sobrescribir la descripción existente

#### Scenario: Metadatos insuficientes
- **WHEN** la pieza solo tiene denominación
- **THEN** el sistema informa que no hay metadatos suficientes para generar la descripción

### Requirement: Asistente de consulta sobre catálogo autorizado
El sistema SHALL poder ofrecer, en una etapa posterior, un asistente de consulta en lenguaje natural que responda solo con información del catálogo que el usuario tiene permiso de ver y cite las piezas utilizadas. Queda pendiente de priorización y desactivado por defecto en fase 1. (RIA-05, RF-041)

#### Scenario: Función desactivada
- **WHEN** un usuario intenta usar el asistente de consulta en fase 1 sin que esté habilitado
- **THEN** el sistema indica que la función no está disponible

#### Scenario: Respuesta limitada por permisos
- **GIVEN** el asistente habilitado
- **WHEN** un usuario de Consulta interna pregunta por la ubicación exacta de una pieza
- **THEN** la respuesta no revela campos restringidos para su rol

### Requirement: Contrato del proveedor de IA
La IA asistiva, que se ejecuta dentro de la aplicación de la API (ADR-008), MUST definir una interfaz de proveedor con las operaciones `extract_structured(text)` (RIA-01), `suggest_terms(piece)` (RIA-03) y `describe(piece)` (RIA-04), seleccionada por la variable `AI_PROVIDER`, con un proveedor simulado determinista por defecto y un proveedor de modelo de lenguaje configurable. Toda respuesta SHALL identificar el proveedor y el modelo, y MUST declararse como propuesta pendiente de aprobación humana; la IA no escribe en el catálogo ni accede a la base de datos. (RIA-01, RIA-03, RIA-04, RN-009, RNF-008)

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

### Requirement: Propósito de la pantalla de sugerencias explicado en corto
La pantalla de sugerencias de IA MUST explicar bajo su título, en no más de dos frases, qué hace la IA (lee el texto libre de una ficha y propone sus campos) y que la persona revisa, corrige y aprueba, sin aprobación no se guarda nada. Los textos visibles MUST NOT citar identificadores de requisitos (RIA-, RN-, RF-, RNF-) ni valores técnicos de configuración, y las cinco funciones de IA SHALL nombrarse en lenguaje llano. (RIA-01, RIA-02, RIA-03, RIA-04, RIA-05, RNF-010)

#### Scenario: Entender para qué sirve
- **WHEN** una persona con permiso de revisar IA abre la pantalla
- **THEN** lee, junto al título, que la IA propone campos a partir de un texto y que nada se guarda sin su aprobación

#### Scenario: Sin términos técnicos
- **WHEN** la pantalla muestra encabezado, tarjetas, diálogos y avisos
- **THEN** ningún texto visible contiene «RIA-», «RN-», «AI_PROVIDER» ni el nombre técnico del proveedor

### Requirement: Aviso de que la pantalla está fuera del MVP
La pantalla de sugerencias de IA MUST mostrar, en todo momento y en cualquier modo de conexión, un aviso visible con la etiqueta «Fuera del MVP» que diga que muestra ejemplos de demostración con datos sintéticos, que aún no hay un proveedor de IA conectado y que lo que se apruebe o rechace aquí no cambia el catálogo. Las tarjetas MUST presentarse bajo encabezados que las identifiquen como ejemplos. El aviso SHALL ir en texto con icono, sin depender solo del color. (RN-009, RNF-010)

#### Scenario: Aviso visible
- **WHEN** la persona abre la pantalla en modo demostración o conectado
- **THEN** ve la etiqueta «Fuera del MVP» y la aclaración de que son ejemplos que no cambian el catálogo

#### Scenario: Aprobar un ejemplo
- **WHEN** la persona aprueba un ejemplo pendiente
- **THEN** la tarjeta pasa a «Ejemplos ya revisados» y el catálogo de piezas no cambia

### Requirement: Propuesta de la IA legible
La propuesta de una sugerencia MUST mostrarse como una lista de campos con etiqueta y valor en lenguaje llano, y la confianza como porcentaje; los campos sin etiqueta conocida MUST conservar su nombre original. La edición en JSON antes de aprobar SHALL estar plegada bajo «Corregir antes de aprobar», conservar su validación y mantener a Aprobar deshabilitado mientras el JSON sea inválido. (RIA-01, RIA-03, RNF-010)

#### Scenario: Ver la propuesta
- **GIVEN** una propuesta con categoría, estado de conservación, procedencia y confianza 0,82
- **WHEN** se abre la tarjeta
- **THEN** se lee «Categoría: CERAMICA», «Estado de conservación: BUENO», «Procedencia: Puno» y «82 % de confianza», sin llaves ni comillas

#### Scenario: Corregir antes de aprobar
- **WHEN** la persona abre «Corregir antes de aprobar» y escribe un JSON inválido
- **THEN** ve el aviso de error y el botón Aprobar queda deshabilitado
