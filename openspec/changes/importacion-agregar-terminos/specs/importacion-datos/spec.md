## ADDED Requirements

### Requirement: Agregar a la lista un valor del archivo desde la revisión
La revisión de un lote SHALL listar cada valor del archivo que no está en una lista de la ficha (materiales, tipo de bien, categoría, estado de conservación, forma de adquisición), agrupado por lista y con cuántas filas lo usan, y SHALL permitir a quien administra vocabularios agregarlo a esa lista, o reactivarlo si existe desactivado, y validar el lote de nuevo sin salir de la importación. Quien no administra vocabularios MUST NOT poder agregarlo. La vista «Así quedaría la ficha» SHALL mostrar el texto del archivo que no está en la lista en vez de «Sin registrar». (RF-011, RF-025, RN-005, RN-010)

#### Scenario: Tipo de bien que no está en la lista
- **GIVEN** 30 filas con «Escultura» en tipo de bien y ese término no está en la lista
- **WHEN** la Gestora pulsa «Agregar a la lista y validar de nuevo» en la revisión
- **THEN** «Escultura» queda en la lista de tipos de bien, el lote se valida de nuevo y las 30 filas lo reconocen sin aviso

#### Scenario: Término desactivado
- **GIVEN** «Donación» existe desactivado en formas de adquisición
- **WHEN** la persona lo agrega desde la revisión
- **THEN** se reactiva el término existente en vez de crear otro

#### Scenario: Sin permiso para administrar vocabularios
- **WHEN** un catalogador intenta agregar un valor a la lista
- **THEN** la API lo rechaza y la pantalla le indica pedirlo a quien administra las listas

#### Scenario: La ficha no dice «Sin registrar» para un dato del archivo
- **WHEN** el archivo trae «Piedra de Huamanga» en materiales y no está en la lista
- **THEN** la ficha muestra «Piedra de Huamanga»: no está en la lista
