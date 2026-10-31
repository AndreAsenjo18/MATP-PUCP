## ADDED Requirements

### Requirement: Campos obligatorios marcados en el formulario de pieza
El formulario de registro y edición de pieza MUST marcar con un asterisco (`*`) junto a su etiqueta cada campo editable que el sistema exige para guardar (denominación y, al registrar, régimen de tenencia), y MUST mostrar al inicio del formulario una leyenda en texto que explique que los campos con `*` son obligatorios y el resto puede completarse después. Los campos opcionales MUST NOT llevar asterisco, y los controles obligatorios SHALL declarar `aria-required` para no depender solo del símbolo. (RF-006, RNF-010)

#### Scenario: Registrar una pieza
- **WHEN** una persona con permiso de registrar piezas abre el formulario de alta
- **THEN** ve «Denominación *» y «Régimen de tenencia *», y la leyenda que explica el asterisco

#### Scenario: Editar una pieza
- **WHEN** la persona abre el formulario de edición de una pieza
- **THEN** «Denominación» lleva `*` y el régimen de tenencia se muestra como dato de solo lectura, sin asterisco

#### Scenario: Campos opcionales sin marca
- **WHEN** se muestra el formulario
- **THEN** campos como «Colección», «Categoría» o «Descripción» no llevan asterisco
