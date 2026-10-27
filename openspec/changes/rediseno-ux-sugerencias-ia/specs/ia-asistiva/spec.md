## ADDED Requirements

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
