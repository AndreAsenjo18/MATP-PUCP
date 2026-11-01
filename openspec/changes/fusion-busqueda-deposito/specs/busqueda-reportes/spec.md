## ADDED Requirements

### Requirement: Búsqueda en la descripción de la pieza
La búsqueda de texto libre MUST incluir la descripción de la pieza, sin distinguir mayúsculas ni tildes, y el sistema SHALL ofrecer además un filtro «Descripción contiene» que se combina con los demás filtros (AND). Una coincidencia solo en la descripción SHALL ordenarse después de las coincidencias por código y por denominación, y el resultado MUST indicar que coincidió en la descripción. (RF-031, RF-032, RF-038)

#### Scenario: Palabra que solo está en la descripción
- **WHEN** se busca `paja toquilla` y una pieza solo tiene esas palabras en su descripción
- **THEN** la pieza aparece en los resultados con la indicación «coincide en la descripción»

#### Scenario: Orden frente a coincidencias por denominación
- **WHEN** se busca `mate` y una pieza se llama «Mate burilado» y otra solo menciona «mate» en su descripción
- **THEN** la pieza con «Mate» en la denominación aparece antes

#### Scenario: Filtro de descripción combinado
- **WHEN** se filtra por material «Cerámica» y «Descripción contiene» `asa`
- **THEN** solo aparecen piezas de cerámica cuya descripción contiene «asa», y ambos filtros se ven como filtros activos

#### Scenario: Descripción vacía
- **WHEN** se filtra por «Descripción contiene» `asa`
- **THEN** las piezas sin descripción no aparecen y no producen error

### Requirement: Filtros priorizados en la búsqueda
La vista de búsqueda SHALL mostrar primero los filtros que el museo usa más: código o texto, denominación, categoría (tipo), material y descripción; los demás filtros MUST seguir disponibles en una sección «Más filtros» que se despliega y que se abre sola cuando alguno de sus filtros está activo. Los filtros MUST conservarse en la dirección de la página para compartir o volver a una búsqueda. (RF-032, RNF-010)

#### Scenario: Filtros principales a la vista
- **WHEN** un usuario abre la búsqueda
- **THEN** ve los filtros Código o texto, Denominación, Categoría, Material y Descripción, y «Más filtros» plegado

#### Scenario: Enlace con un filtro secundario
- **WHEN** alguien abre un enlace de búsqueda con el filtro de ubicación
- **THEN** «Más filtros» aparece desplegado con la ubicación elegida y el filtro aparece entre los filtros activos

#### Scenario: Denominación sin resultados
- **WHEN** se filtra por la denominación `xyz` y no hay coincidencias
- **THEN** la vista dice que no hay piezas con esos filtros y ofrece quitar los filtros uno por uno
