## ADDED Requirements

### Requirement: Cierre de sesión dentro del menú en pantallas angostas
En pantallas de menos de 768 px el encabezado MUST NOT mostrar el botón de cerrar sesión (ni «Cambiar de rol» en modo demostración); la acción SHALL estar al final del panel del menú, con el nombre y el rol de la persona, y ejecutar lo mismo que en escritorio. Desde 768 px el botón MUST seguir en el encabezado con tamaño normal. (RNF-001, RNF-010)

#### Scenario: Celular con el menú cerrado
- **GIVEN** una sesión iniciada en una pantalla de 375 px
- **WHEN** la persona ve cualquier pantalla con el menú cerrado
- **THEN** el encabezado muestra el botón «Menú», la marca y su rol, pero no un botón de cerrar sesión

#### Scenario: Cerrar sesión desde el menú
- **WHEN** la persona abre el menú en el celular y pulsa «Cerrar sesión»
- **THEN** la sesión se cierra y vuelve a la pantalla de acceso

#### Scenario: Escritorio
- **WHEN** la pantalla mide 1280 px
- **THEN** «Cerrar sesión» está en el encabezado y el panel del menú móvil no se muestra

### Requirement: Botones que se adaptan al dispositivo
El botón del sistema de diseño MUST ofrecer un tamaño que sea grande y táctil (44 px de alto como mínimo) en pantallas angostas y compacto desde 768 px, para pantallas que se usan en ambos dispositivos. (RNF-001, RNF-010)

#### Scenario: Mismo botón en celular y escritorio
- **WHEN** una pantalla usa el tamaño adaptable
- **THEN** en 375 px el botón mide al menos 44 px de alto y en 1280 px es compacto, con la misma etiqueta
