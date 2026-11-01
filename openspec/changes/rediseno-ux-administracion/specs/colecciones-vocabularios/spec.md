## ADDED Requirements

### Requirement: Listas de valores explicadas y fáciles de mantener
La interfaz MUST llamar «Listas de valores» a lo que antes llamaba vocabularios y explicar en una frase qué son: las opciones que se eligen al llenar una ficha, como materiales, técnicas o estados de conservación. La lista se elige en un selector que muestra cuántos términos tiene; sus términos MUST verse como etiquetas —verdes con un icono de visto los que se ofrecen en las fichas y grises y tachadas los demás, cada una con su estado «activo» o «desactivado» como texto accesible y una leyenda visible— que se activan o desactivan al pulsarlas, sin un botón por término. Agregar un término y crear una lista SHALL estar en la barra superior, y desactivar un término MUST aclarar que las fichas que ya lo usan lo conservan. (RF-010, RF-011, RNF-010)

#### Scenario: Entender qué es una lista
- **WHEN** la persona abre la sección «Listas de valores»
- **THEN** ve la explicación de una frase y un selector con la lista elegida y su número de términos

#### Scenario: Desactivar un término
- **WHEN** la persona pulsa la etiqueta de un término activo
- **THEN** pasa a gris y tachada con el texto «desactivado» y el aviso aclara que las fichas que lo usan lo conservan

#### Scenario: Agregar un término desde arriba
- **WHEN** la persona escribe un nombre en «Nuevo término» de la barra superior y pulsa «Agregar»
- **THEN** el término aparece como etiqueta activa y se muestra su código estable

#### Scenario: Lista sin términos
- **WHEN** la lista elegida no tiene términos
- **THEN** la pantalla lo dice e invita a agregar el primero desde la barra

### Requirement: Filtros y alta arriba en el listado de colecciones
El listado de colecciones MUST ofrecer arriba una búsqueda por nombre o sigla, un filtro por estado (todas, activas o inactivas) y un filtro por tipo (todas, principales o subcolecciones), y el alta de una colección o subcolección SHALL hacerse desde el botón «Nueva colección» de esa barra, en un diálogo. Las subcolecciones MUST distinguirse de las principales en el listado. (RF-010, RNF-010)

#### Scenario: Filtrar por estado
- **WHEN** la persona elige «Inactivas»
- **THEN** el listado muestra solo las colecciones inactivas y el conteo de resultados se actualiza

#### Scenario: Sin resultados
- **WHEN** la búsqueda no coincide con ninguna colección
- **THEN** la pantalla dice que no hay colecciones con esos filtros y ofrece limpiarlos

### Requirement: Tipos de código con alta desde la barra superior
La sección de tipos de código (antes «tipos de identificador») MUST crear tipos desde un botón «Nuevo tipo» de la barra superior, en un diálogo, mantener la edición de etiqueta y regla de un tipo ya existente en un panel junto a la tabla y señalar los tipos del sistema con un candado y texto. (RN-010, RNF-010)

#### Scenario: Crear un tipo
- **WHEN** la persona pulsa «Nuevo tipo», escribe la etiqueta y guarda
- **THEN** el diálogo se cierra y el tipo aparece en la tabla

#### Scenario: Tipo del sistema
- **WHEN** la persona elige un tipo del sistema para editarlo
- **THEN** el panel dice qué reglas no cambian y solo ofrece cambiar la etiqueta

### Requirement: Árbol de ubicaciones filtrable con alta desde la barra superior
La sección de ubicaciones MUST mostrar arriba una búsqueda por nombre y un filtro por nivel (sede, depósito, mueble, nivel o contenedor), conservar en el árbol los ascendientes de cada resultado, y crear ubicaciones desde un botón «Nueva ubicación» en un diálogo; los niveles SHALL distinguirse con etiquetas de color y texto. (RF-016, RNF-010)

#### Scenario: Buscar un mueble
- **WHEN** la persona escribe «Rack» en la búsqueda
- **THEN** el árbol muestra los muebles que coinciden con su sede y depósito como contexto

#### Scenario: Crear con padre
- **WHEN** la persona crea un contenedor eligiendo su mueble padre en el diálogo
- **THEN** el contenedor aparece dentro de ese mueble en el árbol
