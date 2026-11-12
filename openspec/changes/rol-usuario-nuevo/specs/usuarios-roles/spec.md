## ADDED Requirements

### Requirement: Rol elegido a propósito al crear un usuario
Al crear un usuario, la interfaz MUST mostrar los roles como botones de opción, cada uno con una línea en lenguaje llano sobre lo que puede hacer, y MUST NOT dejar un rol elegido de antemano. Si se intenta crear sin rol, el formulario SHALL avisar junto al grupo y conservar lo escrito. Los roles desactivados se muestran sin poder elegirse. (RF-039, RNF-010)

#### Scenario: Diálogo recién abierto
- **WHEN** un Administrador abre «Nuevo usuario»
- **THEN** ningún rol está elegido y cada rol muestra una línea que explica para qué sirve

#### Scenario: Crear sin elegir rol
- **WHEN** escribe el correo y el nombre y pulsa «Crear usuario» sin elegir rol
- **THEN** ve «Elija un rol.» junto a los roles, el correo y el nombre siguen escritos y no se crea la cuenta

#### Scenario: Rol desactivado
- **WHEN** mira los roles
- **THEN** «Consulta externa / investigador» se ve desactivado y no se puede elegir
