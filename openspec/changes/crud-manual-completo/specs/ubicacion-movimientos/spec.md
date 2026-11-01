## ADDED Requirements

### Requirement: Alta y edición de lugares desde el árbol de ubicaciones
Quien tiene el permiso de administrar ubicaciones MUST poder, desde el árbol de ubicaciones de la vista de búsqueda, agregar un lugar dentro del lugar seleccionado y editar el nombre o desactivar un lugar, con las mismas reglas de jerarquía y auditoría que Administración › Ubicaciones. Un lugar con piezas, o con lugares activos dentro, MUST NOT desactivarse, ni desde aquí ni desde Administración. El tipo del lugar nuevo SHALL proponerse según el nivel en que se agrega. Quien no tiene el permiso SHALL ver el árbol sin esas acciones. (RF-016, RN-005, RNF-010)

#### Scenario: Agregar una caja en un nivel
- **GIVEN** un usuario con permiso de administrar ubicaciones en la búsqueda
- **WHEN** selecciona «Depósito 2 › Estante C › Nivel 1» y elige «Agregar lugar aquí» con el nombre «Caja 14»
- **THEN** «Caja 14» aparece dentro del nivel como contenedor, queda disponible como destino de «Mover a» y la auditoría registra el alta

#### Scenario: Lugar que la jerarquía no admite
- **WHEN** el usuario intenta agregar una sede dentro de un nivel
- **THEN** el sistema no ofrece ese tipo y explica qué tipos admite el nivel

#### Scenario: Desactivar un lugar con piezas
- **WHEN** se intenta desactivar un estante que tiene piezas
- **THEN** el sistema lo impide, aquí y en Administración, indicando cuántas piezas hay que mover antes

#### Scenario: Usuario sin permiso
- **WHEN** un usuario de Consulta interna abre el árbol de ubicaciones
- **THEN** puede filtrar por lugar pero no ve «Agregar lugar aquí» ni «Editar»
